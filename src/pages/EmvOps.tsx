import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, Loader2, Copy, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { keysApi, type KeySummary } from '@/api/keys';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { copyText } from '@/lib/utils';

function symFilter(keys: KeySummary[]) {
  return keys.filter((k) => k.keyType !== 'RSA');
}

function KeySel({ value, onChange, keys, placeholder, neededTypes }: {
  value: string; onChange: (v: string) => void; keys: KeySummary[];
  placeholder?: string; neededTypes?: string[];
}) {
  const filtered = neededTypes ? keys.filter((k) => neededTypes.includes(k.keyType)) : keys;
  const noKeys = filtered.length === 0;
  return (
    <div className="space-y-1">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        disabled={noKeys}
        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed">
        <option value="">{noKeys ? `— no ${neededTypes?.join('/')} key in vault —` : (placeholder ?? '— pick key —')}</option>
        {filtered.map((k) => (
          <option key={k.keyId} value={k.keyId}>{k.label} [{k.keyType}] {k.keyId.slice(0,8)}…</option>
        ))}
      </select>
      {noKeys && neededTypes && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Create a {neededTypes[0]} key first (Generate Sym → key family)
        </p>
      )}
    </div>
  );
}

function Field({ label, id, value, onChange, placeholder, mono = true, hint }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className={mono ? 'font-mono' : ''} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ResultBox({ label, value, err }: { label: string; value?: string; err?: boolean }) {
  if (!value) return null;
  return (
    <div className="space-y-2 pt-2">
      <Separator />
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {err ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
          <Label className="text-sm">{label}</Label>
        </div>
        {!err && (
          <Button variant="ghost" size="sm" onClick={() => { copyText(value); toast.success('Copied'); }}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
        )}
      </div>
      <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

// ── PIN Translate (CA/CB) ─────────────────────────────────────────────────

function PinTranslateTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [tpkId, setTpkId] = useState('');
  const [zpkId, setZpkId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!tpkId || !zpkId) return toast.error('Pick TPK and ZPK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be exactly 16 hex chars');
    if (!/^\d{12}$/.test(pan)) return toast.error('PAN must be exactly 12 decimal digits (rightmost excl. check digit)');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/translate', { tpkKeyId: tpkId, zpkKeyId: zpkId, pinBlock, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.translatedPinBlock); toast.success('Translated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Translate — CA/CB</CardTitle>
      <CardDescription>Translate a PIN block from TPK (terminal key) to ZPK (zone/interchange key). Used when routing a PIN from acquirer to issuer network.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>TPK (source — terminal key)</Label><KeySel value={tpkId} onChange={setTpkId} keys={symKeys} neededTypes={['TPK','TMK','008']} placeholder="— TPK —" /></div>
        <div className="space-y-1.5"><Label>ZPK (dest — zone key)</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','BDK','001']} placeholder="— ZPK —" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="pt-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." hint="ISO 9564-1 format 0 encrypted under TPK" />
        <Field label="PAN (12 digits)" id="pt-pan" value={pan} onChange={setPan} placeholder="123456789012" hint="12 rightmost digits excl. check digit" />
      </div>
      <Button onClick={run} disabled={busy || !tpkId || !zpkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Translating…' : 'Translate PIN'}
      </Button>
      <ResultBox label="Translated PIN Block (under ZPK)" value={result} />
    </CardContent></Card>
  );
}

// ── PIN Verify (DA/DB) ────────────────────────────────────────────────────

function PinVerifyTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [tpkId, setTpkId] = useState('');
  const [pvkId, setPvkId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [checkLen, setCheckLen] = useState('0');
  const [dectab, setDectab] = useState('');
  const [offset, setOffset] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!tpkId || !pvkId) return toast.error('Pick TPK and PVK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be exactly 16 hex chars');
    if (!/^\d{12}$/.test(pan)) return toast.error('PAN must be exactly 12 decimal digits');
    setBusy(true);
    try {
      const body: any = { tpkKeyId: tpkId, pvkKeyId: pvkId, pinBlock, pan, checkLen };
      if (checkLen !== '0') { body.dectab = dectab; body.pinOffset = offset; }
      const r = await api.post('/crypto/pin/verify', body).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'PIN verified — error code 00' }); toast.success('PIN OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Verify — DA/DB</CardTitle>
      <CardDescription>Verify a PIN block against a stored PIN offset using IBM 3624 method. checkLen=0 validates format only; &gt;0 requires decimalization table + offset.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>TPK (terminal PIN key)</Label><KeySel value={tpkId} onChange={setTpkId} keys={symKeys} neededTypes={['TPK','TMK','008']} placeholder="— TPK —" /></div>
        <div className="space-y-1.5"><Label>PVK (PIN verification key)</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','00A']} placeholder="— PVK —" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="pv-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (12 digits)" id="pv-pan" value={pan} onChange={setPan} placeholder="123456789012" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Check Length</Label>
          <select value={checkLen} onChange={(e) => setCheckLen(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="0">0 — format check only</option>
            <option value="4">4 — verify 4 digits (IBM 3624)</option>
          </select>
        </div>
        {checkLen !== '0' && <>
          <Field label="Dectab (16 hex)" id="pv-dt" value={dectab} onChange={setDectab} placeholder="0123456789012345" />
          <Field label="PIN Offset (4 hex)" id="pv-off" value={offset} onChange={setOffset} placeholder="1234" />
        </>}
      </div>
      <Button onClick={run} disabled={busy || !tpkId || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify PIN'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── CVV Generate (CW/CX) ─────────────────────────────────────────────────

function CvvGenTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [cvkaId, setCvkaId] = useState('');
  const [cvkbId, setCvkbId] = useState('');
  const [pan, setPan] = useState('');
  const [expDate, setExpDate] = useState('');
  const [svcCode, setSvcCode] = useState('101');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!cvkaId) return toast.error('Pick CVK-A');
    if (!/^\d{13,19}$/.test(pan)) return toast.error('PAN must be 13–19 decimal digits');
    if (!/^\d{4}$/.test(expDate)) return toast.error('Expiry must be 4 digits (YYMM)');
    setBusy(true);
    try {
      const r = await api.post('/crypto/cvv/generate', {
        cvkaKeyId: cvkaId, cvkbKeyId: cvkbId || cvkaId, pan, expDate, serviceCode: svcCode,
      }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.cvv); toast.success('CVV generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">CVV Generate — CW/CX</CardTitle>
      <CardDescription>Generate CVV/CVC/CVV2. CVK-B defaults to CVK-A if left blank (single-key CVK). Service code: 101=CVV, 000=CVV2, 201=track2.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>CVK-A</Label><KeySel value={cvkaId} onChange={setCvkaId} keys={symKeys} neededTypes={['CVK','00A']} placeholder="— CVK-A —" /></div>
        <div className="space-y-1.5"><Label>CVK-B <span className="text-muted-foreground text-xs">(leave blank = same as CVK-A)</span></Label><KeySel value={cvkbId} onChange={setCvkbId} keys={symKeys} neededTypes={['CVK','00A']} placeholder="— CVK-B (optional) —" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="PAN (full)" id="cg-pan" value={pan} onChange={setPan} placeholder="4111111111111111" hint="Full PAN including check digit" />
        </div>
        <Field label="Expiry (YYMM)" id="cg-exp" value={expDate} onChange={setExpDate} placeholder="2512" hint="Dec 2025 = 2512" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Service Code" id="cg-svc" value={svcCode} onChange={setSvcCode} placeholder="101" hint="101=CVV, 000=CVV2, 201=track2" />
      </div>
      <Button onClick={run} disabled={busy || !cvkaId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate CVV'}
      </Button>
      <ResultBox label="CVV (3 digits)" value={result} />
    </CardContent></Card>
  );
}

// ── CVV Verify (CY/CZ) ───────────────────────────────────────────────────

function CvvVerifyTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [cvkaId, setCvkaId] = useState('');
  const [cvkbId, setCvkbId] = useState('');
  const [pan, setPan] = useState('');
  const [expDate, setExpDate] = useState('');
  const [svcCode, setSvcCode] = useState('101');
  const [cvv, setCvv] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!cvkaId || !cvv) return toast.error('Pick CVK-A and enter CVV');
    if (!/^\d{13,19}$/.test(pan)) return toast.error('PAN must be 13–19 decimal digits');
    if (!/^\d{4}$/.test(expDate)) return toast.error('Expiry must be 4 digits (YYMM)');
    setBusy(true);
    try {
      const r = await api.post('/crypto/cvv/verify', {
        cvkaKeyId: cvkaId, cvkbKeyId: cvkbId || cvkaId, pan, expDate, serviceCode: svcCode, cvv,
      }).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'CVV verified — error code 00' }); toast.success('CVV OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">CVV Verify — CY/CZ</CardTitle>
      <CardDescription>Verify CVV/CVC/CVV2 presented in authorization against the card's CVK.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>CVK-A</Label><KeySel value={cvkaId} onChange={setCvkaId} keys={symKeys} neededTypes={['CVK','00A']} placeholder="— CVK-A —" /></div>
        <div className="space-y-1.5"><Label>CVK-B <span className="text-muted-foreground text-xs">(blank = same as CVK-A)</span></Label><KeySel value={cvkbId} onChange={setCvkbId} keys={symKeys} neededTypes={['CVK','00A']} placeholder="— CVK-B (optional) —" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="PAN (full)" id="cv-pan" value={pan} onChange={setPan} placeholder="4111111111111111" />
        </div>
        <Field label="Expiry (YYMM)" id="cv-exp" value={expDate} onChange={setExpDate} placeholder="2512" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Service Code" id="cv-svc" value={svcCode} onChange={setSvcCode} placeholder="101" />
        <Field label="CVV to verify (3 digits)" id="cv-cvv" value={cvv} onChange={setCvv} placeholder="123" />
      </div>
      <Button onClick={run} disabled={busy || !cvkaId || !cvv} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify CVV'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── ARQC / ARPC (KQ/KR) ─────────────────────────────────────────────────

function ArqcTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [imkId, setImkId] = useState('');
  const [mode, setMode] = useState('03');
  const [atc, setAtc] = useState('');
  const [arqc, setArqc] = useState('');
  const [transData, setTransData] = useState('');
  const [arc, setArc] = useState('3030');
  const [pan, setPan] = useState('');
  const [panSeq, setPanSeq] = useState('00');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!imkId) return toast.error('Pick IMK-AC');
    if (!/^[0-9A-Fa-f]{4}$/.test(atc)) return toast.error('ATC must be exactly 4 hex chars');
    if (!/^[0-9A-Fa-f]{16}$/.test(arqc)) return toast.error('ARQC must be exactly 16 hex chars');
    if (!/^[0-9A-Fa-f]+$/.test(transData) || transData.length % 2 !== 0) return toast.error('Transaction data must be even-length hex');
    if (!/^\d{12}$/.test(pan)) return toast.error('PAN must be exactly 12 decimal digits (rightmost excl. check digit)');
    setBusy(true);
    try {
      const r = await api.post('/crypto/arqc', { imkKeyId: imkId, mode, atc, arqc, transData, arc, pan, panSeqNo: panSeq }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.arpc); toast.success('ARQC verified / ARPC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">ARQC Verify / ARPC Generate — KQ/KR</CardTitle>
      <CardDescription>Verify the chip card's ARQC cryptogram and generate the ARPC response cryptogram to send back to the card via the terminal.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>IMK-AC (Issuer Master Key)</Label><KeySel value={imkId} onChange={setImkId} keys={symKeys} neededTypes={['IMK-AC','00A']} placeholder="— IMK-AC —" /></div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="03">03 — EMV (Visa)</option>
            <option value="05">05 — EMV (Mastercard)</option>
            <option value="41">41 — CPA</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ATC (4 hex = 2 bytes)" id="aq-atc" value={atc} onChange={setAtc} placeholder="0012" hint="Application Transaction Counter from card" />
        <Field label="ARQC (16 hex = 8 bytes)" id="aq-arqc" value={arqc} onChange={setArqc} placeholder="A1B2C3D4E5F60708" hint="Cryptogram from card" />
      </div>
      <Field label="Transaction Data (hex)" id="aq-td" value={transData} onChange={setTransData} placeholder="9F02060000000010009F03060000000000009F1A020840..." hint="Concatenated EMV TLV data that was input to ARQC (variable length)" />
      <div className="grid grid-cols-3 gap-3">
        <Field label="ARC (4 hex)" id="aq-arc" value={arc} onChange={setArc} placeholder="3030" hint="Auth Response Code: 3030=approved" />
        <Field label="PAN (12 digits)" id="aq-pan" value={pan} onChange={setPan} placeholder="123456789012" hint="12 rightmost excl. check digit" />
        <Field label="PAN Seq No" id="aq-pseq" value={panSeq} onChange={setPanSeq} placeholder="00" />
      </div>
      <Button onClick={run} disabled={busy || !imkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Processing…' : 'Verify ARQC / Generate ARPC'}
      </Button>
      <ResultBox label="ARPC (16 hex — send to card via terminal)" value={result} />
    </CardContent></Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EmvOps() {
  const keysQ = useQuery<KeySummary[]>({ queryKey: ['keys'], queryFn: () => keysApi.list() });
  const symKeys = symFilter(keysQ.data ?? []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EMV Operations</h1>
          <p className="text-sm text-muted-foreground">
            Full chip card transaction lifecycle —{' '}
            <Badge variant="outline" className="font-mono text-[10px] mx-0.5">CA/CB</Badge>
            <Badge variant="outline" className="font-mono text-[10px] mx-0.5">DA/DB</Badge>
            <Badge variant="outline" className="font-mono text-[10px] mx-0.5">CW/CX</Badge>
            <Badge variant="outline" className="font-mono text-[10px] mx-0.5">CY/CZ</Badge>
            <Badge variant="outline" className="font-mono text-[10px] mx-0.5">KQ/KR</Badge>
          </p>
        </div>
      </div>

      <Tabs defaultValue="pin-translate">
        <TabsList className="w-full">
          <TabsTrigger value="pin-translate" className="flex-1 text-xs">PIN Translate<Badge variant="outline" className="font-mono text-[9px] ml-1.5 px-1">CA/CB</Badge></TabsTrigger>
          <TabsTrigger value="pin-verify" className="flex-1 text-xs">PIN Verify<Badge variant="outline" className="font-mono text-[9px] ml-1.5 px-1">DA/DB</Badge></TabsTrigger>
          <TabsTrigger value="cvv-gen" className="flex-1 text-xs">CVV Gen<Badge variant="outline" className="font-mono text-[9px] ml-1.5 px-1">CW/CX</Badge></TabsTrigger>
          <TabsTrigger value="cvv-verify" className="flex-1 text-xs">CVV Verify<Badge variant="outline" className="font-mono text-[9px] ml-1.5 px-1">CY/CZ</Badge></TabsTrigger>
          <TabsTrigger value="arqc" className="flex-1 text-xs">ARQC/ARPC<Badge variant="outline" className="font-mono text-[9px] ml-1.5 px-1">KQ/KR</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="pin-translate" className="mt-4"><PinTranslateTab symKeys={symKeys} /></TabsContent>
        <TabsContent value="pin-verify"    className="mt-4"><PinVerifyTab symKeys={symKeys} /></TabsContent>
        <TabsContent value="cvv-gen"       className="mt-4"><CvvGenTab symKeys={symKeys} /></TabsContent>
        <TabsContent value="cvv-verify"    className="mt-4"><CvvVerifyTab symKeys={symKeys} /></TabsContent>
        <TabsContent value="arqc"          className="mt-4"><ArqcTab symKeys={symKeys} /></TabsContent>
      </Tabs>
    </div>
  );
}
