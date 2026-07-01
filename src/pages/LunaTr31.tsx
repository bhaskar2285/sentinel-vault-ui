import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, KeyRound, PackageOpen, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { keysApi, lunaApi, type KeySummary } from '@/api/keys';
import HexLen from '@/components/HexLen';

type Tr31Block = {
  keyId: string; label: string; tr31Block: string; header: string; version: string;
  keyAlgorithm: string; keyBits: number; kbpkKeyId: string; kbpkLabel: string;
};

export default function LunaTr31() {
  const [kbpks, setKbpks] = useState<KeySummary[]>([]);
  const [blocks, setBlocks] = useState<Tr31Block[]>([]);

  // --- generate KBPK ---
  const [genVersion, setGenVersion] = useState('D');
  const [genBits, setGenBits] = useState('256');
  const [genLabel, setGenLabel] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  // --- wrap ---
  const [wrapKbpk, setWrapKbpk] = useState('');
  const [workingKey, setWorkingKey] = useState('');
  const [keyAlgo, setKeyAlgo] = useState('AES');
  const [usage, setUsage] = useState('D0');
  const [mode, setMode] = useState('B');
  const [wrapLabel, setWrapLabel] = useState('');
  const [wrapBusy, setWrapBusy] = useState(false);

  // --- unwrap ---
  const [pickedBlock, setPickedBlock] = useState('');
  const [unwrapBusy, setUnwrapBusy] = useState(false);
  const [recovered, setRecovered] = useState<{ key: string; header: string } | null>(null);

  const loadKbpks = () => {
    keysApi.list({ keyType: 'KBPK', bankScope: 'ALL' })
      .then((ks) => setKbpks(ks.filter((k) => k.vendorOrigin === 'luna')))
      .catch(() => {});
  };
  const loadBlocks = () => { lunaApi.listTr31Blocks().then(setBlocks).catch(() => {}); };
  useEffect(() => { loadKbpks(); loadBlocks(); }, []);

  const generate = async () => {
    if (!genLabel.trim()) return toast.error('Enter a KBPK label');
    setGenBusy(true);
    try {
      const r = await lunaApi.generateKbpk({ version: genVersion, keyBits: Number(genBits), label: genLabel.trim() });
      if (r.errCode === '00') { toast.success(`KBPK generated — KCV ${r.kcv}`); setGenLabel(''); loadKbpks(); }
      else toast.error(`generate failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'generate failed'); }
    finally { setGenBusy(false); }
  };

  const wrap = async () => {
    if (!wrapKbpk) return toast.error('Select a KBPK');
    const wk = workingKey.trim().replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]+$/.test(wk) || wk.length % 2 !== 0) return toast.error('Working key must be even-length hex');
    setWrapBusy(true);
    try {
      const r = await lunaApi.tr31Wrap({
        kbpkKeyId: wrapKbpk, workingKeyHex: wk, keyAlgorithm: keyAlgo,
        keyUsage: usage, modeOfUse: mode, label: wrapLabel.trim() || undefined,
      });
      if (r.errCode === '00') {
        toast.success(`Wrapped into a ${r.version} key block — stored in the vault`);
        setWorkingKey(''); setWrapLabel('');
        loadBlocks();
      } else toast.error(`wrap failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'wrap failed'); }
    finally { setWrapBusy(false); }
  };

  const unwrap = async () => {
    const blk = blocks.find((b) => b.keyId === pickedBlock);
    if (!blk) return toast.error('Select a stored key block');
    setUnwrapBusy(true); setRecovered(null);
    try {
      const r = await lunaApi.tr31Unwrap({ kbpkKeyId: blk.kbpkKeyId, tr31Block: blk.tr31Block });
      if (r.errCode === '00') {
        setRecovered({ key: r.workingKeyHex ?? '', header: r.header ?? '' });
        toast.success('Key block authenticated and unwrapped');
      } else toast.error(`unwrap failed: ${r.errText ?? r.errCode}`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? e?.message ?? 'unwrap failed'); }
    finally { setUnwrapBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Luna TR-31 Key Blocks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Luna <Badge variant="outline" className="font-mono text-[10px] mx-1">PKCS#11</Badge>
          — wrap working keys into X9.143 / TR-31 key blocks under a Key Block Protection Key (KBPK),
          using the AES (version D) or 3DES (version B) key-derivation binding. Blocks are stored in the vault.
        </p>
      </div>

      {/* Generate KBPK */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Generate a KBPK</CardTitle>
          <CardDescription>The Key Block Protection Key that wraps and authenticates key blocks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Version</Label>
              <Select value={genVersion} onValueChange={(v) => { setGenVersion(v); setGenBits(v === 'D' ? '256' : '128'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">D · AES</SelectItem>
                  <SelectItem value="B">B · 3DES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Key size</Label>
              <Select value={genBits} onValueChange={setGenBits}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(genVersion === 'D' ? ['128', '192', '256'] : ['128', '192']).map((b) => (
                    <SelectItem key={b} value={b}>{b}-bit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={genLabel} onChange={(e) => setGenLabel(e.target.value)} placeholder="kbpk-1" />
            </div>
          </div>
          <Button onClick={generate} disabled={genBusy}>
            {genBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Generate KBPK
          </Button>
        </CardContent>
      </Card>

      {/* Wrap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 · Wrap a key into a TR-31 block</CardTitle>
          <CardDescription>Protect a working key (e.g. a DEK) under the KBPK. The block is saved to the vault.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>KBPK</Label>
            <Select value={wrapKbpk} onValueChange={setWrapKbpk}>
              <SelectTrigger><SelectValue placeholder="Select a KBPK" /></SelectTrigger>
              <SelectContent>
                {kbpks.map((k) => (
                  <SelectItem key={k.keyId} value={k.keyId}>
                    {k.label} {k.kcv ? `(KCV ${k.kcv})` : ''} · {k.keyLengthBits}-bit
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kbpks.length === 0 && <p className="text-xs text-muted-foreground">No KBPKs yet — generate one above.</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Working key (hex)</Label>
              <HexLen value={workingKey} />
            </div>
            <Input value={workingKey} onChange={(e) => setWorkingKey(e.target.value)}
              placeholder="00112233445566778899AABBCCDDEEFF" className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Key algorithm</Label>
              <Select value={keyAlgo} onValueChange={setKeyAlgo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AES">AES</SelectItem>
                  <SelectItem value="DESede">3DES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Key usage</Label>
              <Input value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="D0" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Mode of use</Label>
              <Input value={mode} onChange={(e) => setMode(e.target.value)} placeholder="B" className="font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Vault label <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={wrapLabel} onChange={(e) => setWrapLabel(e.target.value)} placeholder="auto-generated if blank" />
          </div>
          <Button onClick={wrap} disabled={wrapBusy}>
            {wrapBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
            Wrap &amp; store
          </Button>
        </CardContent>
      </Card>

      {/* Unwrap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3 · Unwrap a stored block</CardTitle>
          <CardDescription>Pick a key block from the vault; the MAC is verified and the working key recovered under its KBPK.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Stored key block</Label>
            <Select value={pickedBlock} onValueChange={setPickedBlock}>
              <SelectTrigger><SelectValue placeholder="Select a stored TR-31 block" /></SelectTrigger>
              <SelectContent>
                {blocks.map((b) => (
                  <SelectItem key={b.keyId} value={b.keyId}>
                    {b.label} · {b.version}/{b.keyAlgorithm} {b.keyBits}-bit · KBPK {b.kbpkLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {blocks.length === 0 && <p className="text-xs text-muted-foreground">No stored blocks yet — wrap one above.</p>}
          </div>
          <Button onClick={unwrap} disabled={unwrapBusy}>
            {unwrapBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageOpen className="mr-2 h-4 w-4" />}
            Unwrap
          </Button>
          {recovered && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">header <span className="font-mono">{recovered.header}</span></p>
              <p className="text-xs text-muted-foreground">recovered working key</p>
              <p className="font-mono text-sm break-all">{recovered.key}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
