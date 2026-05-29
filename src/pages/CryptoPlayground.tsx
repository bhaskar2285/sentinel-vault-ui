import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Cpu, Loader2, Copy } from 'lucide-react';
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

const MODES = [
  { v: '00', label: 'ECB', desc: 'no IV' },
  { v: '01', label: 'CBC', desc: 'IV required' },
  { v: '02', label: 'CFB', desc: 'IV required' },
];

const SYM_TYPES = new Set([
  'ZPK','ZMK','TMK','KBPK','BDK','DATA','AES','3DES',
  '000','001','002','003','008','009','00A','00B','00C','00D','00E','00F',
  'R','S','H','U','T',
]);

function symFilter(keys: KeySummary[]) {
  return keys.filter(
    (k) => SYM_TYPES.has(k.keyType) || (k.keyType?.length === 3 && k.keyType !== 'RSA')
  );
}

/** Block size in hex chars: AES=32, everything else (3DES/DES)=16 */
function blockHexLen(key: KeySummary | undefined): number {
  if (!key) return 16;
  return key.algo?.toUpperCase().includes('AES') ? 32 : 16;
}

function alignError(hex: string, key: KeySummary | undefined): string | null {
  const clean = hex.replace(/\s+/g, '');
  if (!clean) return null;
  const bs = blockHexLen(key);
  if (clean.length % bs !== 0) {
    const needed = bs - (clean.length % bs);
    return `Length ${clean.length} hex chars — not a multiple of ${bs} (${bs / 2} bytes). Pad ${needed} more hex char${needed > 1 ? 's' : ''}.`;
  }
  return null;
}

function KeySelect({ value, onChange, keys }: {
  value: string;
  onChange: (v: string) => void;
  keys: KeySummary[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
    >
      <option value="">— pick a symmetric key —</option>
      {keys.map((k) => (
        <option key={k.keyId} value={k.keyId}>
          {k.label} [{k.keyType}] {k.keyId.slice(0, 8)}…
        </option>
      ))}
    </select>
  );
}

function ModeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
    >
      {MODES.map((m) => (
        <option key={m.v} value={m.v}>
          {m.v} — {m.label} · {m.desc}
        </option>
      ))}
    </select>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => { copyText(text); toast.success('Copied'); }}
    >
      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
    </Button>
  );
}

function DecryptPanel({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId]           = useState('');
  const [mode, setMode]             = useState('01');
  const [iv, setIv]                 = useState('');
  const [ciphertext, setCiphertext] = useState('');
  const [plaintext, setPlaintext]   = useState('');
  const [busy, setBusy]             = useState(false);

  const selectedKey = symKeys.find((k) => k.keyId === keyId);
  const hexErr = alignError(ciphertext, selectedKey);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!ciphertext.trim()) return toast.error('Ciphertext required');
    if (hexErr) return toast.error(hexErr);
    setBusy(true);
    try {
      const r = await cryptoApi.decrypt({
        keyId,
        ciphertextHex: ciphertext.replace(/\s+/g, ''),
        mode,
        iv: iv || undefined,
      });
      if (r.status === 'OK') {
        setPlaintext(r.plaintextHex);
        toast.success('Decrypted');
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parameters</CardTitle>
        <CardDescription>
          Key must be a stored symmetric key (ZPK, ZMK, TMK, KBPK, BDK, DATA).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={symKeys} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <ModeSelect value={mode} onChange={setMode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dec-iv">IV (hex)</Label>
            <Input
              id="dec-iv"
              value={iv}
              onChange={(e) => setIv(e.target.value)}
              placeholder={mode === '00' ? 'N/A for ECB' : '0000000000000000'}
              disabled={mode === '00'}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Ciphertext (hex)</Label>
          <Textarea
            value={ciphertext}
            onChange={(e) => setCiphertext(e.target.value)}
            rows={4}
            className={`font-mono text-xs ${hexErr ? 'border-destructive' : ''}`}
            placeholder="AABBCCDDEEFF…"
          />
          {hexErr && (
            <p className="text-xs text-destructive">{hexErr}</p>
          )}
          {selectedKey && !hexErr && ciphertext.replace(/\s+/g, '').length > 0 && (
            <p className="text-xs text-muted-foreground">
              {ciphertext.replace(/\s+/g, '').length / 2} bytes · {blockHexLen(selectedKey) / 2}-byte blocks ✓
            </p>
          )}
        </div>

        <Button onClick={run} disabled={busy || !keyId || !!hexErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? 'Decrypting…' : 'Decrypt'}
        </Button>

        {plaintext && (
          <div className="space-y-2 pt-2">
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <Label className="text-sm">Plaintext (hex)</Label>
              <CopyButton text={plaintext} />
            </div>
            <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
              {plaintext}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EncryptPanel({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId]           = useState('');
  const [mode, setMode]             = useState('01');
  const [iv, setIv]                 = useState('');
  const [plaintext, setPlaintext]   = useState('');
  const [ciphertext, setCiphertext] = useState('');
  const [busy, setBusy]             = useState(false);

  const selectedKey = symKeys.find((k) => k.keyId === keyId);
  const hexErr = alignError(plaintext, selectedKey);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!plaintext.trim()) return toast.error('Plaintext required');
    if (hexErr) return toast.error(hexErr);
    setBusy(true);
    try {
      const r = await cryptoApi.encrypt({
        keyId,
        plaintextHex: plaintext.replace(/\s+/g, ''),
        mode,
        iv: iv || undefined,
      });
      if (r.status === 'OK') {
        setCiphertext(r.ciphertextHex);
        toast.success('Encrypted');
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parameters</CardTitle>
        <CardDescription>
          Key must be a stored symmetric key (ZPK, ZMK, TMK, KBPK, BDK, DATA).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Key</Label>
          <KeySelect value={keyId} onChange={setKeyId} keys={symKeys} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <ModeSelect value={mode} onChange={setMode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enc-iv">IV (hex)</Label>
            <Input
              id="enc-iv"
              value={iv}
              onChange={(e) => setIv(e.target.value)}
              placeholder={mode === '00' ? 'N/A for ECB' : '0000000000000000'}
              disabled={mode === '00'}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Plaintext (hex)</Label>
          <Textarea
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            rows={4}
            className={`font-mono text-xs ${hexErr ? 'border-destructive' : ''}`}
            placeholder="4142434445464748…"
          />
          {hexErr && (
            <p className="text-xs text-destructive">{hexErr}</p>
          )}
          {selectedKey && !hexErr && plaintext.replace(/\s+/g, '').length > 0 && (
            <p className="text-xs text-muted-foreground">
              {plaintext.replace(/\s+/g, '').length / 2} bytes · {blockHexLen(selectedKey) / 2}-byte blocks ✓
            </p>
          )}
        </div>

        <Button onClick={run} disabled={busy || !keyId || !!hexErr} className="w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? 'Encrypting…' : 'Encrypt'}
        </Button>

        {ciphertext && (
          <div className="space-y-2 pt-2">
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <Label className="text-sm">Ciphertext (hex)</Label>
              <CopyButton text={ciphertext} />
            </div>
            <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
              {ciphertext}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CryptoPlayground() {
  const keysQ = useQuery<KeySummary[]>({
    queryKey: ['keys'],
    queryFn: () => keysApi.list(),
  });

  const symKeys = symFilter(keysQ.data ?? []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crypto</h1>
          <p className="text-sm text-muted-foreground">
            Thales{' '}
            <Badge variant="outline" className="font-mono text-[10px] mx-1">M0/M1</Badge>
            Encrypt ·{' '}
            <Badge variant="outline" className="font-mono text-[10px] mx-1">M2/M3</Badge>
            Decrypt — symmetric data under stored key
          </p>
        </div>
      </div>

      <Tabs defaultValue="encrypt">
        <TabsList className="w-full">
          <TabsTrigger value="encrypt" className="flex-1">
            Encrypt
            <Badge variant="outline" className="font-mono text-[9px] ml-2 px-1.5">M0/M1</Badge>
          </TabsTrigger>
          <TabsTrigger value="decrypt" className="flex-1">
            Decrypt
            <Badge variant="outline" className="font-mono text-[9px] ml-2 px-1.5">M2/M3</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="encrypt" className="mt-4">
          <EncryptPanel symKeys={symKeys} />
        </TabsContent>
        <TabsContent value="decrypt" className="mt-4">
          <DecryptPanel symKeys={symKeys} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
