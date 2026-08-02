import ExcelJS from "exceljs";

/** Column mapping target -> accepted header aliases, matched case/punctuation-insensitively. */
const HEADER_ALIASES: Record<string, string[]> = {
  code: ["code", "empcode", "employeecode"],
  name: ["name", "employeename"],
  fatherHusbandName: ["fathername", "fatherhusbandname", "fathersname"],
  dob: ["dob", "dateofbirth"],
  doj: ["doj", "dateofjoining"],
  mobile: ["mobile", "mobileno", "phone", "contactno"],
  aadharNo: ["aadharno", "aadhaarno", "aadharnumber"],
  address: ["address"],
  esicNo: ["esino", "esicno"],
  uan: ["uan", "uanno"],
  bankName: ["bankname"],
  bankAccount: ["accountno", "bankaccountno", "accountnumber"],
  ifsc: ["bankifsc", "ifsc", "ifsccode"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The sheet's D.O.B./D.O.J. columns use "01\01\1994" (DD\MM\YYYY, backslash-separated) instead of a standard date format. */
function parseFlexibleDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return undefined;
  const parts = value.split(/[^\d]+/).filter(Boolean);
  if (parts.length !== 3) return undefined;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return undefined;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function escapeCsv(v: string): string {
  return /["\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export interface ParsedWorkbook {
  /** CSV text ready for POST /contract-workers/import, scoped to the given client. */
  csv: string;
  rowCount: number;
}

/** Reads the first sheet of an uploaded workbook, maps its headers to ContractWorker fields, and builds an import-ready CSV. Rows with no recognizable name are skipped. */
export async function parseWorkerWorkbook(file: File, clientId: string): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Workbook has no sheets");

  const headerRow = sheet.getRow(1);
  const columnFields: (string | undefined)[] = [];
  for (let c = 1; c <= sheet.columnCount; c++) {
    const header = normalizeHeader(String(headerRow.getCell(c).value ?? ""));
    columnFields[c] = Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field]!.includes(header));
  }

  const columns = ["code", "name", "fatherHusbandName", "clientId", "basicSalary", "bankAccount", "ifsc", "esicNo", "uan", "dob", "doj", "mobile", "aadharNo", "address", "bankName"];
  const lines: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: Record<string, string> = { clientId, basicSalary: "0" };
    for (let c = 1; c <= sheet.columnCount; c++) {
      const field = columnFields[c];
      if (!field) continue;
      const cell = row.getCell(c).value;
      if (cell === null || cell === undefined || cell === "") continue;
      values[field] = (field === "dob" || field === "doj" ? parseFlexibleDate(cell) : String(cell)) ?? "";
    }
    if (!values["name"]) continue;
    lines.push(columns.map((col) => escapeCsv(values[col] ?? "")).join(","));
  }

  return { csv: [columns.join(","), ...lines].join("\n"), rowCount: lines.length };
}
