import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, MapPin, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Bank {
  recId: number;
  code: string;
  name: string;
  fiid?: string;
  shortCode?: string;
  isDefault?: string;
  loginMethodType: string;
  permissionMethodType: string;
  ldapIp?: string;
  ldapPort?: number;
  baseDn?: string;
  searchBaseDn?: string;
  countryIso2?: string;
  swiftBic?: string;
  recordStatus: string;
}

interface Branch {
  recId: number;
  bankRecId: number;
  code: string;
  name: string;
  city?: string;
  region?: string;
  countryIso2?: string;
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

export default function AdminBanks() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Bank>>({
    loginMethodType: 'DB',
    permissionMethodType: 'DB',
  });

  const banks = useQuery<Bank[]>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get('/admin/banks')).data,
  });

  const branches = useQuery<Branch[]>({
    queryKey: ['admin', 'banks', selected, 'branches'],
    queryFn: async () => (await api.get(`/admin/banks/${selected}/branches`)).data,
    enabled: !!selected,
  });

  const createBank = useMutation({
    mutationFn: async (b: Partial<Bank>) => (await api.post('/admin/banks', b)).data,
    onSuccess: () => {
      toast.success('Bank created');
      qc.invalidateQueries({ queryKey: ['admin', 'banks'] });
      setDraft({ loginMethodType: 'DB', permissionMethodType: 'DB' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'create failed'),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Banks & Branches</h1>
          <p className="text-sm text-muted-foreground">
            ISC FIID master · per-bank auth method (DB / LDAP / MSAD / OIDC).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existing banks */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Existing
          </h2>
          {banks.isLoading && (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          )}
          <div className="space-y-2">
            {banks.data?.map((b) => (
              <Card
                key={b.recId}
                className={cn(
                  'cursor-pointer transition-colors',
                  selected === b.recId ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
                )}
                onClick={() => setSelected(b.recId)}
              >
                <CardContent className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium text-sm truncate">{b.name}</div>
                    <Badge variant="outline" className="font-mono text-[10px]">{b.code}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                    <span>FIID {b.fiid ?? '—'}</span>
                    <span>·</span>
                    <Badge variant="secondary" className="text-[9px] font-mono">{b.loginMethodType}</Badge>
                    <span>·</span>
                    <span>{b.countryIso2 ?? '—'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Create bank */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create new bank
            </CardTitle>
            <CardDescription>FIID and auth method are required at create time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Code"         value={draft.code}        onChange={(v) => setDraft({ ...draft, code: v })}        placeholder="KBANK" />
              <FieldInput label="Name"         value={draft.name}        onChange={(v) => setDraft({ ...draft, name: v })}        placeholder="Kasikorn Bank" />
              <FieldInput label="FIID"         value={draft.fiid}        onChange={(v) => setDraft({ ...draft, fiid: v })}        placeholder="0000000004" />
              <FieldInput label="Short"        value={draft.shortCode}   onChange={(v) => setDraft({ ...draft, shortCode: v })}   placeholder="KBANK" />
              <FieldInput label="Country ISO2" value={draft.countryIso2} onChange={(v) => setDraft({ ...draft, countryIso2: v })} placeholder="TH" />
              <FieldInput label="SWIFT BIC"    value={draft.swiftBic}    onChange={(v) => setDraft({ ...draft, swiftBic: v })}    placeholder="KASITHBK" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Auth method</Label>
              <Select
                value={draft.loginMethodType ?? 'DB'}
                onValueChange={(v) => setDraft({ ...draft, loginMethodType: v })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DB">DB · bcrypt</SelectItem>
                  <SelectItem value="LDAP">LDAP bind</SelectItem>
                  <SelectItem value="MSAD">Active Directory</SelectItem>
                  <SelectItem value="OIDC">OIDC · Phase 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(draft.loginMethodType === 'LDAP' || draft.loginMethodType === 'MSAD') && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t pt-3">
                <FieldInput label="LDAP IP"   value={draft.ldapIp}              onChange={(v) => setDraft({ ...draft, ldapIp: v })} />
                <FieldInput label="LDAP Port" value={draft.ldapPort?.toString()} onChange={(v) => setDraft({ ...draft, ldapPort: Number(v) || undefined })} />
                <FieldInput label="Base DN"   value={draft.baseDn}              onChange={(v) => setDraft({ ...draft, baseDn: v })} />
                <FieldInput label="Search DN" value={draft.searchBaseDn}        onChange={(v) => setDraft({ ...draft, searchBaseDn: v })} />
              </div>
            )}

            <Button
              onClick={() => createBank.mutate(draft)}
              disabled={!draft.code || !draft.name || createBank.isPending}
              className="w-full"
            >
              {createBank.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createBank.isPending ? 'Creating…' : 'Create bank'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Branches */}
      {selected && (
        <div className="space-y-3 border-t pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              Branches of {banks.data?.find((b) => b.recId === selected)?.name}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-xs h-7">
              ✕ Clear
            </Button>
          </div>
          {branches.data?.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No branches.
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.data?.map((br) => (
              <Card key={br.recId}>
                <CardContent className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium text-sm truncate">{br.name}</div>
                    <Badge variant="outline" className="font-mono text-[10px]">{br.code}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {br.city ?? '—'} · {br.region ?? '—'} · {br.countryIso2 ?? '—'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
