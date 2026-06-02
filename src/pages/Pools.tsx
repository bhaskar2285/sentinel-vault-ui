import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Cpu, Plus, Pencil, Trash2, Play, Pause, Minus } from 'lucide-react';
import { fleetApi, NodeRequest, HsmNode, Pool } from '@/api/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

function HealthDot({ health, enabled }: { health: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
        DISABLED
      </span>
    );
  }
  const map: Record<string, { dot: string; text: string; label: string }> = {
    UP:       { dot: 'bg-success shadow-[0_0_8px_hsl(var(--success)/0.7)]', text: 'text-success',          label: 'ONLINE'   },
    DOWN:     { dot: 'bg-destructive',                                       text: 'text-destructive',      label: 'OFFLINE'  },
    DRAINING: { dot: 'bg-warning',                                           text: 'text-warning',          label: 'DRAINING' },
    UNKNOWN:  { dot: 'bg-muted-foreground animate-pulse',                    text: 'text-muted-foreground', label: 'PROBING'  },
  };
  const s = map[health] ?? map.UNKNOWN;
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

const EMPTY_FORM: NodeRequest = { host: '', port: 1500, vendor: 'THALES', weight: 1, direction: 'OUTBOUND', enabled: true };

function NodeDialog({
  open, onOpenChange, pools, initial, nodeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pools: Pool[];
  initial?: Partial<NodeRequest & { id: number }>;
  nodeId?: number;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<NodeRequest>({ ...EMPTY_FORM, ...initial });

  const create = useMutation({
    mutationFn: () => fleetApi.createNode(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hsms'] }); onOpenChange(false); },
  });
  const update = useMutation({
    mutationFn: () => fleetApi.updateNode(nodeId!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hsms'] }); onOpenChange(false); },
  });

  const set = (k: keyof NodeRequest, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const busy = create.isPending || update.isPending;
  const err  = (create.error || update.error) as Error | null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    nodeId ? update.mutate() : create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{nodeId ? 'Edit HSM Node' : 'Add HSM Node'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="host">Host / IP</Label>
              <Input id="host" value={form.host} onChange={(e) => set('host', e.target.value)}
                placeholder="192.168.1.50" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" min={1} max={65535}
                value={form.port} onChange={(e) => set('port', Number(e.target.value))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" type="number" min={1} max={100}
                value={form.weight ?? 1} onChange={(e) => set('weight', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vendor">Vendor</Label>
              <Input id="vendor" value={form.vendor ?? 'THALES'}
                onChange={(e) => set('vendor', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pool">Pool</Label>
              <select id="pool"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.poolId ?? pools[0]?.id ?? 1}
                onChange={(e) => set('poolId', Number(e.target.value))}>
                {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-destructive">{err.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Pools() {
  const qc = useQueryClient();

  const pools = useQuery<Pool[]>({
    queryKey: ['pools'],
    queryFn: fleetApi.listPools,
    refetchInterval: 5000,
  });
  const hsms = useQuery<HsmNode[]>({
    queryKey: ['hsms'],
    queryFn: fleetApi.listNodes,
    refetchInterval: 5000,
  });

  const [addOpen,    setAddOpen]    = useState(false);
  const [editNode,   setEditNode]   = useState<HsmNode | null>(null);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);

  const enable  = useMutation({ mutationFn: (id: number) => fleetApi.enableNode(id),  onSuccess: () => qc.invalidateQueries({ queryKey: ['hsms'] }) });
  const disable = useMutation({ mutationFn: (id: number) => fleetApi.disableNode(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['hsms'] }) });
  const drain   = useMutation({ mutationFn: (id: number) => fleetApi.drainNode(id),   onSuccess: () => qc.invalidateQueries({ queryKey: ['hsms'] }) });
  const del     = useMutation({ mutationFn: (id: number) => fleetApi.deleteNode(id),  onSuccess: () => { qc.invalidateQueries({ queryKey: ['hsms'] }); setDeleteId(null); } });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HSM Pools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vendor pools and node socket configuration · refreshes every 5s.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Node
        </Button>
      </div>

      {/* Pool cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(pools.data ?? []).map((p) => {
            const poolNodes = (hsms.data ?? []).filter((n) => n.poolId === p.id);
            const upCount   = poolNodes.filter((n) => n.health === 'UP').length;
            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Server className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{p.name}</CardTitle>
                        <CardDescription className="text-xs">{p.vendor} · {p.lbStrategy}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={upCount === poolNodes.length && upCount > 0 ? 'default' : upCount === 0 ? 'destructive' : 'secondary'}>
                      {upCount}/{poolNodes.length} UP
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Node table */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nodes</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(hsms.data ?? []).map((n) => (
                <TableRow key={n.id}>
                  <TableCell><HealthDot health={n.health} enabled={n.enabled} /></TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{n.vendor}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{n.host}</TableCell>
                  <TableCell className="font-mono text-xs">{n.port}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{n.direction}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{n.weight}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {n.lastSeen ? new Date(n.lastSeen).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"
                        onClick={() => setEditNode(n)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {n.enabled ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-warning" title="Disable"
                          onClick={() => disable.mutate(n.id)}>
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-success" title="Enable"
                          onClick={() => enable.mutate(n.id)}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Drain"
                        onClick={() => drain.mutate(n.id)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete"
                        onClick={() => setDeleteId(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {hsms.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Cpu className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    No HSM nodes registered.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Add dialog */}
      <NodeDialog open={addOpen} onOpenChange={setAddOpen} pools={pools.data ?? []} />

      {/* Edit dialog */}
      {editNode && (
        <NodeDialog
          open={!!editNode}
          onOpenChange={(v) => { if (!v) setEditNode(null); }}
          pools={pools.data ?? []}
          nodeId={editNode.id}
          initial={{ host: editNode.host, port: editNode.port, vendor: editNode.vendor,
                     weight: editNode.weight, direction: editNode.direction,
                     enabled: editNode.enabled, poolId: editNode.poolId }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove HSM node?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the node from the pool. Existing in-flight requests will complete.
              The gateway will stop routing new requests to this node immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && del.mutate(deleteId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
