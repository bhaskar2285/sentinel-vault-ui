import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditRow {
  id: number;
  ts: string;
  userId: string;
  op: string;
  vendor: string;
  hsmNodeId: number | null;
  latencyMs: number | null;
  status: string;
  errCode: string;
  errText: string;
  requestHash: string;
  responseHash: string;
  traceId: string;
}

interface Page<T> { content: T[]; totalElements: number; number: number; size: number; }

const SIZE = 25;

export default function Audit() {
  const [op, setOp]         = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');
  const [page, setPage]     = useState(0);

  const { data, isLoading, refetch } = useQuery<Page<AuditRow>>({
    queryKey: ['audit', op, userId, status, vendor, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, size: SIZE };
      if (op)     params.op = op;
      if (userId) params.userId = userId;
      if (status) params.status = status;
      if (vendor) params.vendor = vendor;
      const r = await api.get('/audit', { params });
      return r.data;
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            SHA-256 request/response fingerprints · raw bytes never persisted.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="space-y-1.5">
            <Label htmlFor="op">Op</Label>
            <Input
              id="op"
              value={op}
              onChange={(e) => setOp(e.target.value)}
              placeholder="RSA_KEY_GEN…"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="userId">User</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="loginname"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status || 'ALL'} onValueChange={(v) => setStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OK">OK</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="TIMEOUT">TIMEOUT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={vendor || 'ALL'} onValueChange={(v) => setVendor(v === 'ALL' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="THALES">THALES</SelectItem>
                <SelectItem value="UTIMACO">UTIMACO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={() => { setPage(0); refetch(); }}>
          <Search className="mr-1.5 h-3.5 w-3.5" /> Search
        </Button>
      </Card>

      {isLoading && (
        <div className="text-muted-foreground text-sm">Loading…</div>
      )}

      {data && (
        <>
          <div className="text-xs text-muted-foreground">{data.totalElements.toLocaleString()} rows</div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Op</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Err</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Req hash</TableHead>
                  <TableHead>Resp hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.content.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.ts}</TableCell>
                    <TableCell className="text-xs">{r.userId}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[10px]">{r.op}</Badge></TableCell>
                    <TableCell className="text-xs">{r.vendor}</TableCell>
                    <TableCell className="font-mono text-xs">{r.hsmNodeId}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'OK' ? 'default' : 'destructive'} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.errCode}</TableCell>
                    <TableCell className="font-mono text-xs">{r.latencyMs}ms</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground" title={r.requestHash}>
                      {r.requestHash?.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground" title={r.responseHash}>
                      {r.responseHash?.slice(0, 12)}…
                    </TableCell>
                  </TableRow>
                ))}
                {data.content.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                      No audit entries match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              page {page + 1} of {Math.max(1, Math.ceil(data.totalElements / SIZE))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * SIZE >= (data?.totalElements ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
