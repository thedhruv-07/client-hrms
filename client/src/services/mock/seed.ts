import type {
  AuditLog,
  Bill,
  BillLine,
  Client,
  Company,
  ContractWorker,
  InHouseEmployee,
  PayrollLine,
  PayrollRun,
  User,
} from "@/types";
import { calculateWageLine, calculateBill, calculateInHouseWageLine } from "@/lib/calc";
import { monthLabel, daysInMonth } from "@/lib/date";

// No real bank/GST/PAN/mobile data here — those fields stay null even
// though the company/client names ("Lucky Enterprises", "Wide India
// Industries") are already disclosed in PROJECT_SPEC.md and the server
// seed. Same reasoning as server/prisma/seed.ts.

export const company: Company = {
  id: "company-1",
  name: "Lucky Enterprises",
  address: "Contractor address, to be filled in",
  mobile: null,
  gstNo: null,
  panNo: null,
  pfCode: null,
  esiCode: null,
  bankName: null,
  bankAccount: null,
  ifsc: null,
  branch: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const client: Client = {
  id: "client-1",
  name: "Wide India Industries",
  address: "Client address, to be filled in",
  gstNo: null,
  panNo: null,
  hsnSac: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const users: User[] = [
  { id: "user-admin", email: "admin@lucky-enterprises.test", name: "Admin User", role: "ADMIN", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "user-hr", email: "hr@lucky-enterprises.test", name: "HR Manager", role: "HR", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "user-accountant", email: "accountant@lucky-enterprises.test", name: "Staff Accountant", role: "ACCOUNTANT", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "user-viewer", email: "viewer@lucky-enterprises.test", name: "Read-Only Viewer", role: "VIEWER", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

// Arun/Biru Kumar/Suraj are the three real workers from the source
// workbook (PROJECT_SPEC.md section 7) — basicSalary 17000 for all three
// is back-solved from the known Gross Earning figures. The rest are
// synthetic, added so lists/tables don't look like a 3-row toy.
export const contractWorkers: ContractWorker[] = [
  { id: "cw-1", code: "CW-001", name: "Arun", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "17000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-2", code: "CW-002", name: "Biru Kumar", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "17000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-3", code: "CW-003", name: "Suraj", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "17000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-4", code: "CW-004", name: "Deepak Yadav", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "18000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-5", code: "CW-005", name: "Manoj Kumar", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "16000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-6", code: "CW-006", name: "Ravi Shankar", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "19000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "ACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "cw-7", code: "CW-007", name: "Sunita Devi", fatherHusbandName: null, category: null, designation: null, clientId: "client-1", basicSalary: "15000.00", hra: "0.00", ta: "0.00", medicalAllow: "0.00", cea: "0.00", miscAllow: "0.00", bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, dob: null, doj: null, mobile: null, aadharNo: null, address: null, bankName: null, status: "INACTIVE", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-03-15T00:00:00.000Z" },
];

export const inHouseEmployees: InHouseEmployee[] = [
  { id: "ihe-1", code: "IH-001", name: "Priya Sharma", fatherHusbandName: null, basicSalary: "45000.00", department: "Engineering", designation: "Software Engineer", location: null, joiningDate: "2024-03-01T00:00:00.000Z", leaveBalance: "6.00", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2024-03-01T00:00:00.000Z", updatedAt: "2024-03-01T00:00:00.000Z" },
  { id: "ihe-2", code: "IH-002", name: "Rohit Verma", fatherHusbandName: null, basicSalary: "65000.00", department: "Engineering", designation: "Senior Engineer", location: null, joiningDate: "2022-07-15T00:00:00.000Z", leaveBalance: "9.50", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2022-07-15T00:00:00.000Z", updatedAt: "2022-07-15T00:00:00.000Z" },
  { id: "ihe-3", code: "IH-003", name: "Anjali Mehta", fatherHusbandName: null, basicSalary: "32000.00", department: "Sales", designation: "Sales Executive", location: null, joiningDate: "2023-11-01T00:00:00.000Z", leaveBalance: "4.00", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2023-11-01T00:00:00.000Z", updatedAt: "2023-11-01T00:00:00.000Z" },
  { id: "ihe-4", code: "IH-004", name: "Vikram Singh", fatherHusbandName: null, basicSalary: "55000.00", department: "Sales", designation: "Sales Manager", location: null, joiningDate: "2021-05-20T00:00:00.000Z", leaveBalance: "12.00", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2021-05-20T00:00:00.000Z", updatedAt: "2021-05-20T00:00:00.000Z" },
  { id: "ihe-5", code: "IH-005", name: "Neha Gupta", fatherHusbandName: null, basicSalary: "38000.00", department: "Finance", designation: "Accountant", location: null, joiningDate: "2023-01-10T00:00:00.000Z", leaveBalance: "7.00", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2023-01-10T00:00:00.000Z", updatedAt: "2023-01-10T00:00:00.000Z" },
  { id: "ihe-6", code: "IH-006", name: "Karan Malhotra", fatherHusbandName: null, basicSalary: "48000.00", department: "Operations", designation: "Operations Lead", location: null, joiningDate: "2022-09-01T00:00:00.000Z", leaveBalance: "5.50", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "ACTIVE", createdAt: "2022-09-01T00:00:00.000Z", updatedAt: "2022-09-01T00:00:00.000Z" },
  { id: "ihe-7", code: "IH-007", name: "Pooja Iyer", fatherHusbandName: null, basicSalary: "30000.00", department: "Human Resources", designation: "HR Executive", location: null, joiningDate: "2024-06-01T00:00:00.000Z", leaveBalance: "0.00", paymentMode: null, bankAccount: null, ifsc: null, pfNo: null, esicNo: null, uan: null, status: "INACTIVE", createdAt: "2024-06-01T00:00:00.000Z", updatedAt: "2026-06-20T00:00:00.000Z" },
];

const MONTHS: { month: number; year: number }[] = [
  { month: 2, year: 2026 },
  { month: 3, year: 2026 },
  { month: 4, year: 2026 },
  { month: 5, year: 2026 },
  { month: 6, year: 2026 },
  { month: 7, year: 2026 },
];

function num(n: number): string {
  return n.toFixed(2);
}

export const payrollRuns: PayrollRun[] = [];
export const payrollLines: PayrollLine[] = [];
export const bills: Bill[] = [];
export const billLines: BillLine[] = [];

let billCounter = 1;

MONTHS.forEach(({ month, year }, monthIndex) => {
  const isLatest = monthIndex === MONTHS.length - 1;
  const isJune2026 = month === 6 && year === 2026;

  // --- Contract Billing run ---
  const contractRunId = `run-contract-${year}-${month}`;
  const activeContractWorkers = contractWorkers.filter(
    (w) => w.status === "ACTIVE" || (w.id === "cw-7" && monthIndex <= 1) // Sunita present for Feb/Mar only
  );

  const contractLineInputs = activeContractWorkers.map((worker, workerIndex) => {
    if (isJune2026 && worker.id === "cw-1") return { actualPresentDays: 23, weekOffHoliday: 0, otHours: 58, advance: 1000 };
    if (isJune2026 && worker.id === "cw-2") return { actualPresentDays: 18, weekOffHoliday: 0, otHours: 51, advance: 5000 };
    if (isJune2026 && worker.id === "cw-3") return { actualPresentDays: 3, weekOffHoliday: 0, otHours: 1, advance: 0 };
    const actualPresentDays = 20 + ((workerIndex + monthIndex) % 6);
    const otHours = (workerIndex * 7 + monthIndex * 3) % 40;
    const advance = monthIndex % 3 === 0 && workerIndex % 2 === 0 ? 1000 * (workerIndex + 1) : 0;
    return { actualPresentDays, weekOffHoliday: 0, otHours, advance };
  });

  payrollRuns.push({
    id: contractRunId,
    month,
    year,
    type: "CONTRACT",
    clientId: client.id,
    status: isLatest ? "DRAFT" : "FINALIZED",
    createdById: "user-hr",
    createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
  });

  const monthDays = daysInMonth(month, year);
  const contractResults = activeContractWorkers.map((worker, i) => {
    const input = contractLineInputs[i]!;
    const wageInput = { basicSalary: Number(worker.basicSalary), monthDays, ...input };
    return calculateWageLine(wageInput);
  });
  activeContractWorkers.forEach((worker, i) => {
    const input = contractLineInputs[i]!;
    const result = contractResults[i]!;
    payrollLines.push({
      id: `line-${contractRunId}-${worker.id}`,
      payrollRunId: contractRunId,
      contractWorkerId: worker.id,
      inHouseEmployeeId: null,
      actualPresentDays: num(input.actualPresentDays),
      weekOffHoliday: num(input.weekOffHoliday),
      workingDays: num(result.workingDays),
      otHours: num(input.otHours),
      basicEarn: num(result.basicEarn),
      hraEarn: num(result.hraEarn),
      taEarn: num(result.taEarn),
      medicalEarn: num(result.medicalEarn),
      ceaEarn: num(result.ceaEarn),
      miscEarn: num(result.miscEarn),
      otAmount: num(result.otAmount),
      incentiveAllowRate: "0.00",
      incentive: num(result.incentive),
      attendAward: num(result.attendAward),
      nightCount: "0.00",
      nightAllowance: num(result.nightAllowance),
      otArrear: num(result.otArrear),
      grossEarning: num(result.grossEarning),
      pf: num(result.pf),
      esic: num(result.esic),
      employerEsic: num(result.employerEsic),
      otEsic: num(result.otEsic),
      lwf: num(result.lwf),
      advance: num(result.advance),
      tds: num(result.tds),
      otherDeduction: num(result.otherDeduction),
      leaveEncashment: num(result.leaveEncashment),
      arrears: num(result.arrears),
      bonus: num(result.bonus),
      totalDeduction: num(result.totalDeduction),
      netPayable: num(result.netPayable),
      createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
      updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    });
  });

  if (!isLatest) {
    // Bill only for finalized runs.
    const bill = calculateBill({
      workerBasicEarnings: contractResults.map((r) => r.basicEarn),
      workerHraEarnings: contractResults.map((r) => r.hraEarn),
      otAmount: contractResults.reduce((sum, r) => sum + r.otAmount, 0),
      attendAward: contractResults.reduce((sum, r) => sum + r.attendAward, 0),
      incentiveAmt: contractResults.reduce((sum, r) => sum + r.incentive, 0),
      lwf: contractResults.reduce((sum, r) => sum + r.lwf, 0) * 2,
    });
    const billId = `bill-${year}-${month}`;
    const billNo = String(billCounter++).padStart(3, "0");
    bills.push({
      id: billId,
      clientId: client.id,
      payrollRunId: contractRunId,
      billNo,
      billDate: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
      month,
      year,
      createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
      updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    });
    billLines.push({
      id: `billline-${billId}`,
      billId,
      basicWages: num(bill.basicWages),
      hra: num(bill.hra),
      otAmount: num(bill.otAmount),
      attendAward: num(bill.attendAward),
      incentiveAmt: num(bill.incentiveAmt),
      total1: num(bill.total1),
      esiEmployer: num(bill.esiEmployer),
      pfBase: num(bill.pfBase),
      pfEmployer: num(bill.pfEmployer),
      lwf: num(bill.lwf),
      serviceCharge: num(bill.serviceCharge),
      total2: num(bill.total2),
      cgst: num(bill.cgst),
      sgst: num(bill.sgst),
      grandTotal: num(bill.grandTotal),
      createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
      updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    });
  }

  // --- In-House Payroll run ---
  const inHouseRunId = `run-inhouse-${year}-${month}`;
  const activeEmployees = inHouseEmployees.filter((e) => e.status === "ACTIVE" || (e.id === "ihe-7" && monthIndex <= 3));

  payrollRuns.push({
    id: inHouseRunId,
    month,
    year,
    type: "INHOUSE",
    clientId: null,
    status: isLatest ? "DRAFT" : "FINALIZED",
    createdById: "user-hr",
    createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
  });

  activeEmployees.forEach((employee, i) => {
    const unpaidLeaveDays = (i + monthIndex) % 4 === 0 ? 1 : 0;
    const bonus = monthIndex === 5 && i % 3 === 0 ? 5000 : 0; // a July bonus round for some
    const incentive = i % 2 === 0 ? 1000 + i * 200 : 0;
    const result = calculateInHouseWageLine({ basicSalary: Number(employee.basicSalary), unpaidLeaveDays, bonus, incentive });
    payrollLines.push({
      id: `line-${inHouseRunId}-${employee.id}`,
      payrollRunId: inHouseRunId,
      contractWorkerId: null,
      inHouseEmployeeId: employee.id,
      actualPresentDays: "0.00",
      weekOffHoliday: "0.00",
      workingDays: num(30 - unpaidLeaveDays),
      otHours: "0.00",
      basicEarn: num(Number(employee.basicSalary) - result.leaveDeduction),
      hraEarn: "0.00",
      taEarn: "0.00",
      medicalEarn: "0.00",
      ceaEarn: "0.00",
      miscEarn: "0.00",
      otAmount: "0.00",
      incentiveAllowRate: "0.00",
      incentive: num(result.incentive),
      attendAward: "0.00",
      nightCount: "0.00",
      nightAllowance: "0.00",
      otArrear: "0.00",
      grossEarning: num(result.grossEarning),
      pf: num(result.pf),
      esic: num(result.esic),
      employerEsic: "0.00",
      otEsic: "0.00",
      lwf: num(result.lwf),
      advance: "0.00",
      tds: "0.00",
      otherDeduction: "0.00",
      leaveEncashment: "0.00",
      arrears: "0.00",
      bonus: num(result.bonus),
      totalDeduction: num(result.totalDeduction),
      netPayable: num(result.netPayable),
      createdAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
      updatedAt: `${year}-${String(month).padStart(2, "0")}-28T00:00:00.000Z`,
    });
  });
});

export const auditLogs: AuditLog[] = [
  { id: "audit-1", userId: "user-hr", action: "CREATE", entityType: "ContractWorker", entityId: "cw-6", changes: { code: "CW-006", name: "Ravi Shankar" }, createdAt: "2026-07-20T09:14:00.000Z" },
  { id: "audit-2", userId: "user-admin", action: "UPDATE", entityType: "InHouseEmployee", entityId: "ihe-7", changes: { status: "INACTIVE" }, createdAt: "2026-06-20T11:02:00.000Z" },
  { id: "audit-3", userId: "user-hr", action: "IMPORT", entityType: "ContractWorker", entityId: "cw-5", changes: { code: "CW-005" }, createdAt: "2026-05-02T08:40:00.000Z" },
  { id: "audit-4", userId: "user-accountant", action: "CREATE", entityType: "Bill", entityId: "bill-2026-6", changes: null, createdAt: `2026-06-28T10:00:00.000Z` },
  { id: "audit-5", userId: "user-admin", action: "RESTORE", entityType: "Database", entityId: "all", changes: null, createdAt: "2026-04-01T06:00:00.000Z" },
];

export function monthOptions(): { month: number; year: number; label: string }[] {
  return MONTHS.map(({ month, year }) => ({ month, year, label: monthLabel(month, year) }));
}
