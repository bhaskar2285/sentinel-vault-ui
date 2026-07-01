import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, ArrowDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { keysApi, lunaApi, type KeySummary } from '@/api/keys';

export default function LunaCrypto() {
  const [deks, setDeks] = useState<KeySummary[]>([]);
  const [keyId, setKeyId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ kind: 'ciphertext' | 'plaintext'; value: string } | null>(null);

  useEffect(() => {
    // Luna DEKs: ZMK-wrapped (keyType DATA) + TR-31-wrapped (keyType TR31_BLOCK), both usable for crypto.
    Promise.all([
      keysApi.list({ keyType: 'DATA', bankScope: 'ALL' }),
      keysApi.list({ keyType: 'TR31_BLOCK', bankScope: 'ALL' }),
    ])
      .then(([data, blocks]) =>
        setDeks([...data, ...blocks].filter((k) => k.vendorOrigin === 'luna')))
      .catch(() => {});
  }, []);

  const run = async (mode: 'encrypt' | 'decrypt') => {
    if (!keyId) return toast.error('Select a Luna DEK');
    const data = input.trim().replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(data) || data.length % 2 !== 0) return toast.error('Enter even-length hex');
    // transformation follows the selected key's algorithm (AES vs 3DES)
    const sel = deks.find((k) => k.keyId === keyId);
    const transformation = sel?.algo === 'AES' ? 'AES/ECB/NoPadding' : 'DESede/ECB/NoPadding';
    setBusy(true); setOut(null);
    try {
      const r = mode === 'encrypt'
        ? await lunaApi.encrypt({ keyId, data, transformation })
        : await lunaApi.decrypt({ keyId, data, transformation });
      if (r.errCode === '00') {
        const value = (mode === 'encrypt' ? (r as any).ciphertext : (r as any).plaintext) ?? '';
        setOut({ kind: mode === 'encrypt' ? 'ciphertext' : 'plaintext', value });
        toast.success(`${mode === 'encrypt' ? 'Encrypted' : 'Decrypted'} inside the HSM`);
      } else toast.error(`${mode} failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? `${mode} failed`);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Luna Data Encrypt / Decrypt</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Luna <Badge variant="outline" className="font-mono text-[10px] mx-1">PKCS#11</Badge>
          — the DEK is unwrapped under its ZMK <strong>inside the Luna HSM</strong> for each operation,
          used, then destroyed. The clear DEK never leaves the module.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Block crypto</CardTitle>
          <CardDescription>Select a registered Luna DEK and enter a hex block (3DES/ECB = 8 or 16 bytes).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>DEK</Label>
            <Select value={keyId} onValueChange={setKeyId}>
              <SelectTrigger><SelectValue placeholder="Select a Luna DEK" /></SelectTrigger>
              <SelectContent>
                {deks.map((k) => (
                  <SelectItem key={k.keyId} value={k.keyId}>
                    {k.label} · {k.keyType === 'TR31_BLOCK' ? `TR-31/${k.algo}` : 'ZMK-wrapped'}
                    {k.kcv ? ` (KCV ${k.kcv})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {deks.length === 0 && (
              <p className="text-xs text-muted-foreground">No Luna DEKs yet — import one under a ZMK first.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Input (hex)</Label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="00112233445566778899AABBCCDDEEFF"
              className="font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => run('encrypt')} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Encrypt
            </Button>
            <Button variant="secondary" onClick={() => run('decrypt')} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
              Decrypt
            </Button>
          </div>

          {out && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDown className="h-3 w-3" /> {out.kind}
              </p>
              <p className="font-mono text-sm break-all">{out.value}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
