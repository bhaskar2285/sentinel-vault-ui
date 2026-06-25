import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Search, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { keysApi, KeySummary } from '@/api/keys';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface BankStub { recId: number; code: string; name: string }

// "Command" = the key type / family used to generate the key (A0/EI/B4 produce these).
const KEY_TYPES = ['RSA', 'AES', '3DES', 'ZMK', 'ZPK', 'TMK', 'TPK', 'KBPK', 'BDK', 'PVK', 'CVK'];

const KEY_TYPE_HINTS: Record<string, string> = {
  RSA: 'Asymmetric key pair (EI command).',
  ZMK: 'Zone Master Key — wraps other keys during exchange.',
  ZPK: 'Zone PIN Key — encrypts PIN blocks.',
  TMK: 'Terminal Master Key — root key in ATM/POS.',
  TPK: 'Terminal PIN Key — encrypts PINs at the terminal.',
  BDK: 'Base Derivation Key — DUKPT master.',
  KBPK: 'Key Block Protection Key — TR-31 wrap KEK.',
  PVK: 'PIN Verification Key — validates cardholder PINs.',
  CVK: 'Card Verification Key — CVV1/CVV2.',
  AES: 'AES symmetric key.',
  '3DES': 'Triple-DES symmetric key.',
  DATA: 'Generic data key under LMK.',
};

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'ACTIVE') return 'default';
  if (s === 'REVOKED' || s === 'EXPIRED') return 'destructive';
  return 'secondary';
}

export default function Locate() {
  const nav = useNavigate();
  const [label, setLabel] = useState('');
  const [keyType, setKeyType] = useState('');
  const [bank, setBank] = useState<'ALL' | number>('ALL');

  const { data: banks = [] } = useQuery<BankStub[]>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get('/admin/banks')).data,
  });
  const bankLabel = (id?: number) => {
    if (!id) return null;
    const b = banks.find((x) => x.recId === id);
    return b ? b.code : `#${id}`;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['keys', label, keyType, bank],
    queryFn: () => keysApi.list({
      label: label || undefined,
      keyType: keyType || undefined,
      bankScope: bank,
    }),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Key Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All keys held under LMK · {data?.length ?? 0}{' '}
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

      {/* retrieve by: key tag · command (type) · bank */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Search by key tag (label)…"
            className="pl-9"
          />
        </div>
        <Select value={keyType || 'ALL'} onValueChange={(v) => setKeyType(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All commands" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All commands</SelectItem>
            {KEY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={bank === 'ALL' ? 'ALL' : String(bank)}
          onValueChange={(v) => setBank(v === 'ALL' ? 'ALL' : Number(v))}
        >
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All banks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All banks</SelectItem>
            {banks.map((b) => (
              <SelectItem key={b.recId} value={String(b.recId)}>{b.code} — {b.name}</SelectItem>
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

      {!isLoading && data && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Algo</TableHead>
                <TableHead>Bits</TableHead>
                <TableHead>KCV</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((k: KeySummary) => (
                <TableRow
                  key={k.keyId}
                  className="cursor-pointer"
                  onClick={() => nav(`/keys/${k.keyId}`)}
                >
                  <TableCell className="font-medium text-primary">{k.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]" title={KEY_TYPE_HINTS[k.keyType] ?? ''}>
                      {k.keyType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{k.algo}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{k.keyLengthBits}</TableCell>
                  <TableCell className="font-mono text-xs">{k.kcv ?? '—'}</TableCell>
                  <TableCell>
                    {k.bankRecId
                      ? <Badge variant="secondary" className="text-[10px]">{bankLabel(k.bankRecId)}</Badge>
                      : <span className="text-muted-foreground text-xs">global</span>}
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(k.status)} className="text-[10px]">{k.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    {new Date(k.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                    <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    No keys match. Adjust the tag, command, or bank filter — or generate a key.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
