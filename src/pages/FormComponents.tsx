import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, Minus, ShieldCheck, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { componentsApi } from '@/api/keys';

// Key types that can be formed from components. Code = the BU/variant key-type the key
// is generated under (also used as the BU KCV key type).
const KEY_TYPES = [
  { v: 'ZMK', label: 'ZMK — Zone Master Key' },
  { v: 'ZPK', label: 'ZPK — Zone PIN Key' },
  { v: 'TMK', label: 'TMK — Terminal Master Key' },
  { v: 'TAK', label: 'TAK — Terminal Auth Key' },
  { v: 'DATA', label: 'DATA — Data Encryption Key' },
  { v: 'KBPK', label: 'KBPK — Key Block Protection Key' },
];

const SCHEMES = [
  { v: 'U', label: 'U — double-length 3DES' },
  { v: 'T', label: 'T — triple-length 3DES' },
];

interface Comp {
  value: string;          // encrypted component, scheme prefix + hex (e.g. U + 32H)
  kcv?: string;
  err?: string;
}

export default function FormComponents() {
  const nav = useNavigate();
  const [keyType, setKeyType] = useState('ZMK');
  const [scheme, setScheme] = useState('U');
  const [label, setLabel] = useState('');
  const [comps, setComps] = useState<Comp[]>([{ value: '' }, { value: '' }, { value: '' }]);
  const [forming, setForming] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);
  const [result, setResult] = useState<{ kcv: string; keyId?: string } | null>(null);

  const setComp = (i: number, v: Partial<Comp>) =>
    setComps((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...v } : c)));

  const addComp = () => comps.length < 9 && setComps((cs) => [...cs, { value: '' }]);
  const delComp = (i: number) =>
    comps.length > 2 && setComps((cs) => cs.filter((_, idx) => idx !== i));

  // BU on a single encrypted component so each custodian can verify their KCV.
  const checkKcv = async (i: number) => {
    const raw = comps[i].value.trim().toUpperCase();
    if (!raw) return toast.error(`Component ${i + 1} is empty`);
    const sch = raw[0]; const hex = raw.slice(1);
    setChecking(i);
    try {
      const r = await componentsApi.checkValueRaw({ keyHex: hex, scheme: sch, keyType });
      if (r.errCode === '00') { setComp(i, { kcv: r.kcv, err: undefined }); toast.success(`Component ${i + 1} KCV ${r.kcv}`); }
      else { setComp(i, { kcv: undefined, err: r.errCode }); toast.error(`Component ${i + 1}: errCode ${r.errCode}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'KCV failed'); }
    finally { setChecking(null); }
  };

  const form = async () => {
    const values = comps.map((c) => c.value.trim()).filter(Boolean);
    if (values.length < 2) return toast.error('Need at least 2 components');
    if (!label.trim()) return toast.error('Enter a vault label for the formed key');
    setForming(true); setResult(null);
    try {
      const r = await componentsApi.form({
        keyType, scheme, components: values, label: label.trim(),
      });
      if (r.errCode === '00') {
        setResult({ kcv: r.kcv, keyId: r.keyId });
        toast.success('Key formed and stored');
      } else toast.error(`Form failed: errCode ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Form failed'); }
    finally { setForming(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Form Key from Components</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Thales <Badge variant="outline" className="font-mono text-[10px] mx-1">A2</Badge> generate ·
          <Badge variant="outline" className="font-mono text-[10px] mx-1">BU</Badge> check value ·
          <Badge variant="outline" className="font-mono text-[10px] mx-1">A4</Badge> combine — each custodian
          supplies a component <strong>encrypted under the LMK</strong>; the HSM XORs them into the final key.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key parameters</CardTitle>
          <CardDescription>
            Components must be encrypted under the LMK (scheme prefix + hex, e.g. <span className="font-mono">U…</span>).
            Clear components can only be entered at the HSM console — they never cross the host link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Key type</Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KEY_TYPES.map((k) => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>LMK scheme</Label>
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEMES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Components ({comps.length})</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addComp} disabled={comps.length >= 9}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add custodian
                </Button>
              </div>
            </div>
            {comps.map((c, i) => (
              <div key={i} className="space-y-1.5 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Custodian {i + 1} — encrypted component</Label>
                  {comps.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => delComp(i)}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={c.value}
                    onChange={(e) => setComp(i, { value: e.target.value, kcv: undefined, err: undefined })}
                    placeholder="U + 32 hex (LMK-encrypted component)"
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => checkKcv(i)} disabled={checking === i}>
                    {checking === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'KCV'}
                  </Button>
                </div>
                {c.kcv && <p className="text-xs font-mono text-emerald-600">KCV {c.kcv}</p>}
                {c.err && <p className="text-xs font-mono text-destructive">errCode {c.err}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Vault label for the formed key</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. zmk-acquirer-2026" />
          </div>

          <Button onClick={form} disabled={forming} className="w-full sm:w-auto">
            {forming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {forming ? 'Forming…' : 'Form key (A4)'}
          </Button>

          {result && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Key formed &amp; stored
              </p>
              <p className="text-sm">Final KCV: <span className="font-mono">{result.kcv}</span></p>
              {result.keyId && (
                <Button variant="outline" size="sm" onClick={() => nav(`/keys/${result.keyId}`)}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Open key in vault
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
