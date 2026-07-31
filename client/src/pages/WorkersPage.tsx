import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { listContractWorkers, createContractWorker, updateContractWorker, deactivateContractWorker } from "@/services/contractWorkers";
import type { ContractWorker } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ContractWorkerForm, contractWorkerToDefaults } from "@/components/contract-worker-form";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyPrecise } from "@/lib/format";

export function WorkersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "code", desc: false }]);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ContractWorker | null>(null);
  const [editMode, setEditMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onFocusSearch: () => searchRef.current?.focus(),
    onNew: () => setAddOpen(true),
  });

  const { data: workers, isLoading } = useQuery({
    queryKey: ["contract-workers", search],
    queryFn: () => listContractWorkers(search || undefined),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["contract-workers"] });
  }

  const existingCodes = useMemo(() => (workers ?? []).map((w) => w.code), [workers]);

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
    []
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
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Worker
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input ref={searchRef} placeholder="Search by name or code… (press /)" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <dt className="text-muted">Basic Salary</dt>
                    <dd className="figure">{formatCurrencyPrecise(Number(selected.basicSalary))}</dd>
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
