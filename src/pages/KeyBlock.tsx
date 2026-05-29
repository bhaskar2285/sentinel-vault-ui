import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Blocks, Loader2, Copy, ChevronDown } from 'lucide-react';
import { keysApi, type KeySummary } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { copyText } from '@/lib/utils';

// ── auto-derive TR-31 header fields from key metadata ──────────────────────

function algoCode(k: KeySummary | undefined): string {
  if (!k) return 'T';
  const a = k.algo?.toUpperCase() ?? '';
  if (a === 'AES') {
    if (k.keyLengthBits === 256) return 'C';
    if (k.keyLengthBits === 192) return 'B';
    return 'A'; // 128
  }
  if (a === 'DES') return 'D';
  return 'T'; // 3DES default
}

function usageCode(k: KeySummary | undefined): string {
  if (!k) return 'K0';
  switch (k.keyType) {
    case 'ZPK': case '001': return 'P0';
    case 'ZMK': case '000': return 'K0';
    case 'KBPK': case '002': return 'K0';
    case 'TMK': case '008': return 'M0';
    case 'BDK': return 'B0';
    case 'DATA': case '00A': return 'D0';
    default: return 'K0';
  }
}

function recommendedFormat(kbpk: KeySummary | undefined): 'TR31_D' | 'TR31_B' {
  if (!kbpk) return 'TR31_D';
  return kbpk.algo?.toUpperCase() === 'AES' ? 'TR31_D' : 'TR31_B';
}

const ALGO_LABELS: Record<string, string> = {
  A: 'A — AES-128', B: 'B — AES-192', C: 'C — AES-256',
  T: 'T — Triple DES', D: 'D — DES',
};
const USAGE_LABELS: Record<string, string> = {
  K0: 'K0 — Key Encryption Key', P0: 'P0 — PIN Encryption',
  M0: 'M0 — ISO 9797-1 MAC',    D0: 'D0 — Data Encryption',
  B0: 'B0 — BDK Base Derivation',
};
const MODE_LABELS: Record<string, string> = {
  E: 'E — Encrypt', D: 'D — Decrypt', B: 'B — Enc+Dec',
  N: 'N — No restriction', V: 'V — Verify', G: 'G — Generate',
};
const EXPORT_LABELS: Record<string, string> = {
  E: 'E — Exportable (trusted)', N: 'N — Non-exportable', S: 'S — Sensitive',
};

const SYM_TYPES = new Set([
  'ZPK','ZMK','TMK','KBPK','BDK','DATA','AES','3DES',
  '000','001','002','003','008','009','00A','00B','00C','00D','00E','00F',
  'R','S','H','U','T',
]);

function KeySelect({ value, onChange, keys, placeholder }: {
  value: string; onChange: (v: string) => void;
  keys: KeySummary[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {keys.map((k) => (
        <option key={k.keyId} value={k.keyId}>
          {k.label} [{k.keyType}·{k.algo}] {k.keyId.slice(0, 8)}…
        </option>
      ))}
    </select>
  );
}

function NativeSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}

export default function KeyBlock() {
  const [keyId, setKeyId]       = useState('');
  const [kbpkId, setKbpkId]     = useState('');
  const [format, setFormat]     = useState<'TR31_D' | 'TR31_B' | 'X9_143'>('TR31_D');
  const [usage2, setUsage2]     = useState('K0');
  const [algo1, setAlgo1]       = useState('T');
  const [mode1, setMode1]       = useState('E');
  const [export1, setExport1]   = useState('E');
  const [showAdv, setShowAdv]   = useState(false);
  const [result, setResult]     = useState<{ keyBlock: string; kcv?: string } | null>(null);
  const [busy, setBusy]         = useState(false);

  const keysQ = useQuery<KeySummary[]>({
    queryKey: ['keys'],
    queryFn: () => keysApi.list(),
  });
  const symKeys = (keysQ.data ?? []).filter(
    (k) => SYM_TYPES.has(k.keyType) || (k.keyType?.length === 3 && k.keyType !== 'RSA')
  );

  const srcKey  = symKeys.find((k) => k.keyId === keyId);
  const kbpkKey = symKeys.find((k) => k.keyId === kbpkId);

  // auto-fill algo + usage when source key changes
  useEffect(() => { if (srcKey) { setAlgo1(algoCode(srcKey)); setUsage2(usageCode(srcKey)); } }, [srcKey?.keyId]);
  // auto-pick format when KBPK changes
  useEffect(() => { if (kbpkKey) setFormat(recommendedFormat(kbpkKey)); }, [kbpkKey?.keyId]);

  const run = async () => {
    if (!keyId)  return toast.error('Pick source key');
    if (!kbpkId) return toast.error('Pick KBPK');
    setBusy(true);
    try {
      const r = await keysApi.exportKey(keyId, { format, kbpkKeyId: kbpkId, usage2, algo1, mode1, export1 });
      if (r.status === 'OK') {
        setResult({ keyBlock: r.keyBlock, kcv: r.kcv });
        toast.success('Key block formed');
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
          <Blocks className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Key Block</h1>
          <p className="text-sm text-muted-foreground">
            Thales <Badge variant="outline" className="font-mono text-[10px] mx-1">B4/B5</Badge>
            — wrap a key under KBPK and output a TR-31 key block
          </p>
        </div>
      </div>

      {/* how it works */}
      <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p><span className="font-semibold text-foreground">What B4 does:</span> takes a key stored under LMK + a KBPK stored under LMK → HSM wraps the key inside a TR-31 block. The block can be sent to another HSM (bank-to-bank key distribution).</p>
        <p><span className="font-semibold text-foreground">Format rule:</span> KBPK is AES → use <span className="font-mono">TR31_D</span> (AES-CMAC binding). KBPK is 3DES → use <span className="font-mono">TR31_B</span> (3DES CBC-MAC). Mismatch = HSM error.</p>
        <p><span className="font-semibold text-foreground">Algo/Usage</span> are auto-filled from the source key — only change if you need to override the TR-31 header for a specific receiver.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parameters</CardTitle>
          <CardDescription>Format and header fields are auto-selected from the keys you pick.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* key selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source Key <span className="text-muted-foreground text-xs">(key to wrap)</span></Label>
              <KeySelect value={keyId} onChange={setKeyId} keys={symKeys} placeholder="— pick key —" />
              {srcKey && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  {srcKey.algo} · {srcKey.keyLengthBits}b · algo={algo1} usage={usage2}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>KBPK <span className="text-muted-foreground text-xs">(wrapping key)</span></Label>
              <KeySelect value={kbpkId} onChange={setKbpkId} keys={symKeys} placeholder="— pick KBPK —" />
              {kbpkKey && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  {kbpkKey.algo} · {kbpkKey.keyLengthBits}b → format={format}
                </p>
              )}
            </div>
          </div>

          {/* format */}
          <div className="space-y-1.5">
            <Label>Block Format
              {kbpkKey && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  auto: {recommendedFormat(kbpkKey)} from {kbpkKey.algo}
                </Badge>
              )}
            </Label>
            <NativeSelect
              value={format}
              onChange={(v) => setFormat(v as 'TR31_D' | 'TR31_B' | 'X9_143')}
              options={[
                { v: 'TR31_D', label: 'TR31_D — AES-CMAC binding (use with AES KBPK)' },
                { v: 'TR31_B', label: 'TR31_B — 3DES CBC-MAC binding (use with 3DES KBPK)' },
                { v: 'X9_143', label: 'X9_143 — X9.143 XML wrap' },
              ]}
            />
          </div>

          {/* advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdv(!showAdv)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdv ? 'rotate-180' : ''}`} />
            TR-31 header overrides (auto-filled · usually leave as-is)
          </button>

          {showAdv && (
            <div className="border rounded-md p-4 space-y-4 bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Key Usage <span className="text-muted-foreground">(2-char)</span></Label>
                  <NativeSelect value={usage2} onChange={setUsage2}
                    options={Object.entries(USAGE_LABELS).map(([v, label]) => ({ v, label }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Algorithm <span className="text-muted-foreground">(of wrapped key)</span></Label>
                  <NativeSelect value={algo1} onChange={setAlgo1}
                    options={Object.entries(ALGO_LABELS).map(([v, label]) => ({ v, label }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mode of Use</Label>
                  <NativeSelect value={mode1} onChange={setMode1}
                    options={Object.entries(MODE_LABELS).map(([v, label]) => ({ v, label }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Exportability</Label>
                  <NativeSelect value={export1} onChange={setExport1}
                    options={Object.entries(EXPORT_LABELS).map(([v, label]) => ({ v, label }))} />
                </div>
              </div>
            </div>
          )}

          <Button onClick={run} disabled={busy || !keyId || !kbpkId} className="w-full sm:w-auto">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? 'Forming block…' : 'Form Key Block'}
          </Button>

          {result && (
            <div className="space-y-3 pt-2">
              <Separator />
              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm">TR-31 Key Block</Label>
                <Button variant="ghost" size="sm"
                  onClick={() => { copyText(result.keyBlock); toast.success('Copied'); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
              </div>
              <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
                {result.keyBlock}
              </pre>
              {result.kcv && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>KCV:</span><span className="font-mono">{result.kcv}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
