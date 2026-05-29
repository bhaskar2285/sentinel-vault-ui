import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { api } from '@/api/client';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export default function Login() {
  const nav = useNavigate();
  const setSession = useSession((s) => s.setSession);

  const [loginname, setLoginname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [pasteToken, setPasteToken] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!loginname || !password) {
      setError('Username and password required');
      return;
    }
    setBusy(true);
    try {
      const r = await api.post('/auth/login', { loginname, password });
      const d = r.data;
      if (d?.success === false) {
        setError(d.reason ?? 'Login failed');
        return;
      }
      const token = d.token ?? d.jwt;
      if (!token) {
        setError('No token returned');
        return;
      }
      setSession(token, {
        staffId: d.staffId,
        loginname,
        bankId: d.bankId,
        bankCode: d.bankCode,
        branchId: d.branchId,
        roles: d.roles,
      });
      nav('/keys', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.reason ?? err?.message ?? 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const onPasteToken = () => {
    const t = pasteToken.trim();
    if (!t) return;
    setSession(t, { staffId: 0, loginname: 'dev', bankCode: 'DEV' });
    nav('/keys', { replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_520px] bg-background">
      {/* left hero — dark */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden text-slate-100"
        style={{
          background:
            'linear-gradient(135deg, hsl(222 47% 10%) 0%, hsl(222 47% 8%) 60%, hsl(199 89% 18%) 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(circle at 25% 30%, hsl(199 89% 45% / 0.25), transparent 60%), radial-gradient(circle at 80% 75%, hsl(173 60% 35% / 0.22), transparent 55%)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur">
            <Lock className="h-5 w-5 text-accent" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-white text-xl leading-none font-semibold tracking-tight">Sentinel</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mt-1">HSM Vault · ISC</div>
          </div>
        </div>

        <div className="relative z-10 space-y-5 max-w-md">
          <h1 className="font-serif italic text-4xl text-white leading-tight">
            Keys never leave the boundary.
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Vendor-neutral HSM gateway for Thales payShield and Utimaco fleets.
            ANSI X9.143 key blocks, ISO 8583-grade audit, ISC SAM authentication
            with per-bank LDAP or Active Directory binding.
          </p>
          <div className="flex gap-2 flex-wrap pt-2">
            <Badge variant="secondary" className="bg-white/8 text-slate-200 border-white/10 backdrop-blur">TR-31 · X9.143</Badge>
            <Badge variant="secondary" className="bg-white/8 text-slate-200 border-white/10 backdrop-blur">FIPS 140-3 L3</Badge>
            <Badge variant="secondary" className="bg-white/8 text-slate-200 border-white/10 backdrop-blur">PCI HSM v3</Badge>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-slate-500 font-mono">
          sentinel-vault-ui · build {new Date().getFullYear()}
        </div>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm space-y-7">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
              <Lock className="h-4 w-4 text-accent" strokeWidth={2.5} />
            </div>
            <div className="text-lg font-semibold tracking-tight">Sentinel</div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Access your bank tenant.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loginname">Username</Label>
              <Input
                id="loginname"
                type="text"
                autoComplete="username"
                value={loginname}
                onChange={(e) => setLoginname(e.target.value)}
                autoFocus
                placeholder="admin"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={busy || !loginname || !password}
              className="w-full"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <Collapsible open={advOpen} onOpenChange={setAdvOpen} className="border-t pt-4">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={cn('h-3 w-3 transition-transform', advOpen && 'rotate-180')} />
                Advanced · paste session token
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              <Textarea
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                rows={3}
                className="text-xs font-mono"
                placeholder="eyJhbGciOi… or 64-hex session"
              />
              <Button variant="outline" size="sm" onClick={onPasteToken} className="w-full">
                Use this token
              </Button>
              <p className="text-[10px] text-muted-foreground">
                SSO bridge from xenticate-auth · dev only.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            <span>ISC SAM · DB · LDAP · MSAD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
