import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  ShieldCheck,
  KeyRound,
  Layers,
  Lock,
  Trash2,
  Key as KeyIcon,
  Loader2,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { samApi, type SamRole, type SamStaff } from '@/api/sam';
import { api } from '@/api/client';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BankStub { recId: number; code: string; name: string }

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'actions',     label: 'Actions',     icon: ShieldCheck },
  { id: 'roles',       label: 'Roles',       icon: KeyRound },
  { id: 'teams',       label: 'Teams',       icon: Layers },
  { id: 'staff',       label: 'Staff',       icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Lock },
];

export default function AdminRBAC() {
  const sessionBankId = useSession((s) => s.selectedBankId ?? s.user?.bankId ?? 1);
  const [bankId, setBankId] = useState<number>(sessionBankId);

  const banks = useQuery<BankStub[]>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get('/admin/banks')).data,
  });

  const activeBank = banks.data?.find((b) => b.recId === bankId);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Security Access Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              ISC SAM — actions, roles, teams, staff, per-role permissions
            </p>
          </div>
        </div>

        {/* Bank picker — native select avoids Radix portal z-index issues */}
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <select
            value={String(bankId)}
            onChange={(e) => setBankId(Number(e.target.value))}
            className="h-9 w-56 rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
          >
            {(banks.data ?? []).map((b) => (
              <option key={b.recId} value={String(b.recId)}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          {activeBank && (
            <Badge variant="outline" className="font-mono text-[10px]">{activeBank.code}</Badge>
          )}
        </div>
      </div>

      {bankId > 0 && (
        <Tabs defaultValue="actions">
          <TabsList>
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="actions"><ActionsPanel /></TabsContent>
          <TabsContent value="roles"><RolesPanel bankId={bankId} /></TabsContent>
          <TabsContent value="teams"><TeamsPanel bankId={bankId} /></TabsContent>
          <TabsContent value="staff"><StaffPanel bankId={bankId} /></TabsContent>
          <TabsContent value="permissions"><PermissionsPanel bankId={bankId} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------- Actions ----------
function ActionsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sam', 'actions'], queryFn: samApi.listActions });
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const create = useMutation({
    mutationFn: () => samApi.createAction({ name, description: desc || undefined }),
    onSuccess: () => {
      setName(''); setDesc('');
      qc.invalidateQueries({ queryKey: ['sam', 'actions'] });
      toast.success('Action created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'create failed'),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">New action</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
            <Input placeholder="OP_KEY_CREATE_RSA" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="font-mono" />
            <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((a) => (
              <TableRow key={a.recId}>
                <TableCell className="font-mono text-xs text-muted-foreground">{a.recId}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-[10px]">{a.name}</Badge></TableCell>
                <TableCell className="text-sm">{a.description ?? '—'}</TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No actions yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------- Roles ----------
function RolesPanel({ bankId }: { bankId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sam', 'roles', bankId],
    queryFn: () => samApi.listRoles(bankId),
  });
  const [roleName, setRoleName] = useState('');
  const [desc, setDesc] = useState('');
  const create = useMutation({
    mutationFn: () => samApi.createRole(bankId, { roleName, description: desc || undefined }),
    onSuccess: () => {
      setRoleName(''); setDesc('');
      qc.invalidateQueries({ queryKey: ['sam', 'roles', bankId] });
      toast.success('Role created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'create failed'),
  });
  const del = useMutation({
    mutationFn: (id: number) => samApi.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sam', 'roles', bankId] });
      toast.success('Role removed');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">New role · bank #{bankId}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
            <Input placeholder="VAULT_OPERATOR" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="font-mono" />
            <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button disabled={!roleName || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((r: SamRole) => (
              <TableRow key={r.recId}>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.recId}</TableCell>
                <TableCell><Badge>{r.roleName}</Badge></TableCell>
                <TableCell className="text-sm">{r.description ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => confirm(`Soft-delete role ${r.roleName}?`) && del.mutate(r.recId)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No roles yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------- TeamRoleCell ----------
function TeamRoleCell({ teamId, roles, onBind }: {
  teamId: number;
  roles: SamRole[];
  onBind: (roleId: number) => void;
}) {
  const { data: bound = [], refetch } = useQuery({
    queryKey: ['sam', 'teamRoles', teamId],
    queryFn: () => samApi.listTeamRoles(teamId),
  });
  const boundIds = new Set(bound.map((b) => b.samRoleId));
  const unbound = roles.filter((r) => !boundIds.has(r.recId));
  return (
    <div className="flex flex-wrap items-center gap-1">
      {bound.map((b) => {
        const r = roles.find((x) => x.recId === b.samRoleId);
        return <Badge key={b.recId} variant="secondary" className="text-[10px] font-mono">{r?.roleName ?? `#${b.samRoleId}`}</Badge>;
      })}
      {unbound.length > 0 && (
        <select
          className="h-7 rounded border border-input bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
          defaultValue=""
          onChange={(e) => {
            const rid = Number(e.target.value);
            if (rid) { onBind(rid); setTimeout(() => refetch(), 400); }
            e.currentTarget.value = '';
          }}
        >
          <option value="" disabled>+ role</option>
          {unbound.map((r) => (
            <option key={r.recId} value={String(r.recId)}>{r.roleName}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ---------- Teams ----------
function TeamsPanel({ bankId }: { bankId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sam', 'teams', bankId],
    queryFn: () => samApi.listTeams(bankId),
  });
  const roles = useQuery({
    queryKey: ['sam', 'roles', bankId],
    queryFn: () => samApi.listRoles(bankId),
  });
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const create = useMutation({
    mutationFn: () => samApi.createTeam(bankId, { teamCode, teamName }),
    onSuccess: () => {
      setTeamCode(''); setTeamName('');
      qc.invalidateQueries({ queryKey: ['sam', 'teams', bankId] });
      toast.success('Team created');
    },
  });
  const bind = useMutation({
    mutationFn: ({ teamId, roleId }: { teamId: number; roleId: number }) =>
      samApi.bindTeamRole(teamId, roleId),
    onSuccess: () => {
      toast.success('Role bound');
      qc.invalidateQueries({ queryKey: ['sam', 'teams', bankId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Bind failed'),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">New team</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2">
            <Input placeholder="VAULT-OPS" value={teamCode} onChange={(e) => setTeamCode(e.target.value.toUpperCase())} className="font-mono" />
            <Input placeholder="Vault Operations" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <Button disabled={!teamCode || !teamName || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Bind role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((t) => (
              <TableRow key={t.recId}>
                <TableCell className="font-mono text-xs text-muted-foreground">{t.recId}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-[10px]">{t.teamCode}</Badge></TableCell>
                <TableCell className="text-sm">{t.teamName}</TableCell>
                <TableCell>
                  <TeamRoleCell
                    teamId={t.recId}
                    roles={roles.data ?? []}
                    onBind={(roleId) => bind.mutate({ teamId: t.recId, roleId })}
                  />
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No teams yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------- Staff ----------
function StaffPanel({ bankId }: { bankId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sam', 'staff', bankId],
    queryFn: () => samApi.listStaff(bankId),
  });
  const teams = useQuery({
    queryKey: ['sam', 'teams', bankId],
    queryFn: () => samApi.listTeams(bankId),
  });
  const [form, setForm] = useState({
    staffFname: '', staffLname: '', staffEmail: '', staffLoginname: '',
    password: '', samTeamId: 0, msBranchId: '' as string | number, employeeCode: '',
  });
  const create = useMutation({
    mutationFn: () => samApi.createStaff(bankId, {
      staffFname: form.staffFname,
      staffLname: form.staffLname,
      staffEmail: form.staffEmail || undefined,
      staffLoginname: form.staffLoginname,
      password: form.password || undefined,
      samTeamId: Number(form.samTeamId),
      msBranchId: form.msBranchId ? Number(form.msBranchId) : undefined,
      employeeCode: form.employeeCode || undefined,
    }),
    onSuccess: () => {
      setForm({ staffFname: '', staffLname: '', staffEmail: '', staffLoginname: '', password: '', samTeamId: 0, msBranchId: '', employeeCode: '' });
      qc.invalidateQueries({ queryKey: ['sam', 'staff', bankId] });
      toast.success('Staff created');
    },
    onError: (e: any) => toast.error(e?.message ?? 'create failed'),
  });

  const [resetFor, setResetFor] = useState<SamStaff | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const reset = useMutation({
    mutationFn: () => samApi.resetPassword(resetFor!.recId, resetPwd),
    onSuccess: () => {
      setResetFor(null); setResetPwd('');
      qc.invalidateQueries({ queryKey: ['sam', 'staff', bankId] });
      toast.success('Password reset');
    },
  });

  const canCreate = form.staffFname && form.staffLname && form.staffLoginname && form.samTeamId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">New staff · bank #{bankId}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><Label className="text-xs">First name</Label><Input value={form.staffFname} onChange={(e) => setForm({ ...form, staffFname: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Last name</Label><Input value={form.staffLname} onChange={(e) => setForm({ ...form, staffLname: e.target.value })} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Email</Label><Input value={form.staffEmail} onChange={(e) => setForm({ ...form, staffEmail: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Login</Label><Input value={form.staffLoginname} onChange={(e) => setForm({ ...form, staffLoginname: e.target.value })} className="font-mono" /></div>
            <div className="space-y-1"><Label className="text-xs">Initial password</Label><Input type="password" placeholder="blank = force-set on login" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Team</Label>
              <Select value={String(form.samTeamId)} onValueChange={(v) => setForm({ ...form, samTeamId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {(teams.data ?? []).map((t) => (
                    <SelectItem key={t.recId} value={String(t.recId)}>
                      <span className="font-mono text-xs mr-2">{t.teamCode}</span>{t.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Branch ID (opt)</Label><Input value={form.msBranchId} onChange={(e) => setForm({ ...form, msBranchId: e.target.value })} className="font-mono" /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Employee code (opt)</Label><Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} /></div>
            <div className="col-span-2 md:col-span-4 flex justify-end mt-2">
              <Button disabled={!canCreate || create.isPending} onClick={() => create.mutate()}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add staff
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Login</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((s) => (
              <TableRow key={s.recId}>
                <TableCell><Badge variant="outline" className="font-mono text-[10px]">{s.staffLoginname}</Badge></TableCell>
                <TableCell className="text-sm">{s.staffFname} {s.staffLname}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">#{s.samTeamId}</TableCell>
                <TableCell>
                  <Badge variant={s.userStatusCode === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                    {s.userStatusCode}
                  </Badge>
                  {s.forceChangePwdFlag === 'Y' && <Badge variant="destructive" className="text-[10px] ml-1">PWD</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {s.lastLoginDateTime ? s.lastLoginDateTime.slice(0, 16).replace('T', ' ') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setResetFor(s)}>
                    <KeyIcon className="h-3.5 w-3.5 mr-1" />Reset
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No staff yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!resetFor} onOpenChange={(o) => { if (!o) { setResetFor(null); setResetPwd(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {resetFor?.staffLoginname}</DialogTitle>
            <DialogDescription>User forced to change on next login.</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="New password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetFor(null); setResetPwd(''); }}>Cancel</Button>
            <Button disabled={!resetPwd || reset.isPending} onClick={() => reset.mutate()}>
              {reset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Permissions ----------
function PermissionsPanel({ bankId }: { bankId: number }) {
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ['sam', 'roles', bankId],
    queryFn: () => samApi.listRoles(bankId),
  });
  const actions = useQuery({ queryKey: ['sam', 'actions'], queryFn: samApi.listActions });
  const [roleId, setRoleId] = useState<number>(0);
  const perms = useQuery({
    queryKey: ['sam', 'perms', roleId],
    queryFn: () => samApi.listPermissions(roleId),
    enabled: roleId > 0,
  });
  const [menuId, setMenuId] = useState('1');
  const [actionId, setActionId] = useState<number>(0);
  const grant = useMutation({
    mutationFn: () => samApi.grantPermission(roleId, Number(menuId), actionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sam', 'perms', roleId] });
      toast.success('Permission granted');
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Grant permission</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_auto] gap-2">
            <Select value={String(roleId)} onValueChange={(v) => setRoleId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((r) => (
                  <SelectItem key={r.recId} value={String(r.recId)}>{r.roleName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Menu ID" value={menuId} onChange={(e) => setMenuId(e.target.value)} className="font-mono" />
            <Select value={String(actionId)} onValueChange={(v) => setActionId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select action…" /></SelectTrigger>
              <SelectContent>
                {(actions.data ?? []).map((a) => (
                  <SelectItem key={a.recId} value={String(a.recId)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!roleId || !actionId || grant.isPending} onClick={() => grant.mutate()}>
              {grant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Grant
            </Button>
          </div>
        </CardContent>
      </Card>

      {roleId > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Menu</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>HSM Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(perms.data ?? []).map((p) => {
                const a = (actions.data ?? []).find((x) => x.recId === p.samActionId);
                const cmd = a?.description?.match(/\(([^)]+)\)/)?.[1];
                return (
                  <TableRow key={p.recId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.recId}</TableCell>
                    <TableCell className="font-mono text-xs">#{p.samMenuId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {a?.name ?? `#${p.samActionId}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cmd ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {perms.data?.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No grants for this role.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
