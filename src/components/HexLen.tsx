import { Badge } from '@/components/ui/badge';

/**
 * Live length indicator for a hex key input. Shows bytes/bits as the user types,
 * flags odd-length or non-hex, and (optionally) whether the length matches an
 * expected byte count. Reused on TR-31 wrap, ZMK components, and similar inputs.
 */
export default function HexLen({ value, expectBytes }: { value: string; expectBytes?: number }) {
  const hex = (value ?? '').trim().replace(/\s+/g, '');
  if (hex === '') return <span className="text-[10px] text-muted-foreground">—</span>;

  const isHex = /^[0-9a-fA-F]*$/.test(hex);
  const even = hex.length % 2 === 0;
  const bytes = Math.floor(hex.length / 2);
  const bits = bytes * 8;

  if (!isHex) return <Badge variant="destructive" className="text-[10px]">not hex</Badge>;
  if (!even) return <Badge variant="destructive" className="text-[10px]">{hex.length} chars · odd</Badge>;

  const ok = expectBytes == null || bytes === expectBytes;
  return (
    <Badge variant={ok ? 'outline' : 'destructive'} className="text-[10px] font-mono">
      {bytes} bytes · {bits}-bit{expectBytes != null && !ok ? ` · expect ${expectBytes}` : ''}
    </Badge>
  );
}
