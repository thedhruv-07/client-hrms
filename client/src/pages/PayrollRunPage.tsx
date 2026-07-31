import { useModule } from "@/hooks/useModule";
import { usePeriod } from "@/hooks/usePeriod";
import { ContractPayrollGrid } from "@/components/contract-payroll-grid";
import { InHousePayrollGrid } from "@/components/in-house-payroll-grid";

export function PayrollRunPage() {
  const { module } = useModule();
  const { period } = usePeriod();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Payroll Run</h1>
        <p className="text-sm text-muted">
          {module === "CONTRACT" ? "Contract labour wage register" : "In-house employee payroll"} — change month or module from the top bar / sidebar.
        </p>
      </div>

      {module === "CONTRACT" ? <ContractPayrollGrid month={period.month} year={period.year} /> : <InHousePayrollGrid month={period.month} year={period.year} />}
    </div>
  );
}
