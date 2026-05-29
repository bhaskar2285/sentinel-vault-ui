import { useState, Fragment } from 'react';
import { Check, ChevronDown, Loader2, Play, RotateCcw, AlertCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type StepKey = 'genZmk' | 'genZpk' | 'exportTr31' | 'encrypt' | 'decrypt';

interface ChainState {
  zmk?:     { keyId: string; kcv: string; label: string };
  zpk?:     { keyId: string; kcv: string; label: string; underZmk?: string | null };
  tr31?:    { keyBlock: string };
  encrypt?: { ciphertextHex: string };
  decrypt?: { plaintextHex: string };
}

const STEPS: { key: StepKey; title: string; cmd: string; spec: string; desc: string }[] = [
  { key: 'genZmk',     title: 'Generate ZMK',           cmd: 'A0/A1', spec: 'payShield p.38', desc: 'Mint a Zone Master Key under LMK. ZMK wraps other keys for transport.' },
  { key: 'genZpk',     title: 'Generate ZPK + wrap',    cmd: 'A0/A1', spec: 'mode=1',         desc: 'Mint a Zone PIN Key, also return a copy wrapped under the ZMK.' },
  { key: 'exportTr31', title: 'TR-31 Key Block export', cmd: 'B4/B5', spec: 'X9.143',         desc: 'Wrap the ZPK in a TR-31 Format D block bound under a KBPK (here, the ZMK).' },
  { key: 'encrypt',    title: 'Encrypt sample data',    cmd: 'M0/M1', spec: 'p.377',          desc: 'Encrypt 16 bytes of plaintext under the ZPK.' },
  { key: 'decrypt',    title: 'Decrypt round-trip',     cmd: 'M2/M3', spec: 'p.384',          desc: 'Decrypt the ciphertext back to plaintext — closes the loop.' },
];

function hexToAscii(hex: string): string {
  if (!hex) return '';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const c = parseInt(hex.substr(i, 2), 16);
    out += (c >= 32 && c < 127) ? String.fromCharCode(c) : '·';
  }
  return out;
}

function KVPanel({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-muted-foreground font-medium">{k}</dt>
          <dd className="font-mono break-all">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function ResultPanel({ stepKey, state, finalOk }: { stepKey: StepKey; state: ChainState; finalOk: boolean }) {
  if (stepKey === 'genZmk' && state.zmk) {
    return <KVPanel rows={[
      ['Key ID', state.zmk.keyId],
      ['Label',  state.zmk.label],
      ['Family', '000 (ZMK)'],
      ['KCV',    state.zmk.kcv],
    ]}/>;
  }
  if (stepKey === 'genZpk' && state.zpk) {
    return <KVPanel rows={[
      ['Key ID',    state.zpk.keyId],
      ['Label',     state.zpk.label],
      ['Family',    '001 (ZPK)'],
      ['KCV',       state.zpk.kcv],
      ['Under ZMK', state.zpk.underZmk ?? '(mode 0 — no ZMK copy returned)'],
    ]}/>;
  }
  if (stepKey === 'exportTr31' && state.tr31) {
    return (
      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          TR-31 Format D key block
        </div>
        <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
{state.tr31.keyBlock}
        </pre>
        <div className="text-[10px] text-muted-foreground">
          ASCII envelope:
          <Badge variant="outline" className="font-mono text-[9px] mx-1">D0096</Badge>
          = version D, 96 bytes ·
          <Badge variant="outline" className="font-mono text-[9px] mx-1">P0TE</Badge>
          = PIN-encrypt usage, 3DES, encrypt-only, exportable · MAC bound via AES-CMAC.
        </div>
      </div>
    );
  }
  if (stepKey === 'encrypt' && state.encrypt) {
    return <KVPanel rows={[
      ['Plaintext',  '48656C6C6F2C2073656E74696E656C21'],
      ['ASCII',      '"Hello, sentinel!"'],
      ['IV',         '00000000000000000000000000000000'],
      ['Ciphertext', state.encrypt.ciphertextHex],
    ]}/>;
  }
  if (stepKey === 'decrypt' && state.decrypt) {
    return <KVPanel rows={[
      ['Recovered hex',   state.decrypt.plaintextHex],
      ['Recovered ASCII', hexToAscii(state.decrypt.plaintextHex)],
      ['Round-trip',      finalOk ? 'OK — matches original' : 'MISMATCH'],
    ]}/>;
  }
  return null;
}

export default function CryptoWizard() {
  const [active, setActive] = useState<StepKey>('genZmk');
  const [state, setState]   = useState<ChainState>({});
  const [busy, setBusy]     = useState<StepKey | null>(null);
  const [err, setErr]       = useState<Partial<Record<StepKey, string>>>({});

  const ts = () => new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const reset = () => { setState({}); setErr({}); setActive('genZmk'); };

  const run = async (step: StepKey) => {
    setBusy(step); setErr((e) => ({ ...e, [step]: undefined }));
    try {
      if (step === 'genZmk') {
        const label = `wizard-zmk-${ts()}`;
        const r = await api.post('/keys/symmetric', { label, keyType: '000', keyScheme: 'U', mode: '0' });
        if (r.data.status !== 'OK') throw new Error(`${r.data.errCode}: ${r.data.errText}`);
        setState((s) => ({ ...s, zmk: { keyId: r.data.keyId, kcv: r.data.kcv, label } }));
        setActive('genZpk');
      } else if (step === 'genZpk') {
        if (!state.zmk) throw new Error('Need a ZMK first');
        const label = `wizard-zpk-${ts()}`;
        const r = await api.post('/keys/symmetric', {
          label, keyType: '001', keyScheme: 'U', mode: '1', zmkKeyId: state.zmk.keyId, outScheme: 'U',
        });
        if (r.data.status !== 'OK') throw new Error(`${r.data.errCode}: ${r.data.errText}`);
        setState((s) => ({ ...s, zpk: { keyId: r.data.keyId, kcv: r.data.kcv, label, underZmk: r.data.keyUnderZmk } }));
        setActive('exportTr31');
      } else if (step === 'exportTr31') {
        if (!state.zpk || !state.zmk) throw new Error('Need ZPK and ZMK');
        const r = await api.post(`/keys/${state.zpk.keyId}/export`, {
          format: 'TR31_D', kbpkKeyId: state.zmk.keyId,
          usage2: 'P0', algo1: 'T', mode1: 'E', export1: 'E',
        });
        if (r.data.status !== 'OK') throw new Error(`${r.data.errCode}: ${r.data.errText}`);
        setState((s) => ({ ...s, tr31: { keyBlock: r.data.keyBlock } }));
        setActive('encrypt');
      } else if (step === 'encrypt') {
        if (!state.zpk) throw new Error('Need ZPK');
        const r = await api.post('/crypto/encrypt', {
          keyId: state.zpk.keyId, mode: '01',
          iv: '00000000000000000000000000000000',
          plaintextHex: '48656C6C6F2C2073656E74696E656C21',
        });
        if (r.data.status !== 'OK') throw new Error(`${r.data.errCode}: ${r.data.errText}`);
        setState((s) => ({ ...s, encrypt: { ciphertextHex: r.data.ciphertextHex } }));
        setActive('decrypt');
      } else if (step === 'decrypt') {
        if (!state.zpk || !state.encrypt) throw new Error('Need ciphertext');
        const r = await api.post('/crypto/decrypt', {
          keyId: state.zpk.keyId, mode: '01',
          iv: '00000000000000000000000000000000',
          ciphertextHex: state.encrypt.ciphertextHex,
        });
        if (r.data.status !== 'OK') throw new Error(`${r.data.errCode}: ${r.data.errText}`);
        setState((s) => ({ ...s, decrypt: { plaintextHex: r.data.plaintextHex } }));
      }
    } catch (e: any) {
      setErr((prev) => ({ ...prev, [step]: e?.response?.data?.errText ?? e?.message ?? 'failed' }));
    } finally {
      setBusy(null);
    }
  };

  const runAll = async () => {
    reset();
    const keys: StepKey[] = ['genZmk', 'genZpk', 'exportTr31', 'encrypt', 'decrypt'];
    for (const k of keys) {
      setActive(k);
      await run(k);
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const isDone = (k: StepKey): boolean => {
    if (k === 'genZmk')     return !!state.zmk;
    if (k === 'genZpk')     return !!state.zpk;
    if (k === 'exportTr31') return !!state.tr31;
    if (k === 'encrypt')    return !!state.encrypt;
    if (k === 'decrypt')    return !!state.decrypt;
    return false;
  };

  const finalRoundtripOk = state.decrypt?.plaintextHex === '48656C6C6F2C2073656E74696E656C21';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crypto Walkthrough</h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end Thales lifecycle: ZMK → ZPK → TR-31 → encrypt → decrypt round-trip.
            Clear keys never leave the HSM boundary.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={!!busy}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={runAll} disabled={!!busy}>
            <Play className="mr-1.5 h-3.5 w-3.5" /> Run all
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, idx) => {
          const done    = isDone(step.key);
          const open    = active === step.key;
          const running = busy === step.key;
          const stepErr = err[step.key];
          return (
            <li key={step.key}>
              <Card className={cn('overflow-hidden transition-colors', done && 'border-success/50')}>
                <button
                  onClick={() => setActive(step.key)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={cn(
                      'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ring-1',
                      done
                        ? 'bg-success text-success-foreground ring-success/0'
                        : open
                        ? 'bg-primary text-primary-foreground ring-primary/0 shadow-sm'
                        : 'bg-muted text-muted-foreground ring-border'
                    )}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium">{step.title}</span>
                      <Badge variant="outline" className="font-mono text-[10px] h-[18px]">{step.cmd}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{step.spec}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                </button>

                {open && (
                  <CardContent className="border-t bg-muted/20 pt-4">
                    <Button size="sm" onClick={() => run(step.key)} disabled={running}>
                      {running ? (
                        <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Running…</>
                      ) : (
                        <>Run {step.cmd}</>
                      )}
                    </Button>

                    {stepErr && (
                      <Alert variant="destructive" className="mt-3 py-2.5">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{stepErr}</AlertDescription>
                      </Alert>
                    )}

                    <ResultPanel stepKey={step.key} state={state} finalOk={finalRoundtripOk} />
                  </CardContent>
                )}
              </Card>
            </li>
          );
        })}
      </ol>

      {state.decrypt && (
        <Card className={cn(finalRoundtripOk ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5')}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Check className={cn('h-4 w-4', finalRoundtripOk ? 'text-success' : 'text-destructive')} />
              <span className="font-medium text-sm">
                {finalRoundtripOk
                  ? 'Round-trip verified — plaintext recovered byte-for-byte.'
                  : 'Round-trip MISMATCH — plaintext does not equal original.'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-mono break-all">
              decrypted = {state.decrypt.plaintextHex}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
