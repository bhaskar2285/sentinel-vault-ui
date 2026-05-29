import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { keysApi, type KeySummary } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const KEY_TYPES = [
  // ── Interchange / Zone keys ────────────────────────────────────────────
  { code: '000', name: 'ZMK',     group: 'Zone',       desc: 'Zone Master Key — wraps other keys for transport' },
  { code: '001', name: 'ZPK',     group: 'Zone',       desc: 'Zone PIN Key — encrypts PIN blocks on the wire' },
  { code: '002', name: 'KBPK',   group: 'Zone',       desc: 'Key Block Protection Key — TR-31 wrap KEK' },
  { code: '008', name: 'TMK',    group: 'Zone',       desc: 'Terminal Master Key — POS/ATM master injection key' },
  // ── PIN keys ──────────────────────────────────────────────────────────
  { code: '008', name: 'TPK',    group: 'PIN',        desc: 'Terminal PIN Key — encrypts PIN at ATM/POS (same family as TMK)' },
  { code: '00A', name: 'PVK',    group: 'PIN',        desc: 'PIN Verification Key — IBM 3624 / VISA PVV offset verification' },
  // ── Card verification keys ────────────────────────────────────────────
  { code: '00A', name: 'CVK',    group: 'Card',       desc: 'Card Verification Key — generates/verifies CVV/CVC/CVV2' },
  // ── EMV / chip keys ───────────────────────────────────────────────────
  { code: '00A', name: 'IMK-AC', group: 'EMV',        desc: 'Issuer Master Key — Application Cryptography (ARQC/ARPC)' },
  { code: '00A', name: 'IMK-SMI',group: 'EMV',        desc: 'Issuer Master Key — Secure Messaging Integrity (script MAC)' },
  { code: '00A', name: 'IMK-SMC',group: 'EMV',        desc: 'Issuer Master Key — Secure Messaging Confidentiality (script enc)' },
  { code: '001', name: 'BDK',    group: 'EMV',        desc: 'Base Derivation Key — DUKPT PIN key derivation' },
  // ── Generic ───────────────────────────────────────────────────────────
  { code: '00A', name: 'DATA',   group: 'Generic',    desc: 'Generic data encryption key' },
];

const KEY_GROUPS = ['Zone', 'PIN', 'Card', 'EMV', 'Generic'];

const SCHEMES = [
  { code: 'U', name: 'U — 3DES double-length (128b)' },
  { code: 'T', name: 'T — 3DES triple-length (192b)' },
  { code: 'R', name: 'R — AES-128' },
  { code: 'S', name: 'S — AES-192' },
  { code: 'H', name: 'H — AES-256' },
];

export default function KeyCreateSym() {
  const nav = useNavigate();
  const [label, setLabel] = useState('');
  const [keyType, setKeyType] = useState('ZPK');
  const [keyScheme, setScheme] = useState('U');
  const [mode, setMode] = useState('0');
  const [zmkKeyId, setZmkKeyId] = useState('');
  const [outScheme, setOut] = useState('U');
  const [busy, setBusy] = useState(false);

  const zmkList = useQuery<KeySummary[]>({
    queryKey: ['keys', 'zmk-list'],
    queryFn: () => keysApi.list({ keyType: 'ZMK' }),
    enabled: mode === '1',
  });

  const submit = async () => {
    if (!label.trim()) return toast.error('Label required');
    if (mode === '1' && !zmkKeyId) return toast.error('Pick a ZMK for mode=1');
    setBusy(true);
    try {
      const r = await keysApi.generateSymmetric({
        label, keyType, keyScheme, mode,
        zmkKeyId: mode === '1' ? zmkKeyId : undefined,
        outScheme: mode === '1' ? outScheme : undefined,
      });
      if (r.status === 'OK') {
        toast.success(`Key created · KCV ${r.kcv}`);
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

  const selected = KEY_TYPES.find((t) => t.name === keyType);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate Symmetric Key</h1>
          <p className="text-sm text-muted-foreground">
            Thales <Badge variant="outline" className="font-mono text-[10px] mx-1">A0</Badge>
            <span className="font-mono">→</span>
            <Badge variant="outline" className="font-mono text-[10px] mx-1">A1</Badge>
            <span className="text-xs">— generated under LMK, clear key never leaves HSM</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key parameters</CardTitle>
          <CardDescription>
            Mode 0 stores key under LMK only · mode 1 also returns a ZMK-wrapped copy for transport.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="zpk-acquirer-jan2026"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Key family</Label>
            <select
              value={keyType}
              onChange={(e) => setKeyType(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
            >
              {KEY_GROUPS.map((g) => (
                <optgroup key={g} label={`── ${g} ──`}>
                  {KEY_TYPES.filter((t) => t.group === g).map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} [{t.code}] — {t.desc}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selected && (
              <p className="text-[11px] text-muted-foreground">
                Thales family code <span className="font-mono">{selected.code}</span> · {selected.group}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Algorithm / length (LMK scheme)</Label>
            <select
              value={keyScheme}
              onChange={(e) => setScheme(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
            >
              {SCHEMES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Mode</Label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
            >
              <option value="0">0 — under LMK only</option>
              <option value="1">1 — under LMK + ZMK-wrapped copy</option>
            </select>
          </div>

          {mode === '1' && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label>ZMK (wraps the new key for transport)</Label>
                <select
                  value={zmkKeyId}
                  onChange={(e) => setZmkKeyId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                >
                  <option value="">— pick a ZMK —</option>
                  {zmkList.data?.map((k) => (
                    <option key={k.keyId} value={k.keyId}>
                      {k.label} — {k.keyId.slice(0, 8)}…
                    </option>
                  ))}
                </select>
                {zmkList.data?.length === 0 && (
                  <Alert variant="default" className="border-warning/50 bg-warning/5">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-xs">
                      No ZMK in vault. Create one first (mode 0, family ZMK).
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Output scheme (ZMK copy)</Label>
                <select
                  value={outScheme}
                  onChange={(e) => setOut(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                >
                  {SCHEMES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

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
