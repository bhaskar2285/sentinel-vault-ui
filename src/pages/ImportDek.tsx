import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Download, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { keysApi, lunaApi, type KeySummary } from '@/api/keys';

export default function ImportDek() {
  const nav = useNavigate();
  const [zmks, setZmks] = useState<KeySummary[]>([]);
  const [zmkKeyId, setZmkKeyId] = useState('');
  const [algorithm, setAlgorithm] = useState('DESede');
  const [label, setLabel] = useState('');
  const [dekBlob, setDekBlob] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ kcv?: string; keyId?: string } | null>(null);

  useEffect(() => {
    keysApi.list({ keyType: 'ZMK', bankScope: 'ALL' })
      .then((ks) => setZmks(ks.filter((k) => k.vendorOrigin === 'luna')))
      .catch(() => {});
  }, []);

  const doImport = async () => {
    if (!zmkKeyId) return toast.error('Select the ZMK that wraps this DEK');
    if (!dekBlob.trim()) return toast.error('Paste the DEK ciphertext (wrapped under the ZMK)');
    if (!label.trim()) return toast.error('Enter a vault label for the DEK');
    setImporting(true); setResult(null);
    try {
      const r = await lunaApi.importDek({
        zmkKeyId, dekBlob: dekBlob.trim().replace(/\s+/g, ''), algorithm, label: label.trim(),
      });
      if (r.errCode === '00') {
        setResult({ kcv: r.kcv, keyId: r.keyId });
        toast.success('DEK registered (unwrapped + verified inside the HSM)');
      } else toast.error(`Import failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import DEK under ZMK</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Luna <Badge variant="outline" className="font-mono text-[10px] mx-1">PKCS#11</Badge>
          — the data-encryption key arrives already encrypted under the ZMK. The gateway unwraps it
          <strong> inside the Luna HSM</strong> to verify it; the clear DEK never reaches the host. The
          wrapped blob is stored and re-unwrapped on every encrypt/decrypt.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DEK delivery</CardTitle>
          <CardDescription>Select the wrapping ZMK and paste the DEK ciphertext (hex).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Wrapping ZMK</Label>
              <Select value={zmkKeyId} onValueChange={setZmkKeyId}>
                <SelectTrigger><SelectValue placeholder="Select a ZMK" /></SelectTrigger>
                <SelectContent>
                  {zmks.map((k) => (
                    <SelectItem key={k.keyId} value={k.keyId}>
                      {k.label} {k.kcv ? `(KCV ${k.kcv})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {zmks.length === 0 && (
                <p className="text-xs text-muted-foreground">No Luna ZMKs yet — run the ZMK ceremony first.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>DEK algorithm</Label>
              <Select value={algorithm} onValueChange={setAlgorithm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESede">3DES</SelectItem>
                  <SelectItem value="AES">AES</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>DEK ciphertext (wrapped under ZMK, hex)</Label>
            <Textarea
              value={dekBlob}
              onChange={(e) => setDekBlob(e.target.value)}
              placeholder="hex…"
              className="font-mono text-xs min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vault label for the DEK</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. dek-itmx-1" />
          </div>

          <Button onClick={doImport} disabled={importing} className="w-full sm:w-auto">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {importing ? 'Importing…' : 'Import DEK'}
          </Button>

          {result && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium">DEK registered</p>
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
