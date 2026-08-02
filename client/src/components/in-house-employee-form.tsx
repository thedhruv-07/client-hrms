import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inHouseEmployeeSchema, type InHouseEmployeeFormValues } from "@/lib/validation/inHouseEmployee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InHouseEmployee } from "@/types";

interface InHouseEmployeeFormProps {
  defaultValues?: Partial<InHouseEmployeeFormValues>;
  existingCodes: string[];
  currentCode?: string;
  onSubmit: (values: InHouseEmployeeFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function InHouseEmployeeForm({ defaultValues, existingCodes, currentCode, onSubmit, onCancel, submitLabel = "Save" }: InHouseEmployeeFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InHouseEmployeeFormValues>({
    resolver: zodResolver(inHouseEmployeeSchema),
    defaultValues: {
      code: "",
      name: "",
      fatherHusbandName: "",
      department: "",
      designation: "",
      location: "",
      joiningDate: "",
      paymentMode: "",
      ...defaultValues,
    },
  });

  async function handleFormSubmit(values: InHouseEmployeeFormValues) {
    if (values.code !== currentCode && existingCodes.includes(values.code)) {
      setError("code", { message: "This code is already in use" });
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Code</Label>
          <Input id="code" className="figure" {...register("code")} />
          {errors.code ? <p className="text-xs text-danger">{errors.code.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basicSalary">Basic Salary</Label>
          <Input id="basicSalary" type="number" step="0.01" className="figure" {...register("basicSalary")} />
          {errors.basicSalary ? <p className="text-xs text-danger">{errors.basicSalary.message}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="department">Department</Label>
          <Input id="department" {...register("department")} />
          {errors.department ? <p className="text-xs text-danger">{errors.department.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="designation">Designation</Label>
          <Input id="designation" {...register("designation")} />
          {errors.designation ? <p className="text-xs text-danger">{errors.designation.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="joiningDate">Joining Date</Label>
          <Input id="joiningDate" type="date" className="figure" {...register("joiningDate")} />
          {errors.joiningDate ? <p className="text-xs text-danger">{errors.joiningDate.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leaveBalance">Leave Balance</Label>
          <Input id="leaveBalance" type="number" step="0.5" className="figure" {...register("leaveBalance")} />
          {errors.leaveBalance ? <p className="text-xs text-danger">{errors.leaveBalance.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankAccount">Bank Account</Label>
          <Input id="bankAccount" className="figure" {...register("bankAccount")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ifsc">IFSC</Label>
          <Input id="ifsc" className="figure" {...register("ifsc")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pfNo">PF No.</Label>
          <Input id="pfNo" className="figure" {...register("pfNo")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="esicNo">ESIC No.</Label>
          <Input id="esicNo" className="figure" {...register("esicNo")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uan">UAN</Label>
        <Input id="uan" className="figure" {...register("uan")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fatherHusbandName">Father / Husband Name</Label>
          <Input id="fatherHusbandName" {...register("fatherHusbandName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="Deployment site / client" {...register("location")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentMode">Payment Mode</Label>
        <Input id="paymentMode" placeholder="Bank Transfer / Cash" {...register("paymentMode")} />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function inHouseEmployeeToDefaults(employee: InHouseEmployee): InHouseEmployeeFormValues {
  return {
    code: employee.code,
    name: employee.name,
    fatherHusbandName: employee.fatherHusbandName ?? "",
    basicSalary: Number(employee.basicSalary),
    department: employee.department,
    designation: employee.designation,
    location: employee.location ?? "",
    joiningDate: employee.joiningDate.slice(0, 10),
    leaveBalance: Number(employee.leaveBalance),
    paymentMode: employee.paymentMode ?? "",
    bankAccount: employee.bankAccount ?? "",
    ifsc: employee.ifsc ?? "",
    pfNo: employee.pfNo ?? "",
    esicNo: employee.esicNo ?? "",
    uan: employee.uan ?? "",
  };
}
