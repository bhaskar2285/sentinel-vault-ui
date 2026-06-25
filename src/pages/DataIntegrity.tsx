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

// IV for the CBC chain — exactly 16 hex chars (8-byte DES/3DES block).
function isIv(s: string) {
  return /^[0-9a-fA-F]{16}$/.test(s.replace(/\s+/g, ''));
}

/* ─── Thales coded-field option tables (value — meaning) ──────────── */
// MAC algorithm is a single digit on the wire (M6/M8 field is 1N).
const MAC_ALG = [
  { value: '1', meaning: 'ISO 9797-1 alg 1 · X9.9 single-DES' },
  { value: '3', meaning: 'ISO 9797-1 alg 3 · X9.19 retail 3DES' },
  { value: '5', meaning: 'CBC-MAC · AES' },
  { value: '6', meaning: 'CMAC · AES' },
];
const MAC_MODE = [
  { value: '0', meaning: 'single / only block' },
  { value: '1', meaning: 'first block of chain' },
  { value: '2', meaning: 'intermediate block' },
  { value: '3', meaning: 'last block of chain' },
];
const MAC_INFMT = [
  { value: '0', meaning: 'binary' },
  { value: '1', meaning: 'ASCII' },
  { value: '2', meaning: 'EBCDIC' },
];
const MAC_PAD = [
  { value: '0', meaning: 'none' },
  { value: '1', meaning: 'ANSI X9.19 method 1' },
  { value: '2', meaning: 'ISO 16609 method 3' },
];

/** Labeled <select> that spells out what each coded value means. */
function CodeSelect({ id, label, value, onChange, options, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; meaning: string }[]; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.value} — {o.meaning}</option>
        ))}
      </select>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
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
  const hashErr = !/^[0-9]{2}$/.test(hashId);
  const lenErr = !/^[0-9a-fA-F]{4}$/.test(hmacLen);

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
            <Label htmlFor="hg-hash">Hash code (2N)</Label>
            <Input id="hg-hash" value={hashId} onChange={(e) => setHashId(e.target.value)}
              className={`font-mono ${hashErr ? 'border-destructive' : ''}`} />
            <p className="text-[11px] text-muted-foreground">Thales hash code · 06 = SHA-256.</p>
            {hashErr && <p className="text-[11px] text-destructive">2 digits required.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hg-len">MAC length (4 hex bytes)</Label>
            <Input id="hg-len" value={hmacLen} onChange={(e) => setHmacLen(e.target.value)}
              className={`font-mono ${lenErr ? 'border-destructive' : ''}`} />
            <p className="text-[11px] text-muted-foreground">Length in bytes · 0020 = 32 (full SHA-256).</p>
            {lenErr && <p className="text-[11px] text-destructive">4 hex chars required.</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr || hashErr || lenErr} className="w-full sm:w-auto">
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
  const hashErr = !/^[0-9]{2}$/.test(hashId);

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
          <Label htmlFor="hv-hash">Hash code (2N)</Label>
          <Input id="hv-hash" value={hashId} onChange={(e) => setHashId(e.target.value)}
            className={`font-mono w-40 ${hashErr ? 'border-destructive' : ''}`} />
          <p className="text-[11px] text-muted-foreground">Thales hash code · 06 = SHA-256.</p>
          {hashErr && <p className="text-[11px] text-destructive">2 digits required.</p>}
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
        <Button onClick={run} disabled={busy || !keyId || dataErr || hashErr} className="w-full sm:w-auto">
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
  const [mode, setMode] = useState('0');
  const [inputFormat, setInputFormat] = useState('0');
  const [padding, setPadding] = useState('1');
  const [iv, setIv] = useState('0000000000000000');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);
  const ivErr = !isIv(iv);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    if (!isIv(iv)) return toast.error('IV must be 16 hex chars');
    setBusy(true);
    try {
      const r = await cryptoApi.macGenerate({ keyId, dataHex: data.replace(/\s+/g, ''), algorithm, mode, inputFormat, padding, iv });
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
          <CodeSelect id="mg-alg" label="Algorithm" value={algorithm} onChange={setAlgorithm} options={MAC_ALG} />
          <div className="space-y-1.5">
            <Label htmlFor="mg-iv">IV (16 hex)</Label>
            <Input id="mg-iv" value={iv} onChange={(e) => setIv(e.target.value)}
              className={`font-mono ${ivErr ? 'border-destructive' : ''}`} />
            <p className="text-[11px] text-muted-foreground">CBC chaining vector · zeros for a fresh MAC.</p>
            {ivErr && <p className="text-[11px] text-destructive">16 hex chars required.</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CodeSelect id="mg-mode" label="Mode" value={mode} onChange={setMode} options={MAC_MODE} />
          <CodeSelect id="mg-infmt" label="Input format" value={inputFormat} onChange={setInputFormat} options={MAC_INFMT} />
          <CodeSelect id="mg-pad" label="Padding" value={padding} onChange={setPadding} options={MAC_PAD} />
        </div>
        <div className="space-y-1.5">
          <Label>Data (hex)</Label>
          <Textarea value={data} onChange={(e) => setData(e.target.value)} rows={4}
            className={`font-mono text-xs ${dataErr ? 'border-destructive' : ''}`} placeholder="48656c6c6f…" />
          {dataErr && <p className="text-xs text-destructive">Even-length hex required.</p>}
        </div>
        <Button onClick={run} disabled={busy || !keyId || dataErr || ivErr} className="w-full sm:w-auto">
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
  const [mode, setMode] = useState('0');
  const [inputFormat, setInputFormat] = useState('0');
  const [padding, setPadding] = useState('1');
  const [iv, setIv] = useState('0000000000000000');
  const [mac, setMac] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const dataErr = data.trim() !== '' && !isHex(data);
  const ivErr = !isIv(iv);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!isHex(data)) return toast.error('Data must be even-length hex');
    if (!isIv(iv)) return toast.error('IV must be 16 hex chars');
    if (!mac.trim()) return toast.error('MAC required');
    setBusy(true); setResult(null);
    try {
      const r = await cryptoApi.macVerify({ keyId, dataHex: data.replace(/\s+/g, ''), mac: mac.replace(/\s+/g, ''), algorithm, mode, inputFormat, padding, iv });
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
          <CodeSelect id="mv-alg" label="Algorithm" value={algorithm} onChange={setAlgorithm} options={MAC_ALG} />
          <div className="space-y-1.5">
            <Label htmlFor="mv-iv">IV (16 hex)</Label>
            <Input id="mv-iv" value={iv} onChange={(e) => setIv(e.target.value)}
              className={`font-mono ${ivErr ? 'border-destructive' : ''}`} />
            <p className="text-[11px] text-muted-foreground">CBC chaining vector · zeros for a fresh MAC.</p>
            {ivErr && <p className="text-[11px] text-destructive">16 hex chars required.</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CodeSelect id="mv-mode" label="Mode" value={mode} onChange={setMode} options={MAC_MODE} />
          <CodeSelect id="mv-infmt" label="Input format" value={inputFormat} onChange={setInputFormat} options={MAC_INFMT} />
          <CodeSelect id="mv-pad" label="Padding" value={padding} onChange={setPadding} options={MAC_PAD} />
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
        <Button onClick={run} disabled={busy || !keyId || dataErr || ivErr} className="w-full sm:w-auto">
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
