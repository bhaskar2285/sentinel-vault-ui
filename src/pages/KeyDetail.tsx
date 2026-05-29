import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, Download, Copy, Loader2, Package } from 'lucide-react';
import { keysApi, type KeySummary } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const KBPK_TYPES = new Set(['ZMK', 'KBPK', 'TMK']);

function formatHex(hex: string): string {
  return hex.toUpperCase().match(/.{1,32}/g)?.join('\n') ?? hex.toUpperCase();
}

function Info({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={cn('text-sm', mono && 'font-mono text-xs break-all')}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export default function KeyDetail() {
  const { keyId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['key', keyId],
    queryFn: () => keysApi.get(keyId!),
    enabled: !!keyId,
  });
  const all = useQuery<KeySummary[]>({
    queryKey: ['keys'],
    queryFn: () => keysApi.list(),
  });

  const [format, setFormat] = useState<'TR31_B' | 'TR31_D' | 'X9_143' | 'RAW'>('TR31_D');
  const [kbpkKeyId, setKbpkKeyId] = useState<string>('');
  const [exported, setExported] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const kbpkCandidates = (all.data ?? []).filter(
    (k) => KBPK_TYPES.has(k.keyType) && k.keyId !== keyId
  );

  const doExport = async () => {
    if (!keyId) return;
    if (format !== 'RAW' && !kbpkKeyId) {
      toast.error('Pick a wrapping key (ZMK/KBPK/TMK)');
      return;
    }
    setBusy(true);
    try {
      const r = await keysApi.exportKey(keyId, { format, kbpkKeyId: kbpkKeyId || undefined });
      if (r.status === 'OK') {
        setExported(r.keyBlock);
        toast.success('Exported');
      } else {
        toast.error(`${r.errCode}: ${r.errText}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading key…
      </div>
    );
  }
  if (!data) return <div className="text-muted-foreground">Not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/keys"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to vault
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <KeyRound className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">{data.label}</h1>
            <Badge variant="outline" className="font-mono text-[10px]">{data.keyType}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
            <span>{data.algo}</span>
            <span>·</span>
            <span>{data.keyLengthBits} bits</span>
            {data.vendorOrigin && (<><span>·</span><span>{data.vendorOrigin}</span></>)}
            <span>·</span>
            <button
              onClick={() => copy(data.keyId)}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              {data.keyId} <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Badge
          variant={data.status === 'ACTIVE' ? 'default' : 'secondary'}
          className="shrink-0"
        >
          {data.status}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="export">Export <Badge variant="outline" className="ml-2 font-mono text-[9px] px-1.5">A8/A9</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <Info label="Key UUID" value={data.keyId} mono className="col-span-2" />
                <Info label="Version" value={data.version} mono />
                <Info label="KCV" value={data.kcv} mono />
                <Info label="Usage" value={data.usage} />
                <Info label="Owner" value={data.ownerUserId} />
                <Info label="Bank" value={data.bankRecId ? `#${data.bankRecId}` : null} mono />
                <Info label="Vendor" value={data.vendorOrigin} />
                <Info label="LMK index" value={data.lmkIdx ?? null} mono />
                <Info label="Owner org" value={data.ownerOrg ?? null} mono />
                <Info
                  label="Created"
                  value={data.createdAt && new Date(data.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                  mono
                />
                <Info
                  label="Expires"
                  value={data.expiresAt && new Date(data.expiresAt).toISOString().slice(0, 19).replace('T', ' ')}
                  mono
                />
              </div>
            </CardContent>
          </Card>

          {data.encryptedBlobHex && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Encrypted blob</CardTitle>
                    <CardDescription className="text-xs">
                      {data.encryptedBlobLen} bytes · LMK-wrapped
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(data.encryptedBlobHex)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy hex
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
                  {formatHex(data.encryptedBlobHex)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wrap & export</CardTitle>
              <CardDescription>
                Wraps key under a KBPK / ZMK so it can leave the HSM safely. Raw = LMK-encrypted blob (admin only).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TR31_B">TR-31 Format B · 3DES KBPK</SelectItem>
                      <SelectItem value="TR31_D">TR-31 Format D · AES KBPK</SelectItem>
                      <SelectItem value="X9_143">ANSI X9.143</SelectItem>
                      <SelectItem value="RAW">Raw · admin only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Wrapping key (ZMK / KBPK / TMK)</Label>
                  <Select
                    value={kbpkKeyId}
                    onValueChange={setKbpkKeyId}
                    disabled={format === 'RAW'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={format === 'RAW' ? 'N/A (Raw)' : '— pick a key —'} />
                    </SelectTrigger>
                    <SelectContent>
                      {kbpkCandidates.map((k) => (
                        <SelectItem key={k.keyId} value={k.keyId}>
                          {k.label}
                          <Badge variant="outline" className="ml-2 font-mono text-[10px]">{k.keyType}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {kbpkCandidates.length === 0 && format !== 'RAW' && (
                <Alert variant="default" className="border-warning/50 bg-warning/5">
                  <AlertDescription className="text-xs">
                    No ZMK/KBPK/TMK in vault. Import one first via Import Key.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={doExport} disabled={busy} className="w-full sm:w-auto">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Download className="mr-2 h-4 w-4" />
                {busy ? 'Exporting…' : 'Export'}
              </Button>

              {exported && (
                <div className="space-y-2 pt-2">
                  <Separator />
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Package className="h-4 w-4 text-success" />
                      Exported key block
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copy(exported)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                    </Button>
                  </div>
                  <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
                    {exported}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
