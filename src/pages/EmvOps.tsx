import React, { useState } from 'react';
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

// ── PIN Generate (JA/JB) ─────────────────────────────────────────────────

function PinGenTab() {
  const [pinLen, setPinLen] = useState('04');
  const [result, setResult] = useState<{ pinLen: string; pinUnderLmk: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const n = parseInt(pinLen);
    if (isNaN(n) || n < 4 || n > 12) return toast.error('PIN length must be 4–12');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/generate', { pinLen: String(n).padStart(2, '0') }).then(x => x.data);
      if (r.status === 'OK') { setResult({ pinLen: r.pinLen, pinUnderLmk: r.pinUnderLmk }); toast.success('PIN generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate Random PIN — JA/JB</CardTitle>
      <CardDescription>Generate a random PIN of specified length, returned encrypted under LMK. Use the PIN-under-LMK as input to PVV Generate or PIN-to-ZPK operations.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <Field label="PIN Length (4–12)" id="pg-len" value={pinLen} onChange={setPinLen} placeholder="04" hint="Number of PIN digits to generate" />
      <Button onClick={run} disabled={busy} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate PIN'}
      </Button>
      {result && <>
        <ResultBox label="PIN Length" value={result.pinLen} />
        <ResultBox label="PIN under LMK (16 hex)" value={result.pinUnderLmk} />
      </>}
    </CardContent></Card>
  );
}

// ── PVV Generate (DG/DH) ─────────────────────────────────────────────────

function PvvGenTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [pvkId, setPvkId] = useState('');
  const [pan, setPan] = useState('');
  const [pvki, setPvki] = useState('1');
  const [pinUnderLmk, setPinUnderLmk] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!pvkId) return toast.error('Pick PVK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinUnderLmk)) return toast.error('PIN-under-LMK must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/pvv', { pvkKeyId: pvkId, pan, pvki, pinUnderLmk }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.pvv); toast.success('PVV generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate VISA PVV — DG/DH</CardTitle>
      <CardDescription>Generate a VISA PIN Verification Value from a PIN-under-LMK and PVK. PVV is stored on the card/database for later PIN verification.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>PVK (PIN Verification Key)</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="PAN (full)" id="pvv-pan" value={pan} onChange={setPan} placeholder="4111111111111111" hint="Full PAN — rightmost 12 excl. check digit extracted automatically" /></div>
        <Field label="PVKI (0–6)" id="pvv-pvki" value={pvki} onChange={setPvki} placeholder="1" hint="PIN Verification Key Index" />
      </div>
      <Field label="PIN under LMK (16 hex)" id="pvv-pul" value={pinUnderLmk} onChange={setPinUnderLmk} placeholder="A1B2C3D4E5F60708A1B2C3D4E5F60708" hint="Output of Generate PIN (JA) or PIN Translate to LMK" />
      <Button onClick={run} disabled={busy || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate PVV'}
      </Button>
      <ResultBox label="PVV (4 decimal digits)" value={result} />
    </CardContent></Card>
  );
}

// ── IBM Offset Generate (DE/DF) ───────────────────────────────────────────

function IbmOffsetTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [pvkId, setPvkId] = useState('');
  const [pinUnderLmk, setPinUnderLmk] = useState('');
  const [pan, setPan] = useState('');
  const [decimTable, setDecimTable] = useState('0123456789012345');
  const [checkLen, setCheckLen] = useState('4');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!pvkId) return toast.error('Pick PVK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinUnderLmk)) return toast.error('PIN-under-LMK must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/ibm-offset', { pvkKeyId: pvkId, pinUnderLmk, pan, decimTable, checkLen }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.offset); toast.success('IBM offset generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate IBM PIN Offset — DE/DF</CardTitle>
      <CardDescription>Generate an IBM 3624 PIN offset from a PIN-under-LMK and PVK. The offset is stored and later used to verify the cardholder PIN.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>PVK (PIN Verification Key)</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      <Field label="PIN under LMK (16 hex)" id="off-pul" value={pinUnderLmk} onChange={setPinUnderLmk} placeholder="A1B2C3D4E5F60708..." />
      <div className="grid grid-cols-2 gap-3">
        <Field label="PAN (full)" id="off-pan" value={pan} onChange={setPan} placeholder="4111111111111111" />
        <Field label="Check Length" id="off-cl" value={checkLen} onChange={setCheckLen} placeholder="4" hint="1–12 digits to verify" />
      </div>
      <Field label="Decimalization Table (16 hex)" id="off-dt" value={decimTable} onChange={setDecimTable} placeholder="0123456789012345" />
      <Button onClick={run} disabled={busy || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate Offset'}
      </Button>
      <ResultBox label="IBM PIN Offset (8 digits)" value={result} />
    </CardContent></Card>
  );
}

// ── PIN Verify Visa (DC/DD) ───────────────────────────────────────────────

function PinVerifyVisaTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [tpkId, setTpkId] = useState('');
  const [pvkId, setPvkId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [pvki, setPvki] = useState('1');
  const [pvv, setPvv] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!tpkId || !pvkId) return toast.error('Pick TPK and PVK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be 16 hex chars');
    if (!/^\d{4}$/.test(pvv)) return toast.error('PVV must be 4 decimal digits');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/verify-visa', { tpkKeyId: tpkId, pvkKeyId: pvkId, pinBlock, pan, pvki, pvv }).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'PIN verified — errCode 00' }); toast.success('PIN OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Verify VISA PVV — DC/DD</CardTitle>
      <CardDescription>Verify a terminal PIN block against the stored VISA PVV. Decrypts PIN under TPK, computes PVV, compares with provided PVV value.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>TPK</Label><KeySel value={tpkId} onChange={setTpkId} keys={symKeys} neededTypes={['TPK','TMK','008']} /></div>
        <div className="space-y-1.5"><Label>PVK</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="dcv-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (full)" id="dcv-pan" value={pan} onChange={setPan} placeholder="4111111111111111" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PVKI (0–6)" id="dcv-pvki" value={pvki} onChange={setPvki} placeholder="1" />
        <Field label="PVV (4 decimal digits)" id="dcv-pvv" value={pvv} onChange={setPvv} placeholder="1234" />
      </div>
      <Button onClick={run} disabled={busy || !tpkId || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify PIN (VISA)'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── PIN Translate ZPK→ZPK (CC/CD) ────────────────────────────────────────

function PinTranslateZpkTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!srcId || !dstId) return toast.error('Pick source and destination ZPK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/translate-zpk', { srcZpkKeyId: srcId, dstZpkKeyId: dstId, pinBlock, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.translatedPinBlock); toast.success('PIN translated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Translate ZPK→ZPK — CC/CD</CardTitle>
      <CardDescription>Translate a PIN block from one Zone PIN Key to another. Used when routing a PIN block between different network zones.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Source ZPK</Label><KeySel value={srcId} onChange={setSrcId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
        <div className="space-y-1.5"><Label>Destination ZPK</Label><KeySel value={dstId} onChange={setDstId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex, under src ZPK)" id="cc-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (12 digits)" id="cc-pan" value={pan} onChange={setPan} placeholder="123456789012" hint="12 rightmost excl. check digit" />
      </div>
      <Button onClick={run} disabled={busy || !srcId || !dstId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Translating…' : 'Translate PIN ZPK→ZPK'}
      </Button>
      <ResultBox label="Translated PIN Block (under dst ZPK)" value={result} />
    </CardContent></Card>
  );
}

// ── Clear PIN Encrypt (BA/BB) ─────────────────────────────────────────────

function ClearPinEncryptTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zpkId, setZpkId] = useState('');
  const [clearPin, setClearPin] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!zpkId) return toast.error('Pick ZPK');
    if (!/^\d{4,12}$/.test(clearPin)) return toast.error('PIN must be 4–12 decimal digits');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/encrypt-clear', { clearPin, zpkKeyId: zpkId, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.translatedPinBlock); toast.success('PIN block generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Encrypt Clear PIN — BA/BB</CardTitle>
      <CardDescription>Encrypt a clear PIN under a ZPK to produce a PIN block. Useful for testing and PIN mailer generation. Never expose clear PINs in production.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>ZPK</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Clear PIN (4–12 digits)" id="ba-pin" value={clearPin} onChange={setClearPin} placeholder="1234" />
        <Field label="PAN (12 digits)" id="ba-pan" value={pan} onChange={setPan} placeholder="123456789012" hint="12 rightmost excl. check digit" />
      </div>
      <Button onClick={run} disabled={busy || !zpkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Encrypting…' : 'Encrypt Clear PIN'}
      </Button>
      <ResultBox label="PIN Block (16 hex, under ZPK)" value={result} />
    </CardContent></Card>
  );
}

// ── PIN Derive IBM (EE/EF) ────────────────────────────────────────────────

function PinDeriveTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [pvkId, setPvkId] = useState('');
  const [offset, setOffset] = useState('');
  const [pinValidData, setPinValidData] = useState('');
  const [decimTable, setDecimTable] = useState('0123456789012345');
  const [checkLen, setCheckLen] = useState('4');
  const [result, setResult] = useState<{ pinLen: string; pin: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!pvkId) return toast.error('Pick PVK');
    if (!offset) return toast.error('Offset required');
    if (!pinValidData) return toast.error('PIN validation data required');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/derive-ibm', { pvkKeyId: pvkId, offset, checkLen, decimTable, pinValidData }).then(x => x.data);
      if (r.status === 'OK') { setResult({ pinLen: r.pinLen, pin: r.pin }); toast.success('PIN derived'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Derive PIN from IBM Offset — EE/EF</CardTitle>
      <CardDescription>Recover the clear PIN from an IBM 3624 offset and PVK. Inverse of the IBM Offset Generate operation.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>PVK</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="IBM Offset (12 digits)" id="ee-off" value={offset} onChange={setOffset} placeholder="000000000000" />
        <Field label="Check Length" id="ee-cl" value={checkLen} onChange={setCheckLen} placeholder="4" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Validation Data (12 digits)" id="ee-pvd" value={pinValidData} onChange={setPinValidData} placeholder="123456789012" />
        <Field label="Decimalization Table (16 hex)" id="ee-dt" value={decimTable} onChange={setDecimTable} placeholder="0123456789012345" />
      </div>
      <Button onClick={run} disabled={busy || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Deriving…' : 'Derive PIN'}
      </Button>
      {result && <>
        <ResultBox label="PIN Length" value={result.pinLen} />
        <ResultBox label="Clear PIN" value={result.pin} />
      </>}
    </CardContent></Card>
  );
}

// ── PIN to LMK (JC/JE) ───────────────────────────────────────────────────

function PinToLmkTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [keyScheme, setKeyScheme] = useState('TPK');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState<{ pinLen: string; pinUnderLmk: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!keyId) return toast.error('Pick a key');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/to-lmk', { keyId, inputKeyScheme: keyScheme, pinBlock, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult({ pinLen: r.pinLen, pinUnderLmk: r.pinUnderLmk }); toast.success('PIN translated to LMK'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Translate to LMK — JC/JE</CardTitle>
      <CardDescription>Translate a PIN block encrypted under TPK or ZPK into a PIN-under-LMK. Output is used as input to PVV/offset generation.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Input Key Type</Label>
          <select value={keyScheme} onChange={(e) => setKeyScheme(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="TPK">TPK (terminal key) → JC</option>
            <option value="ZPK">ZPK (zone key) → JE</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label>Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} neededTypes={keyScheme === 'ZPK' ? ['ZPK','001'] : ['TPK','TMK','008']} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="jc-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (12 digits)" id="jc-pan" value={pan} onChange={setPan} placeholder="123456789012" />
      </div>
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Translating…' : 'Translate PIN → LMK'}
      </Button>
      {result && <>
        <ResultBox label="PIN Length" value={result.pinLen} />
        <ResultBox label="PIN under LMK (16 hex)" value={result.pinUnderLmk} />
      </>}
    </CardContent></Card>
  );
}

// ── PIN from LMK (JG/JH) ─────────────────────────────────────────────────

function PinFromLmkTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zpkId, setZpkId] = useState('');
  const [pinLen, setPinLen] = useState('04');
  const [pinUnderLmk, setPinUnderLmk] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!zpkId) return toast.error('Pick ZPK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinUnderLmk)) return toast.error('PIN-under-LMK must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/from-lmk', { pinLen: String(parseInt(pinLen)).padStart(2,'0'), pinUnderLmk, zpkKeyId: zpkId, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.pinBlock); toast.success('PIN block generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">PIN Translate LMK→ZPK — JG/JH</CardTitle>
      <CardDescription>Translate a PIN-under-LMK into a PIN block encrypted under a ZPK. Used to distribute PIN to a network endpoint.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>ZPK</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="PIN Length" id="jg-len" value={pinLen} onChange={setPinLen} placeholder="04" />
        <div className="col-span-2"><Field label="PIN under LMK (16 hex)" id="jg-pul" value={pinUnderLmk} onChange={setPinUnderLmk} placeholder="A1B2C3D4..." /></div>
      </div>
      <Field label="PAN (12 digits)" id="jg-pan" value={pan} onChange={setPan} placeholder="123456789012" />
      <Button onClick={run} disabled={busy || !zpkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Translating…' : 'Translate LMK → ZPK'}
      </Button>
      <ResultBox label="PIN Block (16 hex, under ZPK)" value={result} />
    </CardContent></Card>
  );
}

// ── MAC Generate (M6/M7) ─────────────────────────────────────────────────

function MacGenTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [dataHex, setDataHex] = useState('');
  const [alg, setAlg] = useState('01');
  const [mode, setMode] = useState('0');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!keyId) return toast.error('Pick MAC key');
    if (!dataHex || dataHex.length % 2 !== 0) return toast.error('Data must be even-length hex');
    setBusy(true);
    try {
      const r = await api.post('/crypto/mac/generate', { keyId, dataHex, algorithm: alg, mode }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.mac); toast.success('MAC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate MAC — M6/M7</CardTitle>
      <CardDescription>Generate a Message Authentication Code using DES or 3DES in ECB or CBC mode. MAC is 16 hex chars (8 bytes).</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>MAC Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Algorithm</Label>
          <select value={alg} onChange={(e) => setAlg(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="01">01 — DES</option>
            <option value="03">03 — 3DES</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="0">0 — ECB</option>
            <option value="1">1 — CBC Final</option>
            <option value="2">2 — CBC Initial</option>
            <option value="3">3 — CBC Intermediate</option>
          </select>
        </div>
      </div>
      <Field label="Data (hex)" id="m6-data" value={dataHex} onChange={setDataHex} placeholder="9F02060000000010009F..." hint="Message data to MAC, hex-encoded" />
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Computing…' : 'Generate MAC'}
      </Button>
      <ResultBox label="MAC (16 hex = 8 bytes)" value={result} />
    </CardContent></Card>
  );
}

// ── MAC Verify (M8/M9) ───────────────────────────────────────────────────

function MacVerifyTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [dataHex, setDataHex] = useState('');
  const [mac, setMac] = useState('');
  const [alg, setAlg] = useState('01');
  const [mode, setMode] = useState('0');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!keyId) return toast.error('Pick MAC key');
    if (!dataHex || dataHex.length % 2 !== 0) return toast.error('Data must be even-length hex');
    if (!/^[0-9A-Fa-f]{16}$/.test(mac)) return toast.error('MAC must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/mac/verify', { keyId, dataHex, mac, algorithm: alg, mode }).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'MAC valid — errCode 00' }); toast.success('MAC OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Verify MAC — M8/M9</CardTitle>
      <CardDescription>Verify a MAC over message data. Returns OK (errCode 00) if valid, error 01 if MAC mismatch.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>MAC Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Algorithm</Label>
          <select value={alg} onChange={(e) => setAlg(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="01">01 — DES</option>
            <option value="03">03 — 3DES</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="0">0 — ECB</option>
            <option value="1">1 — CBC Final</option>
          </select>
        </div>
      </div>
      <Field label="Data (hex)" id="m8-data" value={dataHex} onChange={setDataHex} placeholder="9F02060000000010..." />
      <Field label="MAC to verify (16 hex)" id="m8-mac" value={mac} onChange={setMac} placeholder="A1B2C3D4E5F60708" />
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify MAC'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── Export ZPK under ZMK (GC/GD) ─────────────────────────────────────────

function ExportZmkTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zmkId, setZmkId] = useState('');
  const [zpkId, setZpkId] = useState('');
  const [result, setResult] = useState<{ zpkUnderZmk: string; kcv: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!zmkId || !zpkId) return toast.error('Pick ZMK and ZPK');
    setBusy(true);
    try {
      const r = await api.post('/crypto/key/export-zmk', { zmkKeyId: zmkId, zpkKeyId: zpkId }).then(x => x.data);
      if (r.status === 'OK') { setResult({ zpkUnderZmk: r.zpkUnderZmk, kcv: r.kcv }); toast.success('ZPK exported under ZMK'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Export ZPK under ZMK — GC/GD</CardTitle>
      <CardDescription>Re-encrypt a ZPK from LMK protection to ZMK protection for distribution to a third party or external HSM.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>ZMK (wrapping key)</Label><KeySel value={zmkId} onChange={setZmkId} keys={symKeys} neededTypes={['ZMK','000']} /></div>
        <div className="space-y-1.5"><Label>ZPK (key to export)</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
      </div>
      <Button onClick={run} disabled={busy || !zmkId || !zpkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Exporting…' : 'Export ZPK under ZMK'}
      </Button>
      {result && <>
        <ResultBox label="ZPK under ZMK" value={result.zpkUnderZmk} />
        <ResultBox label="KCV (6 hex)" value={result.kcv} />
      </>}
    </CardContent></Card>
  );
}

// ── Interchange PIN Verify IBM (EA/EB) ────────────────────────────────────

function InterchangePinVerifyIbmTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zpkId, setZpkId] = useState('');
  const [pvkId, setPvkId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!zpkId || !pvkId) return toast.error('Pick ZPK and PVK');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('PIN block must be 16 hex chars');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/verify-interchange-ibm', { tpkKeyId: zpkId, pvkKeyId: pvkId, pinBlock, pan }).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'PIN verified — errCode 00' }); toast.success('PIN OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Verify Interchange PIN IBM 3624 — EA/EB</CardTitle>
      <CardDescription>Verify PIN block encrypted under ZPK at the interchange level using IBM 3624 algorithm.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>ZPK (interchange PIN key)</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
        <div className="space-y-1.5"><Label>PVK</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="ea-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (12 digits)" id="ea-pan" value={pan} onChange={setPan} placeholder="123456789012" />
      </div>
      <Button onClick={run} disabled={busy || !zpkId || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify Interchange PIN (IBM)'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── Interchange PIN Verify VISA (EC/ED) ──────────────────────────────────

function InterchangePinVerifyVisaTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zpkId, setZpkId] = useState('');
  const [pvkId, setPvkId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [pan, setPan] = useState('');
  const [pvki, setPvki] = useState('1');
  const [pvv, setPvv] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!zpkId || !pvkId) return toast.error('Pick ZPK and PVK');
    setBusy(true);
    try {
      const r = await api.post('/crypto/pin/verify-interchange-visa', { tpkKeyId: zpkId, pvkKeyId: pvkId, pinBlock, pan, pvki, pvv }).then(x => x.data);
      if (r.status === 'OK') { setResult({ ok: true, msg: 'PIN verified — errCode 00' }); toast.success('PIN OK'); }
      else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Verify Interchange PIN VISA PVV — EC/ED</CardTitle>
      <CardDescription>Verify PIN block encrypted under ZPK at interchange using VISA PVV method.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>ZPK</Label><KeySel value={zpkId} onChange={setZpkId} keys={symKeys} neededTypes={['ZPK','001']} /></div>
        <div className="space-y-1.5"><Label>PVK</Label><KeySel value={pvkId} onChange={setPvkId} keys={symKeys} neededTypes={['PVK','ZPK','001']} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PIN Block (16 hex)" id="ec-pb" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="PAN (full)" id="ec-pan" value={pan} onChange={setPan} placeholder="4111111111111111" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PVKI" id="ec-pvki" value={pvki} onChange={setPvki} placeholder="1" />
        <Field label="PVV (4 digits)" id="ec-pvv" value={pvv} onChange={setPvv} placeholder="1234" />
      </div>
      <Button onClick={run} disabled={busy || !zpkId || !pvkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify Interchange PIN (VISA)'}
      </Button>
      {result && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── CVV Variant (CVV2 / iCVV / DCVC3) ────────────────────────────────────

function CvvVariantTab({ symKeys, initSvc, label, desc, cmdNote }: {
  symKeys: KeySummary[]; initSvc: string; label: string; desc: string; cmdNote: string;
}) {
  const [cvkaId, setCvkaId] = useState('');
  const [cvkbId, setCvkbId] = useState('');
  const [pan, setPan] = useState('');
  const [expDate, setExpDate] = useState('');
  const [svcCode] = useState(initSvc);
  const [cvv, setCvv] = useState('');
  const [mode, setMode] = useState<'gen'|'verify'>('gen');
  const [result, setResult] = useState<string | { ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!cvkaId) return toast.error('Pick CVK-A');
    if (!/^\d{13,19}$/.test(pan)) return toast.error('PAN must be 13–19 digits');
    if (!/^\d{4}$/.test(expDate)) return toast.error('Expiry must be 4 digits (YYMM)');
    if (mode === 'verify' && !cvv) return toast.error('Enter CVV to verify');
    setBusy(true);
    try {
      if (mode === 'gen') {
        const r = await api.post('/crypto/cvv/generate', { cvkaKeyId: cvkaId, cvkbKeyId: cvkbId || cvkaId, pan, expDate, serviceCode: svcCode }).then(x => x.data);
        if (r.status === 'OK') { setResult(r.cvv); toast.success(`${label} generated`); }
        else toast.error(`${r.errCode}: ${r.errText}`);
      } else {
        const r = await api.post('/crypto/cvv/verify', { cvkaKeyId: cvkaId, cvkbKeyId: cvkbId || cvkaId, pan, expDate, serviceCode: svcCode, cvv }).then(x => x.data);
        if (r.status === 'OK') { setResult({ ok: true, msg: `${label} valid — errCode 00` }); toast.success(`${label} OK`); }
        else { setResult({ ok: false, msg: `Error ${r.errCode}: ${r.errText}` }); toast.error(`${r.errCode}: ${r.errText}`); }
      }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">{label} — {cmdNote}</CardTitle>
      <CardDescription>{desc}</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mode === 'gen' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('gen'); setResult(null); }}>Generate</Button>
        <Button variant={mode === 'verify' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('verify'); setResult(null); }}>Verify</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>CVK-A</Label><KeySel value={cvkaId} onChange={setCvkaId} keys={symKeys} neededTypes={['CVK','00A']} /></div>
        <div className="space-y-1.5"><Label>CVK-B <span className="text-muted-foreground text-xs">(blank = CVK-A)</span></Label><KeySel value={cvkbId} onChange={setCvkbId} keys={symKeys} neededTypes={['CVK','00A']} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="PAN (full)" id={`${initSvc}-pan`} value={pan} onChange={setPan} placeholder="4111111111111111" /></div>
        <Field label="Expiry (YYMM)" id={`${initSvc}-exp`} value={expDate} onChange={setExpDate} placeholder="2512" />
      </div>
      {mode === 'verify' && <Field label={`${label} to verify (3 digits)`} id={`${initSvc}-val`} value={cvv} onChange={setCvv} placeholder="123" />}
      <Button onClick={run} disabled={busy || !cvkaId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Processing…' : `${mode === 'gen' ? 'Generate' : 'Verify'} ${label}`}
      </Button>
      {result && typeof result === 'string' && <ResultBox label={`${label} (3 digits)`} value={result} />}
      {result && typeof result === 'object' && <ResultBox label={result.ok ? 'Result' : 'Error'} value={result.msg} err={!result.ok} />}
    </CardContent></Card>
  );
}

// ── ARQC CVN Variant ──────────────────────────────────────────────────────

function ArqcCvnTab({ symKeys, defaultMode, title, desc, useEmv4 = false }: {
  symKeys: KeySummary[]; defaultMode: string; title: string; desc: string; useEmv4?: boolean;
}) {
  const [imkId, setImkId] = useState('');
  const [mode, setMode] = useState(defaultMode);
  const [atc, setAtc] = useState('');
  const [arqc, setArqc] = useState('');
  const [transData, setTransData] = useState('');
  const [arc, setArc] = useState('3030');
  const [pan, setPan] = useState('');
  const [panSeq, setPanSeq] = useState('00');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = useEmv4 ? '/crypto/arqc/emv4' : '/crypto/arqc';
  const run = async () => {
    if (!imkId) return toast.error('Pick IMK-AC');
    if (!/^[0-9A-Fa-f]{4}$/.test(atc)) return toast.error('ATC must be 4 hex chars');
    if (!/^[0-9A-Fa-f]{16}$/.test(arqc)) return toast.error('ARQC must be 16 hex chars');
    if (!/^\d{12}$/.test(pan)) return toast.error('PAN must be 12 digits');
    setBusy(true);
    try {
      const r = await api.post(endpoint, { imkKeyId: imkId, mode, atc, arqc, transData, arc, pan, panSeqNo: panSeq }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.arpc); toast.success('ARQC verified / ARPC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{desc}</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>IMK-AC</Label><KeySel value={imkId} onChange={setImkId} keys={symKeys} neededTypes={['IMK-AC','00A']} /></div>
        <div className="space-y-1.5">
          <Label>Mode <span className="text-muted-foreground text-xs">(preset for this CVN)</span></Label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="01">01 — M/Chip (CVN12/13)</option>
            <option value="03">03 — EMV/Visa (CVN14/15)</option>
            <option value="05">05 — Mastercard CPA (CVN10)</option>
            <option value="41">41 — CPA</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ATC (4 hex)" id={`acvn-${defaultMode}-atc`} value={atc} onChange={setAtc} placeholder="0012" />
        <Field label="ARQC (16 hex)" id={`acvn-${defaultMode}-arqc`} value={arqc} onChange={setArqc} placeholder="A1B2C3D4E5F60708" />
      </div>
      <Field label="Transaction Data (hex)" id={`acvn-${defaultMode}-td`} value={transData} onChange={setTransData} placeholder="9F02060000000010009F..." />
      <div className="grid grid-cols-3 gap-3">
        <Field label="ARC (4 hex)" id={`acvn-${defaultMode}-arc`} value={arc} onChange={setArc} placeholder="3030" hint="3030=approved" />
        <Field label="PAN (12 digits)" id={`acvn-${defaultMode}-pan`} value={pan} onChange={setPan} placeholder="123456789012" />
        <Field label="PAN Seq" id={`acvn-${defaultMode}-seq`} value={panSeq} onChange={setPanSeq} placeholder="00" />
      </div>
      <Button onClick={run} disabled={busy || !imkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Processing…' : 'Verify ARQC / Generate ARPC'}
      </Button>
      <ResultBox label="ARPC (16 hex)" value={result} />
    </CardContent></Card>
  );
}

// ── MAC Generate & Verify (combined) ─────────────────────────────────────

function MacGenVerifyTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [dataHex, setDataHex] = useState('');
  const [mac, setMac] = useState('');
  const [alg, setAlg] = useState('01');
  const [genResult, setGenResult] = useState('');
  const [verResult, setVerResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!keyId) return toast.error('Pick MAC key');
    if (!dataHex || dataHex.length % 2 !== 0) return toast.error('Data must be even-length hex');
    setBusy(true);
    try {
      const gen = await api.post('/crypto/mac/generate', { keyId, dataHex, algorithm: alg, mode: '0' }).then(x => x.data);
      if (gen.status !== 'OK') { toast.error(`Generate failed: ${gen.errCode}`); return; }
      setGenResult(gen.mac);
      const macToVerify = mac || gen.mac;
      const ver = await api.post('/crypto/mac/verify', { keyId, dataHex, mac: macToVerify, algorithm: alg, mode: '0' }).then(x => x.data);
      if (ver.status === 'OK') { setVerResult({ ok: true, msg: `MAC verified against ${macToVerify}` }); toast.success('MAC gen + verify OK'); }
      else { setVerResult({ ok: false, msg: `Verify failed: ${ver.errCode} ${ver.errText}` }); }
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate and Verify EMV MAC — M6+M8</CardTitle>
      <CardDescription>Generate a MAC then immediately verify it. Leave MAC field blank to verify against freshly generated value.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>MAC Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <div className="space-y-1.5">
        <Label>Algorithm</Label>
        <select value={alg} onChange={(e) => setAlg(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="01">01 — DES</option>
          <option value="03">03 — 3DES</option>
        </select>
      </div>
      <Field label="Data (hex)" id="mgv-data" value={dataHex} onChange={setDataHex} placeholder="9F02060000000010..." />
      <Field label="MAC to verify (blank = use generated)" id="mgv-mac" value={mac} onChange={setMac} placeholder="leave blank to auto-verify generated MAC" />
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Processing…' : 'Generate & Verify MAC'}
      </Button>
      {genResult && <ResultBox label="Generated MAC (16 hex)" value={genResult} />}
      {verResult && <ResultBox label={verResult.ok ? 'Verify Result' : 'Verify Error'} value={verResult.msg} err={!verResult.ok} />}
    </CardContent></Card>
  );
}

// ── MAC for PIN Change ────────────────────────────────────────────────────

function MacPinChangeTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [pinBlock, setPinBlock] = useState('');
  const [newPinBlock, setNewPinBlock] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!keyId) return toast.error('Pick MAC key');
    if (!/^[0-9A-Fa-f]{16}$/.test(pinBlock)) return toast.error('Old PIN block must be 16 hex chars');
    if (!/^[0-9A-Fa-f]{16}$/.test(newPinBlock)) return toast.error('New PIN block must be 16 hex chars');
    setBusy(true);
    try {
      const dataHex = pinBlock + newPinBlock;
      const r = await api.post('/crypto/mac/generate', { keyId, dataHex, algorithm: '03', mode: '1' }).then(x => x.data);
      if (r.status === 'OK') { setResult(r.mac); toast.success('PIN Change MAC generated'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Generate EMV MAC for PIN Change — M6/M7</CardTitle>
      <CardDescription>Generate a 3DES CBC MAC over concatenated old + new PIN blocks for a PIN Change script command.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>Session Key (MAC)</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Old PIN Block (16 hex)" id="pc-old" value={pinBlock} onChange={setPinBlock} placeholder="0412AC..." />
        <Field label="New PIN Block (16 hex)" id="pc-new" value={newPinBlock} onChange={setNewPinBlock} placeholder="0412AC..." />
      </div>
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Computing…' : 'Generate PIN Change MAC'}
      </Button>
      <ResultBox label="MAC (16 hex)" value={result} />
    </CardContent></Card>
  );
}

// ── Encrypt Data (M0/M1) ─────────────────────────────────────────────────

function EncryptDataTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [dataHex, setDataHex] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!keyId) return toast.error('Pick key');
    if (!dataHex || dataHex.length % 2 !== 0) return toast.error('Data must be even-length hex');
    setBusy(true);
    try {
      const r = await api.post('/crypto/encrypt', { keyId, plaintextHex: dataHex }).then(x => x.data);
      if (r.ciphertextHex || r.status === 'OK') { setResult(r.ciphertextHex); toast.success('Encrypted'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Encrypt Data — M0/M1</CardTitle>
      <CardDescription>Encrypt a data block under a symmetric key stored in the vault. Output is ciphertext hex.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>Encryption Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} neededTypes={['ZPK','ZMK','001','000','DATA']} /></div>
      <Field label="Plaintext (hex)" id="enc-data" value={dataHex} onChange={setDataHex} placeholder="4D6573736167652048657265" />
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Encrypting…' : 'Encrypt Data'}
      </Button>
      <ResultBox label="Ciphertext (hex)" value={result} />
    </CardContent></Card>
  );
}

// ── Decrypt Data (M2/M3) ─────────────────────────────────────────────────

function DecryptDataTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [ciphertextHex, setCiphertextHex] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!keyId) return toast.error('Pick key');
    if (!ciphertextHex || ciphertextHex.length % 2 !== 0) return toast.error('Ciphertext must be even-length hex');
    setBusy(true);
    try {
      const r = await api.post('/crypto/decrypt', { keyId, ciphertextHex }).then(x => x.data);
      if (r.plaintextHex || r.status === 'OK') { setResult(r.plaintextHex); toast.success('Decrypted'); }
      else toast.error(`${r.errCode}: ${r.errText}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">Decrypt Data — M2/M3</CardTitle>
      <CardDescription>Decrypt a ciphertext block under a symmetric key stored in the vault.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>Decryption Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} neededTypes={['ZPK','ZMK','001','000','DATA']} /></div>
      <Field label="Ciphertext (hex)" id="dec-data" value={ciphertextHex} onChange={setCiphertextHex} placeholder="A1B2C3D4E5F6..." />
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Decrypting…' : 'Decrypt Data'}
      </Button>
      <ResultBox label="Plaintext (hex)" value={result} />
    </CardContent></Card>
  );
}

// ── ReEncrypt Data (M0→M2 round-trip) ────────────────────────────────────

function ReEncryptDataTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [srcKeyId, setSrcKeyId] = useState('');
  const [dstKeyId, setDstKeyId] = useState('');
  const [ciphertextHex, setCiphertextHex] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!srcKeyId || !dstKeyId) return toast.error('Pick source and destination keys');
    if (!ciphertextHex || ciphertextHex.length % 2 !== 0) return toast.error('Ciphertext must be even-length hex');
    setBusy(true);
    try {
      const dec = await api.post('/crypto/decrypt', { keyId: srcKeyId, ciphertextHex }).then(x => x.data);
      if (!dec.plaintextHex) { toast.error(`Decrypt failed: ${dec.errCode}`); return; }
      const enc = await api.post('/crypto/encrypt', { keyId: dstKeyId, plaintextHex: dec.plaintextHex }).then(x => x.data);
      if (enc.ciphertextHex) { setResult(enc.ciphertextHex); toast.success('ReEncrypted'); }
      else toast.error(`Encrypt failed: ${enc.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">ReEncrypt Data — M2 → M0</CardTitle>
      <CardDescription>Decrypt data under source key then re-encrypt under destination key. Used for key rotation and cross-zone re-encryption.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Source Key (decrypt)</Label><KeySel value={srcKeyId} onChange={setSrcKeyId} keys={symKeys} neededTypes={['ZPK','ZMK','001','000','DATA']} /></div>
        <div className="space-y-1.5"><Label>Destination Key (encrypt)</Label><KeySel value={dstKeyId} onChange={setDstKeyId} keys={symKeys} neededTypes={['ZPK','ZMK','001','000','DATA']} /></div>
      </div>
      <Field label="Ciphertext under source key (hex)" id="re-ct" value={ciphertextHex} onChange={setCiphertextHex} placeholder="A1B2C3D4..." />
      <Button onClick={run} disabled={busy || !srcKeyId || !dstKeyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Processing…' : 'ReEncrypt Data'}
      </Button>
      <ResultBox label="Ciphertext under destination key (hex)" value={result} />
    </CardContent></Card>
  );
}

// ── dCVV Verify (PM/PN) ───────────────────────────────────────────────────

function DcvvVerifyTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [pan, setPan] = useState('');
  const [expiry, setExpiry] = useState('');
  const [svcCode, setSvcCode] = useState('101');
  const [atc, setAtc] = useState('');
  const [dcvv, setDcvv] = useState('');
  const [result, setResult] = useState<{ verified: boolean; errCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!keyId) return toast.error('Pick MK-DCVV key');
    if (!pan || !expiry || !atc || !dcvv) return toast.error('Fill all fields');
    setBusy(true);
    try {
      const atcPad = atc.replace(/\D/g, '').padStart(6, '0');
      const r = await api.post('/crypto/dcvv/verify', {
        keyId, pan, expiry, serviceCode: svcCode, atc: atcPad, dcvv, schemeId: '0', version: '0',
      }).then(x => x.data);
      setResult(r);
      if (r.verified) toast.success('dCVV verified ✓');
      else toast.error(`dCVV invalid — ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">dCVV Verify — CVN17 <Badge variant="outline" className="font-mono text-[9px] ml-1">PM/PN</Badge></CardTitle>
      <CardDescription>Verify a Dynamic CVV from a Visa contactless/chip transaction. Derives card-unique key from MK-DCVV using PAN, then validates the dCVV against ATC+expiry.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>MK-DCVV Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <Field label="PAN (13–19 digits)" id="dcvv-pan" value={pan} onChange={setPan} placeholder="4111111111111111" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry (YYMM)" id="dcvv-exp" value={expiry} onChange={setExpiry} placeholder="2512" />
        <Field label="Service Code (3N)" id="dcvv-svc" value={svcCode} onChange={setSvcCode} placeholder="101" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ATC (6 decimal digits)" id="dcvv-atc" value={atc} onChange={setAtc} placeholder="000026" hint="Application Transaction Counter from card" />
        <Field label="dCVV (3 digits)" id="dcvv-val" value={dcvv} onChange={setDcvv} placeholder="123" />
      </div>
      <Button onClick={run} disabled={busy || !keyId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify dCVV'}
      </Button>
      {result && (
        <Alert variant={result.verified ? 'default' : 'destructive'}>
          {result.verified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>{result.verified ? 'dCVV is VALID' : `dCVV INVALID (err ${result.errCode})`}</AlertDescription>
        </Alert>
      )}
    </CardContent></Card>
  );
}

// ── CSC Calculate / Verify (RY/RZ) ────────────────────────────────────────

function CscTab({ symKeys, flag, label, desc }: { symKeys: KeySummary[]; flag: string; label: string; desc: string }) {
  const [keyId, setKeyId] = useState('');
  const [account, setAccount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [svcCode, setSvcCode] = useState('000');
  const [calcResult, setCalcResult] = useState<{ csc5?: string; csc4?: string; csc3?: string } | null>(null);
  const [csc5, setCsc5] = useState('');
  const [csc4, setCsc4] = useState('');
  const [csc3, setCsc3] = useState('');
  const [vrfyResult, setVrfyResult] = useState<{ result3?: string; result4?: string; result5?: string; verified?: boolean; errCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'calc' | 'verify'>('calc');

  const runCalc = async () => {
    if (!keyId || !account || !expiry) return toast.error('Fill all fields');
    setBusy(true);
    try {
      const r = await api.post('/crypto/csc/calculate', { keyId, flag, account: account.padStart(19, '0'), expiry, serviceCode: svcCode }).then(x => x.data);
      setCalcResult(r);
      if (r.errCode === '00') toast.success(`${label} calculated`);
      else toast.error(`Error ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const runVerify = async () => {
    if (!keyId || !account || !expiry || !csc3) return toast.error('Fill required fields');
    setBusy(true);
    try {
      const r = await api.post('/crypto/csc/verify', {
        keyId, flag, account: account.padStart(19, '0'), expiry, serviceCode: svcCode,
        csc5: csc5 || undefined, csc4: csc4 || undefined, csc3,
      }).then(x => x.data);
      setVrfyResult(r);
      if (r.verified) toast.success(`${label} verified ✓`);
      else toast.error(`${label} invalid — ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const vrfyIcon = (r?: string) => r === '0' ? '✓ pass' : r === '1' ? '— skip' : r === '2' ? '✗ fail' : '?';

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">{label} <Badge variant="outline" className="font-mono text-[9px] ml-1">RY/RZ</Badge></CardTitle>
      <CardDescription>{desc}</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>CSCK Key</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <Field label="Account Number (up to 19 digits)" id={`csc-${flag}-acct`} value={account} onChange={setAccount} placeholder="4111111111111111111" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry (YYMM)" id={`csc-${flag}-exp`} value={expiry} onChange={setExpiry} placeholder="2512" />
        {flag !== '0' && <Field label="Service Code (3N)" id={`csc-${flag}-svc`} value={svcCode} onChange={setSvcCode} placeholder="000" />}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={mode === 'calc' ? 'default' : 'outline'} onClick={() => setMode('calc')}>Calculate</Button>
        <Button size="sm" variant={mode === 'verify' ? 'default' : 'outline'} onClick={() => setMode('verify')}>Verify</Button>
      </div>
      {mode === 'calc' && (
        <>
          <Button onClick={runCalc} disabled={busy || !keyId} className="w-full sm:w-auto">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Calculating…' : `Calculate ${label}`}
          </Button>
          {calcResult && calcResult.csc3 && (
            <div className="space-y-2 pt-2"><Separator />
              <div className="grid grid-cols-3 gap-3 pt-2">
                <ResultBox label={`${label} 5-digit`} value={calcResult.csc5} />
                <ResultBox label={`${label} 4-digit`} value={calcResult.csc4} />
                <ResultBox label={`${label} 3-digit (iCSC)`} value={calcResult.csc3} />
              </div>
            </div>
          )}
        </>
      )}
      {mode === 'verify' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="5-digit (optional)" id={`csc-${flag}-v5`} value={csc5} onChange={setCsc5} placeholder="12345" />
            <Field label="4-digit (optional)" id={`csc-${flag}-v4`} value={csc4} onChange={setCsc4} placeholder="1234" />
            <Field label="3-digit (required)" id={`csc-${flag}-v3`} value={csc3} onChange={setCsc3} placeholder="123" />
          </div>
          <Button onClick={runVerify} disabled={busy || !keyId || !csc3} className="w-full sm:w-auto">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : `Verify ${label}`}
          </Button>
          {vrfyResult && (
            <Alert variant={vrfyResult.verified ? 'default' : 'destructive'}>
              {vrfyResult.verified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>
                5d: {vrfyIcon(vrfyResult.result5)} · 4d: {vrfyIcon(vrfyResult.result4)} · 3d: {vrfyIcon(vrfyResult.result3)}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </CardContent></Card>
  );
}

// ── HMAC Generate / Verify (LQ/LR · LS/LT) — SPA2 AAV ───────────────────

function HmacTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [keyId, setKeyId] = useState('');
  const [dataHex, setDataHex] = useState('');
  const [hmacResult, setHmacResult] = useState('');
  const [hmacToVerify, setHmacToVerify] = useState('');
  const [vrfyResult, setVrfyResult] = useState<{ verified: boolean; errCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'gen' | 'verify'>('gen');

  const runGen = async () => {
    if (!keyId || !dataHex) return toast.error('Fill all fields');
    setBusy(true);
    try {
      const r = await api.post('/crypto/hmac/generate', { keyId, dataHex, hashId: '06', hmacLen: '0020' }).then(x => x.data);
      if (r.errCode === '00') { setHmacResult(r.hmac); toast.success('HMAC generated'); }
      else toast.error(`Error ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const runVerify = async () => {
    if (!keyId || !dataHex || !hmacToVerify) return toast.error('Fill all fields');
    setBusy(true);
    try {
      const r = await api.post('/crypto/hmac/verify', { keyId, dataHex, hmac: hmacToVerify, hashId: '06' }).then(x => x.data);
      setVrfyResult(r);
      if (r.verified) toast.success('HMAC verified ✓');
      else toast.error(`HMAC invalid — ${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader>
      <CardTitle className="text-base">3DS SPA2 AAV — HMAC-SHA256 <Badge variant="outline" className="font-mono text-[9px] ml-1">LQ/LR · LS/LT</Badge></CardTitle>
      <CardDescription>Generate or verify an HMAC-SHA256 Accountholder Authentication Value for 3-D Secure SPA2 (MC 3DS v2). The HMAC key is stored under LMK 34-35 variant 1.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>HMAC Key (SPA2 / LMK 34-35)</Label><KeySel value={keyId} onChange={setKeyId} keys={symKeys} /></div>
      <Field label="Data (hex)" id="hmac-data" value={dataHex} onChange={setDataHex} placeholder="0102030405060708..." hint="AAV input buffer hex-encoded" />
      <div className="flex gap-2">
        <Button size="sm" variant={mode === 'gen' ? 'default' : 'outline'} onClick={() => setMode('gen')}>Generate HMAC</Button>
        <Button size="sm" variant={mode === 'verify' ? 'default' : 'outline'} onClick={() => setMode('verify')}>Verify HMAC</Button>
      </div>
      {mode === 'gen' && (
        <>
          <Button onClick={runGen} disabled={busy || !keyId} className="w-full sm:w-auto">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Generating…' : 'Generate HMAC-SHA256'}
          </Button>
          <ResultBox label="HMAC (SHA-256, 64 hex chars)" value={hmacResult} />
        </>
      )}
      {mode === 'verify' && (
        <>
          <Field label="HMAC to verify (hex)" id="hmac-verify" value={hmacToVerify} onChange={setHmacToVerify} placeholder="64 hex chars..." />
          <Button onClick={runVerify} disabled={busy || !keyId || !hmacToVerify} className="w-full sm:w-auto">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify HMAC'}
          </Button>
          {vrfyResult && (
            <Alert variant={vrfyResult.verified ? 'default' : 'destructive'}>
              {vrfyResult.verified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{vrfyResult.verified ? 'HMAC is VALID (SPA2 AAV verified)' : `HMAC INVALID (err ${vrfyResult.errCode})`}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </CardContent></Card>
  );
}

// ── Coming Soon Stub ──────────────────────────────────────────────────────

function ComingSoonTab({ title, desc, cmds }: { title: string; desc: string; cmds: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">Coming Soon</Badge>
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Command(s): <span className="font-mono">{cmds}</span></p>
        <p className="text-sm text-muted-foreground mt-1">This operation is not yet implemented in the gateway. It requires additional Thales command wiring.</p>
      </CardContent>
    </Card>
  );
}

// ── KEK Key Exchange ──────────────────────────────────────────────────────

function KekExchangeTab({ symKeys }: { symKeys: KeySummary[] }) {
  const [zmkId, setZmkId] = useState('');
  const [result, setResult] = useState<{ kcv: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!zmkId) return toast.error('Pick ZMK (KEK)');
    setBusy(true);
    try {
      const r = await api.post('/crypto/key/check-value', { keyId: zmkId }).then(x => x.data);
      if (r.errCode === '00') { setResult({ kcv: r.kcv }); toast.success('KEK check value generated'); }
      else toast.error(`${r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Card><CardHeader>
      <CardTitle className="text-base">KEK Key Exchange — ZMK Check Value</CardTitle>
      <CardDescription>Verify KEK (Key Encryption Key / ZMK) integrity by computing its check value (KCV). Use this to confirm key loading was successful.</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <div className="space-y-1.5"><Label>KEK / ZMK</Label><KeySel value={zmkId} onChange={setZmkId} keys={symKeys} neededTypes={['ZMK','000']} /></div>
      <Button onClick={run} disabled={busy || !zmkId} className="w-full sm:w-auto">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Computing…' : 'Generate KCV'}
      </Button>
      {result && <ResultBox label="KCV (6 hex)" value={result.kcv} />}
    </CardContent></Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Cmd({ code }: { code: string }) {
  return <Badge variant="outline" className="font-mono text-[9px] ml-1 px-1">{code}</Badge>;
}

export default function EmvOps() {
  const keysQ = useQuery<KeySummary[]>({ queryKey: ['keys'], queryFn: () => keysApi.list() });
  const symKeys = symFilter(keysQ.data ?? []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HSM Operations</h1>
          <p className="text-sm text-muted-foreground">Full Thales payShield operation suite — PIN, CVV, ARQC/ARPC, MAC, data encryption, key exchange</p>
        </div>
      </div>

      {/* ══ 1. PIN Operations ════════════════════════════════════════════════ */}
      <Section title="PIN Operations">
        <Tabs defaultValue="pin-gen">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="pin-gen"      className="text-xs">Generate PIN<Cmd code="JA/JB" /></TabsTrigger>
            <TabsTrigger value="pvv-gen"      className="text-xs">Generate PVV<Cmd code="DG/DH" /></TabsTrigger>
            <TabsTrigger value="ibm-offset"   className="text-xs">IBM Offset<Cmd code="DE/DF" /></TabsTrigger>
            <TabsTrigger value="derive-pin"   className="text-xs">Derive PIN<Cmd code="EE/EF" /></TabsTrigger>
            <TabsTrigger value="validate-pvv" className="text-xs">Validate PIN (PVV)<Cmd code="DC/DD" /></TabsTrigger>
            <TabsTrigger value="verify-ibm"   className="text-xs">Verify PIN IBM<Cmd code="DA/DB" /></TabsTrigger>
            <TabsTrigger value="verify-ich-ibm" className="text-xs">Interchange IBM<Cmd code="EA/EB" /></TabsTrigger>
            <TabsTrigger value="verify-ich-visa" className="text-xs">Interchange VISA<Cmd code="EC/ED" /></TabsTrigger>
            <TabsTrigger value="xlate-tpk"    className="text-xs">Translate TPK→ZPK<Cmd code="CA/CB" /></TabsTrigger>
            <TabsTrigger value="xlate-zpk"    className="text-xs">Translate ZPK→ZPK<Cmd code="CC/CD" /></TabsTrigger>
            <TabsTrigger value="clear-enc"    className="text-xs">Encrypt Clear PIN<Cmd code="BA/BB" /></TabsTrigger>
            <TabsTrigger value="to-lmk"       className="text-xs">PIN → LMK<Cmd code="JC/JE" /></TabsTrigger>
            <TabsTrigger value="from-lmk"     className="text-xs">LMK → ZPK<Cmd code="JG/JH" /></TabsTrigger>
          </TabsList>
          <TabsContent value="pin-gen"        className="mt-4"><PinGenTab /></TabsContent>
          <TabsContent value="pvv-gen"        className="mt-4"><PvvGenTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="ibm-offset"     className="mt-4"><IbmOffsetTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="derive-pin"     className="mt-4"><PinDeriveTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="validate-pvv"   className="mt-4"><PinVerifyVisaTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="verify-ibm"     className="mt-4"><PinVerifyTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="verify-ich-ibm" className="mt-4"><InterchangePinVerifyIbmTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="verify-ich-visa" className="mt-4"><InterchangePinVerifyVisaTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="xlate-tpk"      className="mt-4"><PinTranslateTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="xlate-zpk"      className="mt-4"><PinTranslateZpkTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="clear-enc"      className="mt-4"><ClearPinEncryptTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="to-lmk"         className="mt-4"><PinToLmkTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="from-lmk"       className="mt-4"><PinFromLmkTab symKeys={symKeys} /></TabsContent>
        </Tabs>
      </Section>

      {/* ══ 2. CVV / Card Verification ══════════════════════════════════════ */}
      <Section title="CVV / Card Verification">
        <Tabs defaultValue="cvv">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="cvv"      className="text-xs">CVV Gen/Verify<Cmd code="CW·CY svc=101" /></TabsTrigger>
            <TabsTrigger value="cvv2"     className="text-xs">CVV2 Gen/Verify<Cmd code="CW·CY svc=000" /></TabsTrigger>
            <TabsTrigger value="icvv"     className="text-xs">iCVV Gen/Verify<Cmd code="CW·CY svc=999" /></TabsTrigger>
            <TabsTrigger value="dcvc3"    className="text-xs">DCVC3<Cmd code="CW·CY svc=030" /></TabsTrigger>
            <TabsTrigger value="dcvv17"   className="text-xs">dCVV CVN17<Cmd code="PM/PN" /></TabsTrigger>
            <TabsTrigger value="csc1"     className="text-xs">CSC1<Cmd code="RY/RZ" /></TabsTrigger>
            <TabsTrigger value="csc2"     className="text-xs">CSC2<Cmd code="RY/RZ" /></TabsTrigger>
            <TabsTrigger value="icsc"     className="text-xs">iCSC<Cmd code="RY/RZ" /></TabsTrigger>
          </TabsList>
          <TabsContent value="cvv"   className="mt-4"><CvvVariantTab symKeys={symKeys} initSvc="101" label="CVV"   desc="Standard CVV (Card Verification Value). Service code 101. Used on track data." cmdNote="CW/CX · CY/CZ" /></TabsContent>
          <TabsContent value="cvv2"  className="mt-4"><CvvVariantTab symKeys={symKeys} initSvc="000" label="CVV2"  desc="CVV2 — printed on card back. Service code 000. Used for card-not-present transactions." cmdNote="CW/CX · CY/CZ" /></TabsContent>
          <TabsContent value="icvv"  className="mt-4"><CvvVariantTab symKeys={symKeys} initSvc="999" label="iCVV"  desc="iCVV (Integrated Circuit CVV). Service code 999. Generated dynamically by EMV chip." cmdNote="CW/CX · CY/CZ" /></TabsContent>
          <TabsContent value="dcvc3" className="mt-4"><CvvVariantTab symKeys={symKeys} initSvc="030" label="DCVC3" desc="Dynamic Card Verification Code 3. Service code 030. Used for contactless transactions." cmdNote="CW/CX · CY/CZ" /></TabsContent>
          <TabsContent value="dcvv17" className="mt-4"><DcvvVerifyTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="csc1"  className="mt-4"><CscTab symKeys={symKeys} flag="0" label="CSC1" desc="Card Security Code variant 1. Computed from account number + expiry using CSCK key (LMK 14-15)." /></TabsContent>
          <TabsContent value="csc2"  className="mt-4"><CscTab symKeys={symKeys} flag="2" label="CSC2" desc="Card Security Code variant 2. Includes service code in computation." /></TabsContent>
          <TabsContent value="icsc"  className="mt-4"><CscTab symKeys={symKeys} flag="0" label="iCSC" desc="Integrated CSC — chip-generated 3-digit dynamic code. Same algorithm as CSC1, verified against card-generated value." /></TabsContent>
        </Tabs>
      </Section>

      {/* ══ 3. ARQC / ARPC ══════════════════════════════════════════════════ */}
      <Section title="ARQC / ARPC">
        <Tabs defaultValue="arqc-arpc">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="arqc-arpc"  className="text-xs">ARQC + ARPC<Cmd code="KQ/KR" /></TabsTrigger>
            <TabsTrigger value="cvn1415"    className="text-xs">CVN14/CVN15<Cmd code="KQ m=03" /></TabsTrigger>
            <TabsTrigger value="cvn1213"    className="text-xs">CVN12/CVN13<Cmd code="KQ m=01" /></TabsTrigger>
            <TabsTrigger value="cvn1822"    className="text-xs">CVN18/CVN22<Cmd code="KW/KX" /></TabsTrigger>
            <TabsTrigger value="cvn10"      className="text-xs">CVN10<Cmd code="KQ m=05" /></TabsTrigger>
            <TabsTrigger value="cvn04"      className="text-xs">CVN04<Cmd code="KQ/KR" /></TabsTrigger>
            <TabsTrigger value="cvn01"      className="text-xs">CVN01 AmEx<Cmd code="KQ/KR" /></TabsTrigger>
            <TabsTrigger value="3ds-spa2"   className="text-xs">3DS SPA2 AAV<Cmd code="LQ/LS" /></TabsTrigger>
            <TabsTrigger value="3ds-cavv7"  className="text-xs">3DS CAVV V7<Cmd code="CY/CZ" /></TabsTrigger>
            <TabsTrigger value="3ds-aevv"   className="text-xs">3DS AEVV<Cmd code="RY/RZ" /></TabsTrigger>
          </TabsList>
          <TabsContent value="arqc-arpc" className="mt-4"><ArqcTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="cvn1415"   className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="03" title="ARQC / ARPC — CVN14/CVN15" desc="EMV/Visa cryptogram algorithm (CVN14/15). Mode 03 — standard EMV Visa derivation." /></TabsContent>
          <TabsContent value="cvn1213"   className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="01" title="ARQC / ARPC — CVN12/CVN13" desc="M/Chip Lite cryptogram algorithm (CVN12/13). Mode 01 — Mastercard M/Chip derivation." /></TabsContent>
          <TabsContent value="cvn1822"   className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="03" title="ARQC / ARPC — CVN18/CVN22 (EMV 4.x)" desc="CVN18/22 — AES-based ARQC. Uses KW (EMV 4.x) command." useEmv4 /></TabsContent>
          <TabsContent value="cvn10"     className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="05" title="ARQC / ARPC — CVN10" desc="Mastercard CPA algorithm (CVN10). Mode 05." /></TabsContent>
          <TabsContent value="cvn04"     className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="04" title="ARQC / ARPC — CVN04" desc="Visa CVN04 cryptogram algorithm. Uses KQ command with mode 04." /></TabsContent>
          <TabsContent value="cvn01"     className="mt-4"><ArqcCvnTab symKeys={symKeys} defaultMode="01" title="ARQC / ARPC — CVN01 (AmEx AEIPS)" desc="AmEx AEIPS CVN01 cryptogram. Uses KQ command with mode 01." /></TabsContent>
          <TabsContent value="3ds-spa2"  className="mt-4"><HmacTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="3ds-cavv7" className="mt-4"><CvvVariantTab symKeys={symKeys} initSvc="101" label="CAVV" desc="3DS CAVV V7 — Cardholder Authentication Verification Value. Verified using same CY/CZ command as CVV; pass CAVV as the CVV value." cmdNote="CY/CZ (CAVV as CVV input)" /></TabsContent>
          <TabsContent value="3ds-aevv"  className="mt-4"><CscTab symKeys={symKeys} flag="3" label="AEVV" desc="Authentication Evidence Verification Value (AmEx 3DS). Calculated using RY/RZ mode=3/4 flag=3 with CSCK key. Unpredictable number goes in Expiry field." /></TabsContent>
        </Tabs>
      </Section>

      {/* ══ 4. MAC Operations ════════════════════════════════════════════════ */}
      <Section title="MAC Operations">
        <Tabs defaultValue="mac-gen">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="mac-gen"     className="text-xs">Generate MAC<Cmd code="M6/M7" /></TabsTrigger>
            <TabsTrigger value="mac-verify"  className="text-xs">Verify MAC<Cmd code="M8/M9" /></TabsTrigger>
            <TabsTrigger value="mac-genver"  className="text-xs">Generate &amp; Verify MAC<Cmd code="M6+M8" /></TabsTrigger>
            <TabsTrigger value="mac-pinchg"  className="text-xs">MAC for PIN Change<Cmd code="M6/M7" /></TabsTrigger>
          </TabsList>
          <TabsContent value="mac-gen"    className="mt-4"><MacGenTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="mac-verify" className="mt-4"><MacVerifyTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="mac-genver" className="mt-4"><MacGenVerifyTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="mac-pinchg" className="mt-4"><MacPinChangeTab symKeys={symKeys} /></TabsContent>
        </Tabs>
      </Section>

      {/* ══ 5. Data Encryption ══════════════════════════════════════════════ */}
      <Section title="Data Encryption">
        <Tabs defaultValue="encrypt">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="encrypt"   className="text-xs">Encrypt Data<Cmd code="M0/M1" /></TabsTrigger>
            <TabsTrigger value="decrypt"   className="text-xs">Decrypt Data<Cmd code="M2/M3" /></TabsTrigger>
            <TabsTrigger value="reencrypt" className="text-xs">ReEncrypt Data<Cmd code="M2→M0" /></TabsTrigger>
          </TabsList>
          <TabsContent value="encrypt"   className="mt-4"><EncryptDataTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="decrypt"   className="mt-4"><DecryptDataTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="reencrypt" className="mt-4"><ReEncryptDataTab symKeys={symKeys} /></TabsContent>
        </Tabs>
      </Section>

      {/* ══ 6. Key Exchange ══════════════════════════════════════════════════ */}
      <Section title="Key Exchange">
        <Tabs defaultValue="zpk-exchange">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="zpk-exchange" className="text-xs">ZPK Key Exchange<Cmd code="GC/GD" /></TabsTrigger>
            <TabsTrigger value="kek-exchange" className="text-xs">KEK Key Exchange<Cmd code="BU/BV" /></TabsTrigger>
          </TabsList>
          <TabsContent value="zpk-exchange" className="mt-4"><ExportZmkTab symKeys={symKeys} /></TabsContent>
          <TabsContent value="kek-exchange" className="mt-4"><KekExchangeTab symKeys={symKeys} /></TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}
