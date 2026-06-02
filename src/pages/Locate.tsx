import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PlusCircle, Search, KeyRound, ChevronRight, AlertCircle,
  Loader2, ChevronDown, Info, Building2,
} from 'lucide-react';
import { keysApi, KeySummary } from '@/api/keys';
import { api } from '@/api/client';
import { useSession } from '@/store/session';

interface BankStub { recId: number; code: string; name: string }
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/* ─── category definitions ──────────────────────────────────────── */

interface KeyCategory {
  id: string;
  label: string;
  tagline: string;
  hint: string;
  match: (k: KeySummary) => boolean;
}

const KEY_CATEGORIES: KeyCategory[] = [
  {
    id: 'rsa',
    label: 'RSA / Asymmetric',
    tagline: 'Public-key pairs · EI command',
    hint: 'RSA keys have a public half (shared freely) and a private half (kept secret). Used to securely wrap other keys during import.',
    match: (k) => k.keyType === 'RSA' || k.algo === 'RSA',
  },
  {
    id: 'transport',
    label: 'Transport & Wrapping',
    tagline: 'ZMK · ZPK · TMK · TPK · BDK · KBPK',
    hint: 'These keys protect other keys in transit between systems. A ZMK (Zone Master Key) encrypts ZPKs; a ZPK (Zone PIN Key) encrypts PINs sent to the HSM.',
    match: (k) => ['ZMK', 'ZPK', 'TMK', 'TPK', 'BDK', 'KBPK'].includes(k.keyType),
  },
  {
    id: 'pin',
    label: 'PIN & Verification',
    tagline: 'PVK · CVK · IBM PIN security',
    hint: 'PVK (PIN Verification Key) is used to validate a cardholder PIN without storing the PIN itself. CVK (Card Verification Key) generates CVV codes on card magnetic stripes.',
    match: (k) => ['PVK', 'CVK', 'IMK-AC', 'IMK-SMI', 'IMK-SMC'].includes(k.keyType),
  },
  {
    id: 'data',
    label: 'Data Encryption',
    tagline: 'AES · 3DES · DATA',
    hint: 'General-purpose encryption keys. AES-256 is modern; 3DES/Triple-DES is legacy but still common in banking. Used to encrypt card data, messages, and storage.',
    match: (k) =>
      ['AES', '3DES', 'DATA'].includes(k.keyType) ||
      (!['RSA', 'ZMK', 'ZPK', 'TMK', 'TPK', 'BDK', 'KBPK', 'PVK', 'CVK', 'IMK-AC', 'IMK-SMI', 'IMK-SMC'].includes(k.keyType) &&
        k.algo !== 'RSA'),
  },
];

/* ─── key-type hint tooltips ─────────────────────────────────────── */

const KEY_TYPE_HINTS: Record<string, string> = {
  RSA:     'Asymmetric key pair. Public key shared; private key protected by HSM.',
  ZMK:     'Zone Master Key — encrypts other keys during exchange between two institutions.',
  ZPK:     'Zone PIN Key — encrypts PIN blocks sent over the network.',
  TMK:     'Terminal Master Key — root key loaded into ATM/POS terminals.',
  TPK:     'Terminal PIN Key — encrypts PINs at the terminal level.',
  BDK:     'Base Derivation Key — master key for deriving unique terminal keys (DUKPT).',
  KBPK:   'Key Block Protection Key — wraps keys inside TR-31 key blocks.',
  PVK:     'PIN Verification Key — validates cardholder PINs (IBM 3624 / Visa PVV).',
  CVK:     'Card Verification Key — generates/verifies CVV1/CVV2 on card magstripe.',
  AES:     'Advanced Encryption Standard — modern 128/192/256-bit block cipher.',
  '3DES':  'Triple DES — applies DES three times. Legacy but widely used in banking.',
  DATA:    'Generic data encryption key stored under HSM LMK.',
  'IMK-AC':  'Issuer Master Key for Application Cryptograms (EMV chip cards).',
  'IMK-SMI': 'Issuer Master Key for Secure Messaging Integrity.',
  'IMK-SMC': 'Issuer Master Key for Secure Messaging Confidentiality.',
};

const ALGO_HINTS: Record<string, string> = {
  RSA:    'Rivest–Shamir–Adleman asymmetric algorithm.',
  AES:    'AES block cipher — current standard for symmetric encryption.',
  '3DES': 'Triple-DES — three successive DES operations for stronger security.',
  DES:    'Single DES — deprecated, too short a key. Avoid for new systems.',
};

/* ─── helpers ────────────────────────────────────────────────────── */

const KEY_TYPES = ['RSA', 'AES', '3DES', 'ZMK', 'ZPK', 'TMK', 'TPK', 'KBPK', 'BDK', 'PVK', 'CVK'];

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function TipButton({
  tip, children, ...props
}: React.ComponentProps<typeof Button> & { tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-xs leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'REVOKED' || status === 'EXPIRED') return 'destructive';
  return 'secondary';
}

function formatHex(hex: string | undefined): string {
  if (!hex) return '';
  return hex.toUpperCase().match(/.{1,32}/g)?.join('\n') ?? hex.toUpperCase();
}

/* ─── KeyCard ────────────────────────────────────────────────────── */

function KeyCard({ k, bankCode }: { k: KeySummary; bankCode?: string }) {
  const hex = k.encryptedBlobHex;
  const len = k.encryptedBlobLen ?? (hex ? hex.length / 2 : undefined);
  const typeHint = KEY_TYPE_HINTS[k.keyType];
  const algoHint = ALGO_HINTS[k.algo];

  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors">
      <CardContent className="p-0">
        <Link to={`/keys/${k.keyId}`} className="block">
          {/* header row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
            <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{k.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 h-[18px] cursor-help">
                      {k.keyType}
                    </Badge>
                  </TooltipTrigger>
                  {typeHint && (
                    <TooltipContent className="max-w-xs text-xs leading-relaxed">{typeHint}</TooltipContent>
                  )}
                </Tooltip>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-mono">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{k.algo}</span>
                  </TooltipTrigger>
                  {algoHint && (
                    <TooltipContent className="max-w-xs text-xs">{algoHint}</TooltipContent>
                  )}
                </Tooltip>
                <span>·</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{k.keyLengthBits} bits</span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    Key length: {k.keyLengthBits} bits = {k.keyLengthBits / 8} bytes.
                    {k.keyLengthBits >= 256 ? ' Strong — modern standard.' : k.keyLengthBits >= 128 ? ' Acceptable for most uses.' : ' Legacy length — avoid for new systems.'}
                  </TooltipContent>
                </Tooltip>
                {k.vendorOrigin && <><span>·</span><span>{k.vendorOrigin}</span></>}
                {k.bankRecId && <><span>·</span><span>{bankCode ?? `#${k.bankRecId}`}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={statusVariant(k.status)} className="text-[10px] cursor-help">
                    {k.status}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {k.status === 'ACTIVE'  ? 'Key is live and usable for cryptographic operations.' :
                   k.status === 'REVOKED' ? 'Key has been revoked. Do not use — it may be compromised.' :
                   k.status === 'EXPIRED' ? 'Key has passed its expiry date. Rotate it.' :
                   'Key status unknown.'}
                </TooltipContent>
              </Tooltip>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* meta row */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-2 text-[11px]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground cursor-help">KCV</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                Key Check Value — a short fingerprint computed by encrypting zeros with this key. Used to confirm the key was loaded correctly without revealing the key itself.
              </TooltipContent>
            </Tooltip>
            <span className="font-mono text-foreground">
              {k.kcv ?? <span className="text-muted-foreground">—</span>}
            </span>
            <span className="text-muted-foreground">Created</span>
            <span className="font-mono text-foreground">
              {new Date(k.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
            </span>
          </div>

          {/* encrypted blob */}
          <div className="border-t bg-muted/40 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Encrypted blob {len !== undefined && <span className="font-mono normal-case tracking-normal">· {len} bytes</span>}
                </span>
                <Hint text="The key material encrypted under the HSM's LMK (Local Master Key). Only the HSM can decrypt this — it never leaves the hardware in plaintext." />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                uuid: {k.keyId}
              </span>
            </div>
            <pre className={cn(
              'font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all',
              hex ? 'text-foreground/80' : 'text-muted-foreground italic'
            )}>
              {hex ? formatHex(hex) : 'no blob material'}
            </pre>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/* ─── KeyCategorySection ─────────────────────────────────────────── */

function KeyCategorySection({
  category,
  keys,
  bankCode,
}: {
  category: KeyCategory;
  keys: KeySummary[];
  bankCode: (id?: number) => string | undefined;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (keys.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 group text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold">{category.label}</span>
          <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-[18px]">
            {keys.length}
          </Badge>
          <span className="text-[11px] text-muted-foreground truncate">{category.tagline}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Hint text={category.hint} />
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', collapsed && '-rotate-90')}
          />
        </div>
      </button>
      {!collapsed && (
        <div className="space-y-3">
          {keys.map((k) => (
            <KeyCard key={k.keyId} k={k} bankCode={bankCode(k.bankRecId)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Locate page ────────────────────────────────────────────────── */

export default function Locate() {
  const [label, setLabel] = useState('');
  const [keyType, setKeyType] = useState('');
  const selectedBankId = useSession((s) => s.selectedBankId);

  const { data: banks = [] } = useQuery<BankStub[]>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get('/admin/banks')).data,
  });
  const bankCode = (id?: number) => {
    if (!id) return undefined;
    return banks.find((x) => x.recId === id)?.code;
  };
  const activeBank = banks.find((b) => b.recId === selectedBankId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['keys', label, keyType, selectedBankId],
    queryFn: () => keysApi.list({ label: label || undefined, keyType: keyType || undefined }),
  });

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Key Vault</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All keys held under LMK · {data?.length ?? 0}{' '}
              {data?.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="flex gap-2">
            <TipButton
              asChild variant="outline" size="sm"
              tip="Import an existing key from another system. The key must be encrypted under a ZMK (zone exchange key) shared with the other party."
            >
              <Link to="/keys/import"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Import</Link>
            </TipButton>
            <TipButton
              asChild variant="outline" size="sm"
              tip="Generate a new symmetric key (3DES, AES, ZMK, ZPK…) inside the HSM. The key never exists in plaintext outside the hardware."
            >
              <Link to="/keys/new-sym"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Symmetric</Link>
            </TipButton>
            <TipButton
              asChild size="sm"
              tip="Generate an RSA key pair. The HSM keeps the private key; you get the public key to share with others for wrapping or signature verification."
            >
              <Link to="/keys/new"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />RSA</Link>
            </TipButton>
          </div>
        </div>

        {/* institution scope banner */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm cursor-help w-fit',
              activeBank
                ? 'bg-primary/5 border-primary/20 text-primary'
                : 'bg-muted border-dashed text-muted-foreground'
            )}>
              <Building2 className="h-4 w-4 shrink-0" />
              {activeBank ? (
                <>
                  <span className="font-mono text-xs font-semibold">{activeBank.code}</span>
                  <span className="font-medium">{activeBank.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 h-[18px] border-primary/30 text-primary">
                    active institution
                  </Badge>
                </>
              ) : (
                <span>No institution selected — showing all keys</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed">
            Keys are scoped to this institution. Every key you generate or import here will be tagged to <strong>{activeBank?.name ?? 'the selected institution'}</strong>. Switch institution using the bank selector in the top-right header.
          </TooltipContent>
        </Tooltip>

        {/* search & filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Search by label…"
              className="pl-9"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select value={keyType || 'ALL'} onValueChange={(v) => setKeyType(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All types</SelectItem>
                    {KEY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        <span>{t}</span>
                        {KEY_TYPE_HINTS[t] && (
                          <span className="ml-2 text-[10px] text-muted-foreground hidden sm:inline">
                            — {KEY_TYPE_HINTS[t].split('.')[0]}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Filter keys by type. Leave as "All types" to see all keys grouped by category.</TooltipContent>
          </Tooltip>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading keys…
          </div>
        )}

        {/* grouped view — no type filter */}
        {!isLoading && data && !keyType && (
          <div className="space-y-6">
            {(() => {
              const assigned = new Set<string>();
              return KEY_CATEGORIES.map((cat) => {
                const catKeys = data.filter((k) => !assigned.has(k.keyId) && cat.match(k));
                catKeys.forEach((k) => assigned.add(k.keyId));
                return (
                  <KeyCategorySection
                    key={cat.id}
                    category={cat}
                    keys={catKeys}
                    bankCode={bankCode}
                  />
                );
              });
            })()}
            {data.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center space-y-3">
                  <KeyRound className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm font-medium">No keys yet</p>
                  <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                    Start by generating a <strong>Symmetric</strong> key (e.g. a ZMK for key exchange) or an <strong>RSA</strong> key pair for wrapping.
                  </p>
                  <div className="flex gap-2 justify-center pt-1">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/keys/new-sym"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Generate Symmetric</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/keys/new"><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Generate RSA</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* flat list — type filter active */}
        {!isLoading && data && keyType && (
          <div className="space-y-3">
            {data.map((k) => <KeyCard key={k.keyId} k={k} bankCode={bankCode(k.bankRecId)} />)}
            {data.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground text-sm">
                  No {keyType} keys found. Try a different filter or generate one.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
