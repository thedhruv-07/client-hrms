import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Plus, Search, ArrowUpDown, Upload, Download } from "lucide-react";
import { listContractWorkers, createContractWorker, updateContractWorker, deactivateContractWorker, importContractWorkers } from "@/services/contractWorkers";
import { listClients } from "@/services/clients";
import type { ContractWorker } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ContractWorkerForm, contractWorkerToDefaults } from "@/components/contract-worker-form";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyPrecise } from "@/lib/format";
import { parseWorkerWorkbook } from "@/lib/workerImport";
import { downloadWorkerDetailsSheet } from "@/lib/exportExcel";

export function WorkersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "code", desc: false }]);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ContractWorker | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importClientId, setImportClientId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onFocusSearch: () => searchRef.current?.focus(),
    onNew: () => setAddOpen(true),
  });

  const { data: workers, isLoading } = useQuery({
    queryKey: ["contract-workers", search, clientFilter, statusFilter],
    queryFn: () =>
      listContractWorkers(
        search || undefined,
        clientFilter === "all" ? undefined : clientFilter,
        statusFilter === "all" ? undefined : (statusFilter as "ACTIVE" | "INACTIVE")
      ),
  });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["contract-workers"] });
  }

  const existingCodes = useMemo(() => (workers ?? []).map((w) => w.code), [workers]);
  const clientName = useCallback((id: string) => clients?.find((c) => c.id === id)?.name ?? "—", [clients]);

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const { csv, rowCount } = await parseWorkerWorkbook(file, importClientId);
      if (rowCount === 0) {
        toast({ title: "No rows found", description: "Couldn't find any rows with a Name column in this sheet.", variant: "destructive" });
        return;
      }
      const result = await importContractWorkers(csv);
      await invalidate();
      const failed = result.results.filter((r) => r.error);
      toast({
        title: `Imported ${result.created} of ${result.total} workers`,
        description: failed.length > 0 ? `Row ${failed[0]!.row}: ${failed[0]!.error}${failed.length > 1 ? ` (+${failed.length - 1} more)` : ""}` : undefined,
        variant: failed.length > 0 ? "destructive" : undefined,
      });
      setImportOpen(false);
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleExportDetails() {
    if (!workers || workers.length === 0) return;
    setExporting(true);
    try {
      const scope = clientFilter === "all" ? "all" : clientName(clientFilter).toLowerCase().replace(/\s+/g, "-");
      await downloadWorkerDetailsSheet(
        workers.map((w) => ({
          code: w.code,
          name: w.name,
          fatherHusbandName: w.fatherHusbandName,
          category: w.category,
          designation: w.designation,
          clientName: clientName(w.clientId),
          basicSalary: Number(w.basicSalary),
          hra: Number(w.hra),
          ta: Number(w.ta),
          medicalAllow: Number(w.medicalAllow),
          cea: Number(w.cea),
          miscAllow: Number(w.miscAllow),
          bankAccount: w.bankAccount,
          ifsc: w.ifsc,
          bankName: w.bankName,
          pfNo: w.pfNo,
          esicNo: w.esicNo,
          uan: w.uan,
          dob: w.dob ? w.dob.slice(0, 10) : null,
          doj: w.doj ? w.doj.slice(0, 10) : null,
          mobile: w.mobile,
          aadharNo: w.aadharNo,
          address: w.address,
          status: w.status,
        })),
        `contract-workers-${scope}.xlsx`
      );
      toast({ title: "Worker details downloaded" });
    } catch (err) {
      toast({ title: "Could not export worker details", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo<ColumnDef<ContractWorker>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Code <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: (info) => <span className="figure">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Name <ArrowUpDown className="size-3" />
          </button>
        ),
      },
      {
        accessorKey: "clientId",
        header: "Client",
        cell: (info) => clientName(info.getValue<string>()),
      },
      {
        accessorKey: "basicSalary",
        header: () => <div className="text-right">Basic Salary</div>,
        cell: (info) => <div className="figure text-right">{formatCurrencyPrecise(Number(info.getValue<string>()))}</div>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => (
          <Badge variant={info.getValue<string>() === "ACTIVE" ? "positive" : "default"}>{info.getValue<string>()}</Badge>
        ),
      },
    ],
    [clientName]
  );

  const table = useReactTable({
    data: workers ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Workers</h1>
          <p className="text-sm text-muted">Contract labour master data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Import from Excel
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add Worker
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input ref={searchRef} placeholder="Search by name or code… (press /)" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {(clients ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExportDetails} disabled={exporting || isLoading || (workers ?? []).length === 0}>
          <Download className="size-4" />
          {exporting ? "Preparing…" : clientFilter === "all" ? "Download All Details" : "Download Details"}
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(row.original);
                      setEditMode(false);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
            {!isLoading && (workers ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted">
                  No workers found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Add Worker */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
          </DialogHeader>
          <ContractWorkerForm
            existingCodes={existingCodes}
            clients={clients ?? []}
            onCancel={() => setAddOpen(false)}
            onSubmit={async (values) => {
              try {
                await createContractWorker(values);
                await invalidate();
                setAddOpen(false);
                toast({ title: "Worker added", description: `${values.name} (${values.code}) was created.` });
              } catch (err) {
                toast({ title: "Could not add worker", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Import from Excel */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportClientId(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Workers from Excel</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-client">Client</Label>
              <Select value={importClientId} onValueChange={setImportClientId}>
                <SelectTrigger id="import-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted">All workers in the sheet will be assigned to this client. Rows with no Code get an auto-generated one.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-file">Excel file</Label>
              <Input
                id="import-file"
                ref={fileRef}
                type="file"
                accept=".xlsx"
                disabled={!importClientId || importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Edit drawer */}
      <Drawer open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent>
          {selected ? (
            editMode ? (
              <>
                <DrawerHeader>
                  <DrawerTitle>Edit Worker</DrawerTitle>
                </DrawerHeader>
                <ContractWorkerForm
                  defaultValues={contractWorkerToDefaults(selected)}
                  currentCode={selected.code}
                  existingCodes={existingCodes}
                  clients={clients ?? []}
                  submitLabel="Save changes"
                  onCancel={() => setEditMode(false)}
                  onSubmit={async (values) => {
                    try {
                      const updated = await updateContractWorker(selected.id, values);
                      await invalidate();
                      setSelected(updated);
                      setEditMode(false);
                      toast({ title: "Worker updated" });
                    } catch (err) {
                      toast({ title: "Could not update worker", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                    }
                  }}
                />
              </>
            ) : (
              <>
                <DrawerHeader>
                  <DrawerTitle>{selected.name}</DrawerTitle>
                  <p className="figure text-sm text-muted">{selected.code}</p>
                </DrawerHeader>
                <dl className="flex flex-1 flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Client</dt>
                    <dd>{clientName(selected.clientId)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Father Name</dt>
                    <dd>{selected.fatherHusbandName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Category</dt>
                    <dd>{selected.category ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Designation</dt>
                    <dd>{selected.designation ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Basic Salary</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.basicSalary))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">HRA</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.hra))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">TA</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.ta))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Medical Allow.</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.medicalAllow))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">CEA</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.cea))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Misc. Allow</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.miscAllow))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Status</dt>
                    <dd>
                      <Badge variant={selected.status === "ACTIVE" ? "positive" : "default"}>{selected.status}</Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Bank Account</dt>
                    <dd className="figure">{selected.bankAccount ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">IFSC</dt>
                    <dd className="figure">{selected.ifsc ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">PF No.</dt>
                    <dd className="figure">{selected.pfNo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">ESIC No.</dt>
                    <dd className="figure">{selected.esicNo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">UAN</dt>
                    <dd className="figure">{selected.uan ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Mobile</dt>
                    <dd className="figure">{selected.mobile ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Aadhar No.</dt>
                    <dd className="figure">{selected.aadharNo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Bank Name</dt>
                    <dd>{selected.bankName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Date of Birth</dt>
                    <dd className="figure">{selected.dob ? selected.dob.slice(0, 10) : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Date of Joining</dt>
                    <dd className="figure">{selected.doj ? selected.doj.slice(0, 10) : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Address</dt>
                    <dd className="text-right">{selected.address ?? "—"}</dd>
                  </div>
                </dl>
                <DrawerFooter>
                  {selected.status === "ACTIVE" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">Deactivate</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deactivate {selected.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This sets the worker's status to inactive. Past payroll history is preserved and unaffected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                const updated = await deactivateContractWorker(selected.id);
                                await invalidate();
                                setSelected(updated);
                                toast({ title: "Worker deactivated" });
                              } catch (err) {
                                toast({ title: "Could not deactivate worker", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                              }
                            }}
                          >
                            Deactivate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                  <Button onClick={() => setEditMode(true)}>Edit</Button>
                </DrawerFooter>
              </>
            )
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
