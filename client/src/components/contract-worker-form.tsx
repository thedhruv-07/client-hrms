import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contractWorkerSchema, type ContractWorkerFormValues } from "@/lib/validation/contractWorker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { Client, ContractWorker } from "@/types";

interface ContractWorkerFormProps {
  defaultValues?: Partial<ContractWorkerFormValues>;
  existingCodes: string[];
  currentCode?: string;
  clients: Client[];
  onSubmit: (values: ContractWorkerFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ContractWorkerForm({ defaultValues, existingCodes, currentCode, clients, onSubmit, onCancel, submitLabel = "Save" }: ContractWorkerFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContractWorkerFormValues>({
    resolver: zodResolver(contractWorkerSchema),
    defaultValues: { code: "", name: "", clientId: "", ...defaultValues },
  });

  async function handleFormSubmit(values: ContractWorkerFormValues) {
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hra">HRA</Label>
          <Input id="hra" type="number" step="0.01" className="figure" {...register("hra")} />
          {errors.hra ? <p className="text-xs text-danger">{errors.hra.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ta">TA</Label>
          <Input id="ta" type="number" step="0.01" className="figure" {...register("ta")} />
          {errors.ta ? <p className="text-xs text-danger">{errors.ta.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="medicalAllow">Medical Allow.</Label>
          <Input id="medicalAllow" type="number" step="0.01" className="figure" {...register("medicalAllow")} />
          {errors.medicalAllow ? <p className="text-xs text-danger">{errors.medicalAllow.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cea">CEA</Label>
          <Input id="cea" type="number" step="0.01" className="figure" {...register("cea")} />
          {errors.cea ? <p className="text-xs text-danger">{errors.cea.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="miscAllow">Misc. Allow</Label>
          <Input id="miscAllow" type="number" step="0.01" className="figure" {...register("miscAllow")} />
          {errors.miscAllow ? <p className="text-xs text-danger">{errors.miscAllow.message}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fatherHusbandName">Father Name</Label>
          <Input id="fatherHusbandName" {...register("fatherHusbandName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input id="category" {...register("category")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="designation">Designation</Label>
          <Input id="designation" {...register("designation")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientId">Client</Label>
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="clientId">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.clientId ? <p className="text-xs text-danger">{errors.clientId.message}</p> : null}
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
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="uan">UAN</Label>
          <Input id="uan" className="figure" {...register("uan")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" className="figure" {...register("mobile")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aadharNo">Aadhar No.</Label>
          <Input id="aadharNo" className="figure" {...register("aadharNo")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input id="bankName" {...register("bankName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" {...register("dob")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doj">Date of Joining</Label>
          <Input id="doj" type="date" {...register("doj")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register("address")} />
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

export function contractWorkerToDefaults(worker: ContractWorker): ContractWorkerFormValues {
  return {
    code: worker.code,
    name: worker.name,
    fatherHusbandName: worker.fatherHusbandName ?? "",
    category: worker.category ?? "",
    designation: worker.designation ?? "",
    clientId: worker.clientId,
    basicSalary: Number(worker.basicSalary),
    hra: Number(worker.hra),
    ta: Number(worker.ta),
    medicalAllow: Number(worker.medicalAllow),
    cea: Number(worker.cea),
    miscAllow: Number(worker.miscAllow),
    bankAccount: worker.bankAccount ?? "",
    ifsc: worker.ifsc ?? "",
    pfNo: worker.pfNo ?? "",
    esicNo: worker.esicNo ?? "",
    uan: worker.uan ?? "",
    dob: worker.dob ? worker.dob.slice(0, 10) : "",
    doj: worker.doj ? worker.doj.slice(0, 10) : "",
    mobile: worker.mobile ?? "",
    aadharNo: worker.aadharNo ?? "",
    address: worker.address ?? "",
    bankName: worker.bankName ?? "",
  };
}
