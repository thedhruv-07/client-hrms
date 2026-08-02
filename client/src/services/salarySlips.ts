import { api } from "./api";
import { downloadBlob } from "@/lib/exportExcel";
import type { SalarySlipExportData } from "@/lib/exportExcel";

/** Converts the client's nullable fields to the server's optional (undefined, never null) shape. */
function toServerSlip(slip: SalarySlipExportData) {
  return {
    ...slip,
    companyGstNo: slip.companyGstNo ?? undefined,
    fatherHusbandName: slip.fatherHusbandName ?? undefined,
    location: slip.location ?? undefined,
    paymentMode: slip.paymentMode ?? undefined,
    bankAccount: slip.bankAccount ?? undefined,
    ifsc: slip.ifsc ?? undefined,
    pfNo: slip.pfNo ?? undefined,
    esicNo: slip.esicNo ?? undefined,
    uan: slip.uan ?? undefined,
  };
}

export async function downloadSalarySlipPdf(slip: SalarySlipExportData): Promise<void> {
  const blob = await api.postBlob("/salary-slips/pdf", { slips: [toServerSlip(slip)] });
  downloadBlob(blob, `salary-slip-${slip.employeeCode}-${slip.monthLabel.toLowerCase()}.pdf`);
}

export async function downloadSalarySlipsPdfBatch(slips: SalarySlipExportData[], monthLabel: string): Promise<void> {
  const blob = await api.postBlob("/salary-slips/pdf", { slips: slips.map(toServerSlip) });
  downloadBlob(blob, `salary-slips-${monthLabel.toLowerCase()}.pdf`);
}
