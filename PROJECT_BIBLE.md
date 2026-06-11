# Sentinel Vault UI — Project Bible

> Complete reference: architecture, every page, every API call, state management, component flows, implementation guide.

---

## 1. What It Is

`sentinel-vault-ui` is the React 18 + Vite 6 frontend console for `sentinel-hsm-gateway`. It provides a bank-scoped, multi-tenant HSM key vault management interface: key generation, import/export, cryptographic operations, EMV chip processing, HSM fleet management, staff/RBAC administration, and an audit log viewer.

**Backend:** `sentinel-hsm-gateway` at `http://localhost:8090`  
**Auth:** Bearer token from gateway login stored in Zustand

---

## 2. Technology Stack

| Layer | Library | Version |
|-------|---------|---------|
| Framework | React | 18.3.1 |
| Build | Vite | 6 |
| Language | TypeScript | — |
| UI Components | shadcn/ui (Radix UI primitives) | — |
| Styling | Tailwind CSS | 3 |
| HTTP | axios | 1.7.9 |
| Server state | @tanstack/react-query | 5.83.0 |
| Client state | zustand | 5.0.2 |
| Routing | react-router-dom | 7.1.0 |
| Forms | react-hook-form | 7.61.1 |
| Icons | lucide-react | 0.469.0 |
| Font | IBM Plex Sans / IBM Plex Mono | — |
| Package manager | bun | — |

---

## 3. Project Structure

```
src/
├── api/                    # Axios API modules
│   ├── client.ts           # Axios instance + interceptors
│   ├── auth.ts             # Login / logout
│   ├── keys.ts             # Key CRUD, import, export
│   ├── crypto.ts           # Encrypt / decrypt
│   ├── admin.ts            # Banks, branches, HSM pools/nodes, audit
│   └── sam.ts              # SAM: staff, teams, roles, permissions
│
├── components/
│   ├── Layout.tsx          # App shell: sidebar nav + header
│   ├── BankSelector.tsx    # Tenant switcher (populates X-Bank-Id header)
│   ├── RequireAuth.tsx     # Auth guard wrapper
│   └── ui/                 # shadcn/ui components (Button, Dialog, Table, etc.)
│
├── pages/                  # One component per route
│   ├── Login.tsx
│   ├── Locate.tsx          # /keys — search + list
│   ├── KeyCreate.tsx       # /keys/new — RSA
│   ├── KeyCreateSym.tsx    # /keys/new-sym — symmetric
│   ├── KeyImport.tsx       # /keys/import
│   ├── KeyBlock.tsx        # /keys/block — TR-31/X9.143
│   ├── KeyDetail.tsx       # /keys/:keyId
│   ├── EmvOps.tsx          # /emv — ARQC/ARPC
│   ├── CryptoPlayground.tsx# /crypto — raw encrypt/decrypt
│   ├── CryptoWizard.tsx    # /wizard — guided flow
│   ├── Pools.tsx           # /pools — HSM fleet
│   ├── Audit.tsx           # /audit — command audit log
│   ├── RawConsole.tsx      # /console — direct Thales command
│   ├── AdminBanks.tsx      # /admin/banks
│   └── AdminRBAC.tsx       # /admin/rbac — SAM management
│
├── hooks/                  # Custom React hooks
├── store/
│   └── session.ts          # Zustand: jwt, user, selectedBankId, clear()
├── types/                  # Shared TypeScript interfaces
└── lib/                    # Utility functions
```

---

## 4. Routing (App.tsx)

```
/login                  → Login        (public)
/                       → redirect to /keys
/keys                   → Locate       (RequireAuth)
/keys/new               → KeyCreate
/keys/new-sym           → KeyCreateSym
/keys/import            → KeyImport
/keys/block             → KeyBlock
/keys/:keyId            → KeyDetail
/emv                    → EmvOps
/crypto                 → CryptoPlayground
/wizard                 → CryptoWizard
/pools                  → Pools
/audit                  → Audit
/console                → RawConsole
/admin/banks            → AdminBanks
/admin/rbac             → AdminRBAC
*                       → redirect to /keys
```

All routes except `/login` are wrapped in `RequireAuth` which checks `useSession().jwt` — redirects to `/login` if absent.

---

## 5. Authentication Flow

```
User enters loginname + password
    ▼
Login.tsx → authApi.login({loginname, password})
    ▼
POST /api/v1/auth/login
    ▼
Response: { token, staffId, bankId, bankCode }
    ▼
useSession.setState({ jwt: token, user: { staffId, bankId, bankCode } })
    ▼
navigate('/keys')

On every subsequent request:
    axios interceptor reads useSession.getState().jwt
    → Authorization: Bearer <token>
    → X-Bank-Id: <selectedBankId or user.bankId>
    → X-Branch-Id: <user.branchId> (if set)

On 401 response:
    axios interceptor → useSession.getState().clear()
    → window.location.assign('/login')
```

---

## 6. Zustand Session Store (store/session.ts)

```ts
interface SessionState {
  jwt: string | null
  user: { staffId: number; bankId: number; bankCode: string } | null
  selectedBankId: number | null
  clear: () => void
}
```

`selectedBankId` — set by `BankSelector`. Overrides `user.bankId` in the `X-Bank-Id` header. Persisted to localStorage via Zustand persist middleware.

---

## 7. Axios Client (api/client.ts)

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api/v1',
  timeout: 30_000,
});

// Request interceptor: inject Bearer token + bank/branch headers
// Response interceptor: 401 → clear session → redirect to /login
```

**Dev proxy:** Vite proxies `/api` → `http://localhost:8090` (configured in vite.config.ts).  
**Env override:** `VITE_API_TARGET=http://other-host:8090 bun run dev`

---

## 8. API Modules

### auth.ts
```ts
authApi.login({ loginname, password })
  → POST /api/v1/auth/login
  → LoginResp { success, token, staffId, bankId, bankCode }
```

### keys.ts
```ts
keysApi.list({ label?, keyType? })
  → GET /api/v1/keys
  → KeySummary[]

keysApi.get(id)
  → GET /api/v1/keys/{id}
  → KeySummary

keysApi.generateSymmetric({ label, keyType, keyScheme, mode?, zmkKeyId?, outScheme?, usage?, ownerOrg? })
  → POST /api/v1/keys/symmetric

keysApi.generateRsa({ label, modulusBits, keyType?, encoding?, publicExponentHex?, usage?, ownerOrg? })
  → POST /api/v1/keys/rsa

keysApi.importRsaWrapped({ label, wrappingPublicKey, wrappedKey, mode?, hashId?, keyType?, usage? })
  → POST /api/v1/keys/import-rsa-wrapped

keysApi.exportKey(id, { format, kbpkKeyId?, kekType?, schemeZmk?, schemeLmk?, ... })
  → POST /api/v1/keys/{id}/export
```

**KeySummary fields:** `keyId`, `label`, `keyType`, `algo`, `keyLengthBits`, `status`, `kcv`, `bankRecId`, `createdAt`, `encryptedBlobHex`, `vendorOrigin`, `expiresAt`

### crypto.ts
```ts
cryptoApi.encrypt({ keyId, plaintextHex, mode?, iv?, keyType? })
  → POST /api/v1/crypto/encrypt

cryptoApi.decrypt({ keyId, ciphertextHex, mode?, iv?, inputFormat?, outputFormat? })
  → POST /api/v1/crypto/decrypt
```

### admin.ts — Banks & Fleet
```ts
// Banks
adminApi.listBanks()          → GET /api/v1/admin/banks
adminApi.getBank(id)          → GET /api/v1/admin/banks/{id}
adminApi.createBank(body)     → POST /api/v1/admin/banks
adminApi.updateBank(id, body) → PUT /api/v1/admin/banks/{id}
adminApi.listBranches(bankId) → GET /api/v1/admin/banks/{bankId}/branches

// HSM Fleet
fleetApi.listPools()          → GET /api/v1/pools
fleetApi.listNodes()          → GET /api/v1/hsms
fleetApi.createNode(body)     → POST /api/v1/hsms
fleetApi.updateNode(id, body) → PUT /api/v1/hsms/{id}
fleetApi.deleteNode(id)       → DELETE /api/v1/hsms/{id}
fleetApi.enableNode(id)       → POST /api/v1/hsms/{id}/enable
fleetApi.disableNode(id)      → POST /api/v1/hsms/{id}/disable
fleetApi.drainNode(id)        → POST /api/v1/hsms/{id}/drain

// Audit
auditApi.list({ from?, to?, bankId?, cmd? })
  → GET /api/v1/audit → AuditEntry[]
```

**HsmNode fields:** `id`, `poolId`, `vendor`, `host`, `port`, `weight`, `direction` (OUTBOUND/INBOUND), `enabled`, `health` (UNKNOWN/UP/DOWN/DRAINING), `lastSeen`

### sam.ts — RBAC
```ts
// Staff
samApi.listStaff(bankId)
samApi.createStaff(bankId, { staffLoginname, password, samTeamId, staffFname, staffLname, ... })
samApi.resetPassword(id, password)

// Roles
samApi.listRoles(bankId)
samApi.createRole(bankId, { roleName, description? })
samApi.deleteRole(id)

// Teams
samApi.listTeams(bankId)
samApi.createTeam(bankId, { teamCode, teamName })
samApi.bindTeamRole(teamId, roleId)

// Permissions
samApi.listPermissions(roleId)
samApi.grantPermission(roleId, menuId, actionId)
samApi.listActions()
```

---

## 9. Page Flows

### Login (/login)
1. Form: `loginname` + `password`
2. `authApi.login()` → stores token in Zustand
3. Redirect → `/keys`

### Locate (/keys)
1. `keysApi.list()` with optional filters (label, keyType)
2. Renders table: label, type, algo, KCV, status, created
3. Row click → `/keys/:keyId`
4. Buttons → `/keys/new`, `/keys/new-sym`, `/keys/import`

### KeyCreateSym (/keys/new-sym)
1. Form: label, keyType (ZMK/ZPK/TPK/DATA), keyScheme (U/T), optional ZMK wrapping
2. `keysApi.generateSymmetric()` → gateway calls A0
3. Success → shows KCV + keyId

### KeyCreate (/keys/new)
1. Form: label, modulusBits (1024/2048/4096), usage
2. `keysApi.generateRsa()` → gateway calls EI
3. Success → shows public key + keyId

### KeyDetail (/keys/:keyId)
1. `keysApi.get(id)` → shows all metadata
2. Export section: select format (TR31_B/X9_143/RAW), target key
3. `keysApi.exportKey()` → shows wrapped key block

### Pools (/pools)
1. `fleetApi.listPools()` + `fleetApi.listNodes()`
2. Shows pools with node table: host, port, health badge, weight
3. Enable/Disable/Drain buttons → immediate API calls
4. Add node form: host, port, poolId, weight, direction

### RawConsole (/console)
1. Dropdown: select Thales command (A0, BU, GC, ...)
2. JSON editor for params body
3. `POST /thales/command/{cmd}` via axios
4. Response shown as formatted JSON

### Audit (/audit)
1. Date range + bankId + cmd filters
2. `auditApi.list()` → table: ts, cmd, user, latencyMs, status, errCode
3. Pagination / scroll

### AdminRBAC (/admin/rbac)
1. Tabs: Staff | Teams | Roles | Permissions
2. Staff: `samApi.listStaff()` → table, create form, reset password
3. Roles: `samApi.listRoles()` → create, bind to team
4. Permissions: select role → `samApi.listPermissions()` → grant actions

---

## 10. Component Architecture

### Layout.tsx
- Left sidebar with nav links (icons + labels)
- Top header with BankSelector + user info + logout
- `<Outlet />` for nested routes

### BankSelector.tsx
- Dropdown list of banks from `adminApi.listBanks()`
- Sets `useSession.selectedBankId`
- All subsequent requests use selected bank's `X-Bank-Id`

### RequireAuth.tsx
```tsx
if (!useSession().jwt) return <Navigate to="/login" />;
return children;
```

### TanStack Query Pattern
```tsx
// Read data
const { data, isLoading, error } = useQuery({
  queryKey: ['keys', bankId, filters],
  queryFn: () => keysApi.list(filters),
});

// Write data
const mut = useMutation({
  mutationFn: (body) => keysApi.generateSymmetric(body),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['keys'] });
    toast.success('Key created');
  },
  onError: (err) => toast.error(err.message),
});
```

---

## 11. Environment & Build

### Dev
```bash
bun install
bun run dev    # Vite dev server + HMR at localhost:5175
               # /api/v1 proxied to http://localhost:8090
```

### Production
```bash
bun run build  # Output: dist/
               # Serve dist/ with nginx or any static host
               # Set VITE_API_BASE to gateway URL
```

### Environment Variables
| Variable | Dev default | Description |
|----------|-------------|-------------|
| `VITE_API_BASE` | `/api/v1` | Axios baseURL |
| `VITE_API_TARGET` | `http://localhost:8090` | Vite proxy target |

---

## 12. Adding a New Page (Checklist)

1. Create `src/pages/MyPage.tsx`
2. Add route in `src/App.tsx` inside `<RequireAuth><Layout/></RequireAuth>`
3. Add nav entry in `src/components/Layout.tsx` sidebar
4. If new API calls needed: add to relevant `src/api/*.ts` file
5. Use `useQuery` for reads, `useMutation` for writes
6. Call `queryClient.invalidateQueries` after mutations

---

## 13. Adding a New API Module

```ts
// src/api/mymodule.ts
import { api } from './client';

export const myApi = {
  list: () => api.get<MyType[]>('/my-endpoint').then(r => r.data),
  create: (body: MyRequest) => api.post<MyType>('/my-endpoint', body).then(r => r.data),
};
```

---

## 14. Backend Dependency

Full feature requires `sentinel-hsm-gateway` running:
```bash
# In sentinel-hsm-gateway/
mvn -T 1C clean package -DskipTests
docker compose build --no-cache gateway
docker compose up -d --force-recreate gateway
```

Gateway URL: `http://localhost:8090`  
Default login: `admin` / `sentinel123`  
See `sentinel-hsm-gateway/PROJECT_BIBLE.md` for full backend reference.
