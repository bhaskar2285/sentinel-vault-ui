import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { keysApi } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const KEY_TYPES = ['ZPK', 'ZMK', 'TMK', 'TPK', 'TAK', 'BDK', 'KBPK', 'PVK', 'CVK', 'MAC'];
const HASH_IDS = [
  { v: '01', label: 'SHA-1' },
  { v: '02', label: 'SHA-224' },
  { v: '03', label: 'SHA-256' },
  { v: '04', label: 'SHA-384' },
  { v: '05', label: 'SHA-512' },
];

export default function KeyImport() {
  const nav = useNavigate();
  const [label, setLabel] = useState('');
  const [keyType, setKeyType] = useState('ZPK');
  const [wrappingPublicKey, setWpk] = useState('');
  const [wrappedKey, setWk] = useState('');
  const [mode, setMode] = useState('0');
  const [hashId, setHashId] = useState('01');
  const [usage, setUsage] = useState('ENCRYPT,DECRYPT');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim()) return toast.error('Label required');
    if (!wrappingPublicKey.trim() || !wrappedKey.trim())
      return toast.error('Both keys (hex) required');
    setBusy(true);
    try {
      const r = await keysApi.importRsaWrapped({
        label,
        wrappingPublicKey: wrappingPublicKey.replace(/\s+/g, ''),
        wrappedKey: wrappedKey.replace(/\s+/g, ''),
        mode,
        hashId,
        keyType,
        usage,
      });
      if (r.status === 'OK') {
        toast.success(`Imported · ${r.keyId.slice(0, 8)}…`);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Import Key under RSA Public</h1>
          <p className="text-sm text-muted-foreground">
            Thales <Badge variant="outline" className="font-mono text-[10px] mx-1">GI</Badge>
            <span className="font-mono">→</span>
            <Badge variant="outline" className="font-mono text-[10px] mx-1">GJ</Badge>
            <span className="text-xs">— payShield 10K spec p.182</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wrapped key payload</CardTitle>
          <CardDescription>
            Symmetric key encrypted under an RSA public key (PKCS#1 v1.5 or OAEP).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="zpk-prod-01"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Key type</Label>
            <Select value={keyType} onValueChange={setKeyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KEY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 — RSA</SelectItem>
                  <SelectItem value="1">1 — RSA-OAEP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hash ID</Label>
              <Select value={hashId} onValueChange={setHashId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HASH_IDS.map((h) => (
                    <SelectItem key={h.v} value={h.v}>
                      <span className="font-mono text-xs mr-2 text-muted-foreground">{h.v}</span>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Wrapping public key (hex · DER SubjectPublicKeyInfo)</Label>
            <Textarea
              value={wrappingPublicKey}
              onChange={(e) => setWpk(e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="30820122300D06092A864886F70D01010105000382010F00…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Wrapped key (hex · RSA-encrypted symmetric key)</Label>
            <Textarea
              value={wrappedKey}
              onChange={(e) => setWk(e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="AABBCCDDEEFF00112233445566778899…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usage">Usage (CSV)</Label>
            <Input
              id="usage"
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => nav('/keys')}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !label}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
