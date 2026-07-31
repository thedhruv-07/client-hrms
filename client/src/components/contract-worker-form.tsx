import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contractWorkerSchema, type ContractWorkerFormValues } from "@/lib/validation/contractWorker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContractWorker } from "@/types";

interface ContractWorkerFormProps {
  defaultValues?: Partial<ContractWorkerFormValues>;
  existingCodes: string[];
  currentCode?: string;
  onSubmit: (values: ContractWorkerFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ContractWorkerForm({ defaultValues, existingCodes, currentCode, onSubmit, onCancel, submitLabel = "Save" }: ContractWorkerFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContractWorkerFormValues>({
    resolver: zodResolver(contractWorkerSchema),
    defaultValues: { code: "", name: "", basicSalary: 0, ...defaultValues },
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
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
    basicSalary: Number(worker.basicSalary),
    bankAccount: worker.bankAccount ?? "",
    ifsc: worker.ifsc ?? "",
    pfNo: worker.pfNo ?? "",
    esicNo: worker.esicNo ?? "",
    uan: worker.uan ?? "",
  };
}
