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
import { lunaApi } from '@/api/keys';

const ALGOS = [
  { v: 'DESede', label: '3DES (double-length, 16-byte components)' },
  { v: 'AES', label: 'AES (16/32-byte components)' },
];

export default function ZmkCeremony() {
  const nav = useNavigate();
  const [algorithm, setAlgorithm] = useState('DESede');
  const [label, setLabel] = useState('');
  const [comps, setComps] = useState<string[]>(['', '', '']);
  const [forming, setForming] = useState(false);
  const [result, setResult] = useState<{ kcv?: string; keyId?: string } | null>(null);

  const setComp = (i: number, v: string) => setComps((cs) => cs.map((c, idx) => (idx === i ? v : c)));
  const addComp = () => comps.length < 9 && setComps((cs) => [...cs, '']);
  const delComp = (i: number) => comps.length > 2 && setComps((cs) => cs.filter((_, idx) => idx !== i));

  const form = async () => {
    const values = comps.map((c) => c.trim()).filter(Boolean);
    if (values.length < 2) return toast.error('Need at least 2 components');
    if (!label.trim()) return toast.error('Enter a partition label for the ZMK');
    setForming(true); setResult(null);
    try {
      const r = await lunaApi.formZmk({ components: values, algorithm, label: label.trim() });
      if (r.errCode === '00') {
        setResult({ kcv: r.kcv, keyId: r.keyId });
        toast.success('ZMK formed and stored in the Luna partition');
      } else toast.error(`Form failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Form failed');
    } finally { setForming(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ZMK Custodian Ceremony</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Luna <Badge variant="outline" className="font-mono text-[10px] mx-1">PKCS#11</Badge>
          — custodians enter the clear ZMK components; the gateway XORs them into the Zone Master Key
          and stores it as a token object inside the Luna partition (protected by the HSM, never exported).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ZMK parameters</CardTitle>
          <CardDescription>
            Each component is clear hex of equal length. The combined key is held only momentarily in
            memory during this one-time ceremony, then injected into the partition.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Key algorithm</Label>
              <Select value={algorithm} onValueChange={setAlgorithm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALGOS.map((a) => <SelectItem key={a.v} value={a.v}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Partition label for the ZMK</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. zmk-itmx-1" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Clear components ({comps.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addComp} disabled={comps.length >= 9}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add custodian
              </Button>
            </div>
            {comps.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={c}
                  onChange={(e) => setComp(i, e.target.value)}
                  placeholder={`Custodian ${i + 1} — clear hex component`}
                  className="font-mono text-xs"
                />
                {comps.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => delComp(i)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button onClick={form} disabled={forming} className="w-full sm:w-auto">
            {forming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {forming ? 'Forming…' : 'Form ZMK'}
          </Button>

          {result && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> ZMK stored in partition
              </p>
              <p className="text-sm">KCV: <span className="font-mono">{result.kcv}</span></p>
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
