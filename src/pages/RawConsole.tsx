import { useState } from 'react';
import { toast } from 'sonner';
import { Terminal, Send, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RawConsole() {
  const [hex, setHex] = useState('');
  const [resp, setResp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!hex.trim()) return toast.error('Command hex required');
    setBusy(true);
    setResp(null);
    try {
      const r = await api.post('/raw', { commandHex: hex.replace(/\s+/g, '') });
      setResp(JSON.stringify(r.data, null, 2));
      toast.success('Sent');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed';
      setResp(`ERROR: ${msg}\n\nNote: /api/v1/raw is Phase 2 (gateway IMPLEMENTATION.md §10).`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Terminal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Raw Wire Console</h1>
          <p className="text-sm text-muted-foreground">
            Send raw 2-letter Thales command bytes directly to the gateway dispatcher.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">Phase 2</Badge>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Endpoint <code className="font-mono">/api/v1/raw</code> is a Phase 2 backlog item (gateway IMPLEMENTATION.md §10).
          UI present but server returns 404 until wired. Audit trail required before enabling.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Command bytes</CardTitle>
          <CardDescription>
            Hex-encoded command body, no 2-byte length prefix (gateway prepends framing).
            Example NC probe:
            <code className="font-mono ml-1 text-foreground">4E43</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hex">Command hex</Label>
            <Textarea
              id="hex"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder="4E43"
            />
          </div>
          <Button onClick={send} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {busy ? 'Sending…' : 'Send'}
          </Button>

          {resp && (
            <div className="space-y-1.5 pt-2">
              <Label>Response</Label>
              <pre className="bg-muted/40 rounded-md p-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-all">
                {resp}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
