import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Fingerprint, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { copyText } from '@/lib/utils';
import { cryptoApi } from '@/api/crypto';
import { keysApi, type KeySummary } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Stored symmetric keys are eligible to key a MAC/HMAC.
const SYM_TYPES = new Set([
  'ZPK', 'ZMK', 'TMK', 'KBPK', 'BDK', 'DATA', 'AES', '3DES', 'HMAC',
  '000', '001', '002', '003', '008', '009', '00A', '00B', '00C', '00D', '00E', '00F', '10F',
  'R', 'S', 'H', 'U', 'T',
]);

function symFilter(keys: KeySummary[]) {
  return keys.filter(
    (k) => SYM_TYPES.has(k.keyType) || (k.keyType?.length === 3 && k.keyType !== 'RSA')
  );
}

function isHex(s: string) {
  const c = s.replace(/\s+/g, '');
  return c.length > 0 && /^[0-9a-fA-F]+$/.test(c) && c.length % 2 === 0;
}

function KeySelect({ value, onChange, keys }: {
  value: string; onChange: (v: string) => void; keys: KeySummary[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
    >
      <option value="">— pick a key —</option>
      {keys.map((k) => (
        <option key={k.keyId} value={k.keyId}>
          {k.label} [{k.keyType}] {k.keyId.slice(0, 8)}…
        </option>
      ))}
    </select>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={() => { copyText(text); toast.success('Copied'); }}>
      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
    </Button>
  );
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2 pt-2">
      <Separator />
      <div className="flex items-center justify-between pt-2">
        <Label className="text-sm">{label}</Label>
        <CopyButton text={value} />
      </div>
      <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  );
}

function errToast(e: any) {
  toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed');
}

// ----------------------------------------------------------------- HMAC
function HmacGenPanel({ keys }: { keys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [data, setData] = useState('');
  const [hashId, setHashId] = useState('06');
  const [hmacLen, setHmacLen] = useState('0020');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    setBusy(true);
    try {
      const r = await cryptoApi.hmacGenerate({ keyId, dataHex: data.replace(/\s+/g, ''), hashId, hmacLen });
      if (r.errCode === '00') { setOut(r.hmac); toast.success('HMAC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e) { errToast(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate HMAC</CardTitle>
        <CardDescription>Thales LQ — keyed-hash MAC over a data block.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={keys} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hg-hash">Hash ID</Label>
            <Input id="hg-hash" value={hashId} onChange={(e) => setHashId(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hg-len">HMAC length (4N bytes)</Label>
            <Input id="hg-len" value={hmacLen} onChange={(e) => setHmacLen(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate HMAC'}
        </Button>
        {out && <ResultBlock label="HMAC (hex)" value={out} />}
      </CardContent>
    </Card>
  );
}

function HmacVerifyPanel({ keys }: { keys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [data, setData] = useState('');
  const [hashId, setHashId] = useState('06');
  const [hmac, setHmac] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    if (!hmac.trim()) return toast.error('HMAC required');
    setBusy(true); setResult(null);
    try {
      const r = await cryptoApi.hmacVerify({ keyId, dataHex: data.replace(/\s+/g, ''), hmac: hmac.replace(/\s+/g, ''), hashId });
      setResult(!!r.verified);
      if (r.verified) toast.success('HMAC verified'); else toast.error(`Mismatch (${r.errCode})`);
    } catch (e) { errToast(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verify HMAC</CardTitle>
        <CardDescription>Thales LS — verify a keyed-hash MAC.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={keys} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hv-hash">Hash ID</Label>
          <Input id="hv-hash" value={hashId} onChange={(e) => setHashId(e.target.value)} className="font-mono w-32" />
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>HMAC to verify (hex)</Label>
          <Input value={hmac} onChange={(e) => setHmac(e.target.value)} className="font-mono" placeholder="…" />
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify HMAC'}
        </Button>
        {result !== null && (
          <div className={`flex items-center gap-2 pt-1 text-sm font-medium ${result ? 'text-success' : 'text-destructive'}`}>
            {result ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result ? 'Verified' : 'Verification failed'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------- MAC
function MacGenPanel({ keys }: { keys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [data, setData] = useState('');
  const [algorithm, setAlgorithm] = useState('3');
  const [iv, setIv] = useState('0000000000000000');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    setBusy(true);
    try {
      const r = await cryptoApi.macGenerate({ keyId, dataHex: data.replace(/\s+/g, ''), algorithm, iv });
      if (r.errCode === '00') { setOut(r.mac); toast.success('MAC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e) { errToast(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate MAC</CardTitle>
        <CardDescription>Thales M6 — CBC-MAC over a data block under a stored key.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={keys} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mg-alg">Algorithm</Label>
            <Input id="mg-alg" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mg-iv">IV (hex)</Label>
            <Input id="mg-iv" value={iv} onChange={(e) => setIv(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate MAC'}
        </Button>
        {out && <ResultBlock label="MAC (hex)" value={out} />}
      </CardContent>
    </Card>
  );
}

function MacVerifyPanel({ keys }: { keys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [data, setData] = useState('');
  const [algorithm, setAlgorithm] = useState('3');
  const [iv, setIv] = useState('0000000000000000');
  const [mac, setMac] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    if (!mac.trim()) return toast.error('MAC required');
    setBusy(true); setResult(null);
    try {
      const r = await cryptoApi.macVerify({ keyId, dataHex: data.replace(/\s+/g, ''), mac: mac.replace(/\s+/g, ''), algorithm, iv });
      const ok = r.errCode === '00';
      setResult(ok);
      if (ok) toast.success('MAC verified'); else toast.error(`Mismatch (${r.errCode})`);
    } catch (e) { errToast(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verify MAC</CardTitle>
        <CardDescription>Thales M8 — verify a CBC-MAC.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={keys} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mv-alg">Algorithm</Label>
            <Input id="mv-alg" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-iv">IV (hex)</Label>
            <Input id="mv-iv" value={iv} onChange={(e) => setIv(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>MAC to verify (hex)</Label>
          <Input value={mac} onChange={(e) => setMac(e.target.value)} className="font-mono" placeholder="…" />
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify MAC'}
        </Button>
        {result !== null && (
          <div className={`flex items-center gap-2 pt-1 text-sm font-medium ${result ? 'text-success' : 'text-destructive'}`}>
            {result ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result ? 'Verified' : 'Verification failed'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DataIntegrity() {
  const keysQ = useQuery<KeySummary[]>({ queryKey: ['keys'], queryFn: () => keysApi.list() });
  const keys = symFilter(keysQ.data ?? []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Integrity</h1>
          <p className="text-sm text-muted-foreground">
            Thales{' '}
            <Badge variant="outline" className="font-mono text-[10px] mx-1">LQ/LS</Badge>HMAC ·{' '}
            <Badge variant="outline" className="font-mono text-[10px] mx-1">M6/M8</Badge>MAC
          </p>
        </div>
      </div>

      <Tabs defaultValue="hmac">
        <TabsList className="w-full">
          <TabsTrigger value="hmac" className="flex-1">
            HMAC <Badge variant="outline" className="font-mono text-[9px] ml-2 px-1.5">LQ/LS</Badge>
          </TabsTrigger>
          <TabsTrigger value="mac" className="flex-1">
            MAC <Badge variant="outline" className="font-mono text-[9px] ml-2 px-1.5">M6/M8</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hmac" className="mt-4">
          <Tabs defaultValue="gen">
            <TabsList className="w-full">
              <TabsTrigger value="gen" className="flex-1">Generate</TabsTrigger>
              <TabsTrigger value="vrfy" className="flex-1">Verify</TabsTrigger>
            </TabsList>
            <TabsContent value="gen" className="mt-4"><HmacGenPanel keys={keys} /></TabsContent>
            <TabsContent value="vrfy" className="mt-4"><HmacVerifyPanel keys={keys} /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mac" className="mt-4">
          <Tabs defaultValue="gen">
            <TabsList className="w-full">
              <TabsTrigger value="gen" className="flex-1">Generate</TabsTrigger>
              <TabsTrigger value="vrfy" className="flex-1">Verify</TabsTrigger>
            </TabsList>
            <TabsContent value="gen" className="mt-4"><MacGenPanel keys={keys} /></TabsContent>
            <TabsContent value="vrfy" className="mt-4"><MacVerifyPanel keys={keys} /></TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
