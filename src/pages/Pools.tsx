import { useQuery } from '@tanstack/react-query';
import { Server, Cpu } from 'lucide-react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Pool = {
  id: number;
  vendor: string;
  name: string;
  lbStrategy: string;
  enabled: boolean;
};

type Node = {
  id: number;
  poolId: number;
  vendor: string;
  host: string;
  port: number;
  weight: number;
  direction: string;
  enabled: boolean;
  health: 'UP' | 'DOWN' | 'UNKNOWN' | 'DRAINING';
  lastSeen: string | null;
};

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
    UP:       { dot: 'bg-success shadow-[0_0_8px_hsl(var(--success)/0.7)]', text: 'text-success', label: 'ONLINE' },
    DOWN:     { dot: 'bg-destructive',                                       text: 'text-destructive', label: 'OFFLINE' },
    DRAINING: { dot: 'bg-warning',                                           text: 'text-warning', label: 'DRAINING' },
    UNKNOWN:  { dot: 'bg-muted-foreground animate-pulse',                    text: 'text-muted-foreground', label: 'PROBING' },
  };
  const s = map[health] ?? map.UNKNOWN;
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs font-medium', s.text)}>
      <span className={cn('w-2 h-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export default function Pools() {
  const pools = useQuery<Pool[]>({
    queryKey: ['pools'],
    queryFn: () => api.get('/pools').then((r) => r.data),
    refetchInterval: 5000,
  });
  const hsms = useQuery<Node[]>({
    queryKey: ['hsms'],
    queryFn: () => api.get('/hsms').then((r) => r.data),
    refetchInterval: 5000,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HSM Pools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendor-specific pools and individual node health · refreshes every 5s.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(pools.data ?? []).map((p) => {
            const poolNodes = (hsms.data ?? []).filter((n) => n.poolId === p.id);
            const upCount = poolNodes.filter((n) => n.health === 'UP').length;
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
                        <CardDescription className="text-xs">
                          {p.vendor} · {p.lbStrategy}
                        </CardDescription>
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
                </TableRow>
              ))}
              {hsms.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Cpu className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    No HSM nodes registered.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
