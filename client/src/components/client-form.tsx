import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormValues } from "@/lib/validation/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/types";

interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ClientForm({ defaultValues, onSubmit, onCancel, submitLabel = "Save" }: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", address: "", gstNo: "", panNo: "", hsnSac: "", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Company Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register("address")} />
        {errors.address ? <p className="text-xs text-danger">{errors.address.message}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gstNo">GST No.</Label>
          <Input id="gstNo" className="figure" {...register("gstNo")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="panNo">PAN No.</Label>
          <Input id="panNo" className="figure" {...register("panNo")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hsnSac">HSN/SAC</Label>
        <Input id="hsnSac" className="figure" {...register("hsnSac")} />
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

export function clientToDefaults(client: Client): ClientFormValues {
  return {
    name: client.name,
    address: client.address,
    gstNo: client.gstNo ?? "",
    panNo: client.panNo ?? "",
    hsnSac: client.hsnSac ?? "",
  };
}
