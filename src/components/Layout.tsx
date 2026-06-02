import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  KeyRound,
  PlusCircle,
  Download,
  Cpu,
  Play,
  Server,
  ScrollText,
  Terminal,
  ShieldCheck,
  LogOut,
  Lock,
  Building2,
  Blocks,
  CreditCard,
} from 'lucide-react';
import BankSelector from './BankSelector';
import { useSession } from '@/store/session';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
  code?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Vault',
    items: [
      { to: '/keys',         label: 'Locate',       icon: KeyRound },
      { to: '/keys/new',     label: 'Generate RSA', code: 'EI/EJ', icon: PlusCircle },
      { to: '/keys/new-sym', label: 'Generate Sym', code: 'A0/A1', icon: PlusCircle },
      { to: '/keys/import',  label: 'Import Key',   code: 'GI/GJ', icon: Download },
      { to: '/keys/block',   label: 'Key Block',    code: 'B4/B5', icon: Blocks },
    ],
  },
  {
    label: 'Crypto',
    items: [
      { to: '/wizard',  label: 'Walkthrough', code: 'CHAIN', icon: Play },
      { to: '/crypto',  label: 'Encrypt/Decrypt', code: 'M0–M3', icon: Cpu },
      { to: '/emv',     label: 'HSM Operations',  code: 'HSM',   icon: CreditCard },
      { to: '/console', label: 'Raw Wire',    icon: Terminal },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { to: '/pools', label: 'HSM Pools', icon: Server },
      { to: '/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/banks', label: 'Banks',  code: 'FIID', icon: Building2 },
      { to: '/admin/rbac',  label: 'Access', code: 'SAM',  icon: ShieldCheck },
    ],
  },
];

export default function Layout() {
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const clear = useSession((s) => s.clear);

  const signOut = () => {
    clear();
    nav('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-64 border-r bg-card flex flex-col sticky top-0 h-screen overflow-y-auto shrink-0">
        {/* brand */}
        <div className="px-5 py-5 border-b flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
            <Lock className="h-4 w-4 text-accent" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">Sentinel</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              HSM Vault
            </div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {navSections.map((sect) => (
            <div key={sect.label}>
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                {sect.label}
              </div>
              <div className="space-y-0.5">
                {sect.items.map(({ to, label, code, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-[15px] w-[15px]" />
                    <span className="flex-1 truncate">{label}</span>
                    {code && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[9px] px-1.5 py-0 h-[18px] font-normal"
                      >
                        {code}
                      </Badge>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* user footer */}
        <div className="border-t p-3">
          {user && (
            <div className="px-3 py-2 mb-1.5">
              <div className="text-xs font-medium truncate">{user.loginname}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {user.bankCode ?? '—'} · staff#{user.staffId ?? '—'}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 font-normal text-foreground/80"
          >
            <LogOut className="h-[15px] w-[15px]" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-8 h-14 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">gateway://</span>
            <span className="text-foreground">localhost:8090</span>
          </div>
          <div className="flex items-center gap-3">
            <BankSelector />
          </div>
        </header>
        <Separator />
        <div className="px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
