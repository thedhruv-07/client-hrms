import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listClients, createClient, updateClient } from "@/services/clients";
import type { Client } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { ClientForm, clientToDefaults } from "@/components/client-form";
import { toast } from "@/hooks/use-toast";

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted">Companies billed for contract labour</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Client
        </Button>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>GST No.</TableHead>
              <TableHead>PAN No.</TableHead>
              <TableHead>HSN/SAC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : (clients ?? []).map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelected(client);
                      setEditMode(false);
                    }}
                  >
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.address}</TableCell>
                    <TableCell className="figure">{client.gstNo ?? "—"}</TableCell>
                    <TableCell className="figure">{client.panNo ?? "—"}</TableCell>
                    <TableCell className="figure">{client.hsnSac ?? "—"}</TableCell>
                  </TableRow>
                ))}
            {!isLoading && (clients ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted">
                  No clients yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Add Client */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
          </DialogHeader>
          <ClientForm
            onCancel={() => setAddOpen(false)}
            onSubmit={async (values) => {
              try {
                await createClient(values);
                await invalidate();
                setAddOpen(false);
                toast({ title: "Client added", description: `${values.name} was created.` });
              } catch (err) {
                toast({ title: "Could not add client", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
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
                  <DrawerTitle>Edit Client</DrawerTitle>
                </DrawerHeader>
                <ClientForm
                  defaultValues={clientToDefaults(selected)}
                  submitLabel="Save changes"
                  onCancel={() => setEditMode(false)}
                  onSubmit={async (values) => {
                    try {
                      const updated = await updateClient(selected.id, values);
                      await invalidate();
                      setSelected(updated);
                      setEditMode(false);
                      toast({ title: "Client updated" });
                    } catch (err) {
                      toast({ title: "Could not update client", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                    }
                  }}
                />
              </>
            ) : (
              <>
                <DrawerHeader>
                  <DrawerTitle>{selected.name}</DrawerTitle>
                </DrawerHeader>
                <dl className="flex flex-1 flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Address</dt>
                    <dd className="text-right">{selected.address}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">GST No.</dt>
                    <dd className="figure">{selected.gstNo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">PAN No.</dt>
                    <dd className="figure">{selected.panNo ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">HSN/SAC</dt>
                    <dd className="figure">{selected.hsnSac ?? "—"}</dd>
                  </div>
                </dl>
                <DrawerFooter>
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
