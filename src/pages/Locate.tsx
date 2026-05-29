import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, KeyRound, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { keysApi, KeySummary } from '@/api/keys';
import { api } from '@/api/client';
import { useSession } from '@/store/session';

interface BankStub { recId: number; code: string; name: string }
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const KEY_TYPES = ['RSA', 'AES', '3DES', 'ZMK', 'ZPK', 'TMK', 'TPK', 'KBPK', 'BDK', 'PVK', 'CVK', 'BDK'];

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'REVOKED' || status === 'EXPIRED') return 'destructive';
  return 'secondary';
}

function formatHex(hex: string | undefined): string {
  if (!hex) return '';
  const upper = hex.toUpperCase();
  return upper.match(/.{1,32}/g)?.join('\n') ?? upper;
}

function KeyCard({ k, bankCode }: { k: KeySummary; bankCode?: string }) {
  const hex = k.encryptedBlobHex;
  const len = k.encryptedBlobLen ?? (hex ? hex.length / 2 : undefined);

  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors">
      <CardContent className="p-0">
        <Link to={`/keys/${k.keyId}`} className="block">
          {/* header row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
            <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{k.label}</span>
                <Badge variant="outline" className="font-mono text-[10px] px-1.5 h-[18px]">
                  {k.keyType}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-mono">
                <span>{k.algo}</span>
                <span>·</span>
                <span>{k.keyLengthBits} bits</span>
                {k.vendorOrigin && <><span>·</span><span>{k.vendorOrigin}</span></>}
                {k.bankRecId && <><span>·</span><span>{bankCode ?? `#${k.bankRecId}`}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant={statusVariant(k.status)} className="text-[10px]">
                {k.status}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* meta row */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-2 text-[11px]">
            <span className="text-muted-foreground">KCV</span>
            <span className="font-mono text-foreground">
              {k.kcv ?? <span className="text-muted-foreground">—</span>}
            </span>
            <span className="text-muted-foreground">Created</span>
            <span className="font-mono text-foreground">
              {new Date(k.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
            </span>
          </div>

          {/* encrypted blob — full hex always visible */}
          <div className="border-t bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Encrypted blob {len !== undefined && <span className="font-mono normal-case tracking-normal">· {len} bytes</span>}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                uuid: {k.keyId}
              </span>
            </div>
            <pre className={cn(
              'font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all',
              hex ? 'text-foreground/80' : 'text-muted-foreground italic'
            )}>
              {hex ? formatHex(hex) : 'no blob material'}
            </pre>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Locate() {
  const [label, setLabel] = useState('');
  const [keyType, setKeyType] = useState('');
  const selectedBankId = useSession((s) => s.selectedBankId);

  const { data: banks = [] } = useQuery<BankStub[]>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get('/admin/banks')).data,
  });
  const bankCode = (id?: number) => {
    if (!id) return undefined;
    const b = banks.find((x) => x.recId === id);
    return b?.code;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['keys', label, keyType, selectedBankId],
    queryFn: () =>
      keysApi.list({
        label: label || undefined,
        keyType: keyType || undefined,
      }),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Key Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All keys held under LMK · scoped to active bank · {data?.length ?? 0}{' '}
            {data?.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/keys/import"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Import</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/keys/new-sym"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Symmetric</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/keys/new"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />RSA</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Search by label…"
            className="pl-9"
          />
        </div>
        <Select value={keyType || 'ALL'} onValueChange={(v) => setKeyType(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {KEY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading keys…
        </div>
      )}

      <div className="space-y-3">
        {data?.map((k) => <KeyCard key={k.keyId} k={k} bankCode={bankCode(k.bankRecId)} />)}
      </div>

      {!isLoading && data?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No keys match. Try a different filter or generate one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
