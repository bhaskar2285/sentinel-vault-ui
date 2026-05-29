import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { keysApi } from '@/api/keys';
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

const USAGE_OPTS = [
  { value: '0', label: 'Signature only',     desc: 'Sign / verify' },
  { value: '1', label: 'Encipherment only',  desc: 'Wrap / unwrap' },
  { value: '2', label: 'Both',               desc: 'Sig + encipher (default)' },
];

export default function KeyCreate() {
  const nav = useNavigate();
  const [label, setLabel] = useState('');
  const [bits, setBits] = useState('2048');
  const [keyType, setKeyType] = useState('2');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim()) return toast.error('Label required');
    setBusy(true);
    try {
      const r = await keysApi.generateRsa({ label, modulusBits: Number(bits), keyType });
      if (r.status === 'OK') {
        toast.success(`Key created · ${r.keyId.slice(0, 8)}…`);
        nav(`/keys/${r.keyId}`);
      } else {
        toast.error(`${r.errCode}: ${r.errText}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate RSA Key Pair</h1>
          <p className="text-sm text-muted-foreground">
            Thales <Badge variant="outline" className="font-mono text-[10px] mx-1">EI</Badge>
            <span className="font-mono">→</span>
            <Badge variant="outline" className="font-mono text-[10px] mx-1">EJ</Badge>
            <span className="text-xs">— stored under LMK, public component returned</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key parameters</CardTitle>
          <CardDescription>All fields tenant-scoped to active bank.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="issuer-pub-2026"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Human-readable identifier. Searchable in Locate.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Modulus length</Label>
            <Select value={bits} onValueChange={setBits}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2048">2048 bits · NIST minimum</SelectItem>
                <SelectItem value="3072">3072 bits · NIST 2030</SelectItem>
                <SelectItem value="4096">4096 bits · long-term archive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Key usage</Label>
            <Select value={keyType} onValueChange={setKeyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USAGE_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="font-mono text-xs mr-2 text-muted-foreground">{o.value}</span>
                    {o.label}
                    <span className="text-muted-foreground text-xs ml-2">· {o.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => nav('/keys')}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !label}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
