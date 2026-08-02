import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompany, updateCompany } from "@/services/company";
import { listUsers } from "@/services/users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ROLE_LABELS } from "@/constants/roles";
import { toast } from "@/hooks/use-toast";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Address is required"),
  mobile: z.string().optional(),
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  gstNo: z.string().optional(),
  panNo: z.string().optional(),
  pfCode: z.string().optional(),
  esiCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  branch: z.string().optional(),
});
type CompanyFormValues = z.infer<typeof companySchema>;

function CompanySettingsForm() {
  const queryClient = useQueryClient();
  const { data: companyData, isLoading } = useQuery({ queryKey: ["company"], queryFn: getCompany });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<CompanyFormValues>({ resolver: zodResolver(companySchema), defaultValues: { name: "", address: "" } });

  useEffect(() => {
    if (companyData) {
      reset({
        name: companyData.name,
        address: companyData.address,
        mobile: companyData.mobile ?? "",
        email: companyData.email ?? "",
        gstNo: companyData.gstNo ?? "",
        panNo: companyData.panNo ?? "",
        pfCode: companyData.pfCode ?? "",
        esiCode: companyData.esiCode ?? "",
        bankName: companyData.bankName ?? "",
        bankAccount: companyData.bankAccount ?? "",
        ifsc: companyData.ifsc ?? "",
        branch: companyData.branch ?? "",
      });
    }
  }, [companyData, reset]);

  async function onSubmit(values: CompanyFormValues) {
    await updateCompany(values);
    await queryClient.invalidateQueries({ queryKey: ["company"] });
    toast({ title: "Company profile saved" });
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-xs text-muted">These details populate the header of every wage register, bill, and salary slip export.</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Company Name</Label>
          <Input id="name" {...register("name")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" className="figure" {...register("mobile")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" {...register("address")} />
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pfCode">PF Code</Label>
          <Input id="pfCode" className="figure" {...register("pfCode")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="esiCode">ESI Code</Label>
          <Input id="esiCode" className="figure" {...register("esiCode")} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input id="bankName" {...register("bankName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankAccount">Bank Account</Label>
          <Input id="bankAccount" className="figure" {...register("bankAccount")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ifsc">IFSC</Label>
          <Input id="ifsc" className="figure" {...register("ifsc")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch">Branch</Label>
        <Input id="branch" {...register("branch")} />
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function UsersTable() {
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: listUsers });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={3}>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
              </TableRow>
            ))
          : (users ?? []).map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell className="figure text-muted">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="accent">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Company profile and user access</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>The contractor's own letterhead details.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompanySettingsForm />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Users &amp; Roles</CardTitle>
          <CardDescription>Read-only in this build — user management isn't wired up yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable />
        </CardContent>
      </Card>
    </div>
  );
}
