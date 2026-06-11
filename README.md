# sentinel-vault-ui

Bank-scoped HSM key vault console. React 18 + Vite 6 + shadcn/ui frontend for `sentinel-hsm-gateway`.

---

## Stack

| Layer | Library |
|-------|---------|
| Framework | React 18 + Vite 6 + TypeScript |
| UI components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS 3 + HSL CSS-var semantic theme |
| Font | IBM Plex Sans / IBM Plex Mono |
| HTTP | axios + TanStack Query v5 |
| State | Zustand (session + selected bank) |
| Routing | React Router DOM v7 |
| Forms | React Hook Form |

---

## Quick Start

```bash
bun install
bun run dev        # http://localhost:5175 — proxies /api/v1 → :8090
```

Override gateway target:
```bash
VITE_API_TARGET=http://localhost:8090 bun run dev
```

Production build:
```bash
bun run build      # output: dist/
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api/v1` | API base URL |
| `VITE_API_TARGET` | `http://localhost:8090` | Vite proxy target (dev only) |

---

## Backend

Requires `sentinel-hsm-gateway` running on `http://localhost:8090`.

Every request automatically injects:
- `Authorization: Bearer <token>` — from Zustand session store
- `X-Bank-Id: <id>` — from selected bank in BankSelector
- `X-Branch-Id: <id>` — from logged-in user's branch (if set)

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Staff login — `POST /api/v1/auth/login` |
| `/keys` | Locate | Search and list all keys; view hex blob |
| `/keys/new` | KeyCreate | Generate RSA key pair via `POST /api/v1/keys/rsa` |
| `/keys/new-sym` | KeyCreateSym | Generate symmetric key via `POST /api/v1/keys/symmetric` |
| `/keys/import` | KeyImport | Import RSA-wrapped key via `POST /api/v1/keys/import-rsa-wrapped` |
| `/keys/block` | KeyBlock | Form TR-31 / X9.143 key block |
| `/keys/:keyId` | KeyDetail | Key metadata, KCV, export options |
| `/emv` | EmvOps | EMV chip operations (ARQC verify, ARPC generate) |
| `/crypto` | CryptoPlayground | Raw encrypt/decrypt/MAC playground |
| `/wizard` | CryptoWizard | Guided cryptographic workflow |
| `/pools` | Pools | HSM fleet management — nodes, health, enable/disable/drain |
| `/audit` | Audit | Audit log with filters (bank, date range, command) |
| `/console` | RawConsole | Direct Thales command console — `POST /thales/command/{CMD}` |
| `/admin/banks` | AdminBanks | Bank + branch administration |
| `/admin/rbac` | AdminRBAC | Staff, teams, roles, permissions (SAM) |

---

## Project Structure

```
src/
├── api/            # Axios API modules (one file per domain)
│   ├── client.ts   # Axios instance + interceptors (auth token, bank header)
│   ├── auth.ts     # Login
│   ├── keys.ts     # Key CRUD + import/export
│   ├── crypto.ts   # Encrypt / decrypt
│   ├── admin.ts    # Banks, branches, HSM pools/nodes, audit
│   └── sam.ts      # SAM: staff, teams, roles, permissions
├── components/
│   ├── Layout.tsx      # Sidebar + header shell
│   ├── BankSelector.tsx # Bank context switcher
│   ├── RequireAuth.tsx  # Auth guard wrapper
│   └── ui/             # shadcn/ui component library
├── pages/          # One file per route (see table above)
├── hooks/          # Custom React hooks
├── store/          # Zustand stores
│   └── session.ts  # jwt, user, selectedBankId, clear()
├── types/          # Shared TypeScript types
└── lib/            # Utilities
```

---

## API Modules

### auth.ts
```ts
authApi.login({ loginname, password }) → { token, staffId, bankId, bankCode }
```

### keys.ts
```ts
keysApi.list({ label?, keyType? })           → KeySummary[]
keysApi.get(id)                              → KeySummary
keysApi.generateSymmetric({ label, keyType, keyScheme, ... })
keysApi.generateRsa({ label, modulusBits, ... })
keysApi.importRsaWrapped({ label, wrappingPublicKey, wrappedKey, ... })
keysApi.exportKey(id, { format, kbpkKeyId, ... })
```

### crypto.ts
```ts
cryptoApi.encrypt({ keyId, plaintextHex, mode?, iv? })
cryptoApi.decrypt({ keyId, ciphertextHex, mode?, iv? })
```

### admin.ts — Banks & Fleet
```ts
adminApi.listBanks()
adminApi.createBank(body)
adminApi.listBranches(bankId)

fleetApi.listPools()
fleetApi.listNodes()
fleetApi.createNode({ host, port, poolId, vendor, ... })
fleetApi.enableNode(id) / disableNode(id) / drainNode(id)

auditApi.list({ from?, to?, bankId?, cmd? })   → AuditEntry[]
```

### sam.ts — RBAC
```ts
samApi.listStaff(bankId)
samApi.createStaff(bankId, { staffLoginname, password, samTeamId, ... })
samApi.resetPassword(id, password)
samApi.listRoles(bankId)
samApi.bindTeamRole(teamId, roleId)
samApi.grantPermission(roleId, menuId, actionId)
```

---

## Authentication Flow

1. `POST /api/v1/auth/login` → `{ token }` hex string
2. Token stored in Zustand `useSession.jwt`
3. Axios interceptor injects `Authorization: Bearer <token>` on every request
4. 401 response → `useSession.clear()` → redirect to `/login`

---

## HSM Raw Console

`/console` page sends direct Thales commands via `POST /thales/command/{CMD}`.

Example — generate ZMK (A0):
```json
POST /thales/command/A0
{ "keyType": "000", "keyScheme": "U" }
```

See `sentinel-hsm-gateway` README for full command reference and keyType codes.

---

## Implementation Guide

### Adding a new page

1. Create `src/pages/MyPage.tsx`
2. Add route in `src/App.tsx`
3. Add nav link in `src/components/Layout.tsx`

### Adding a new API call

1. Add function to relevant `src/api/*.ts` file
2. Use `useQuery` / `useMutation` from TanStack Query in page/hook
3. Pass `queryClient.invalidateQueries` after mutations to refresh lists

### Adding a new API module

1. Create `src/api/mymodule.ts` importing `api` from `./client`
2. Export typed functions returning `api.get/post/put/delete(...).then(r => r.data)`

### Zustand session store
```ts
import { useSession } from '@/store/session';
const { jwt, user, selectedBankId, clear } = useSession();
```

### TanStack Query pattern
```ts
// Read
const { data, isLoading } = useQuery({
  queryKey: ['keys', bankId],
  queryFn: () => keysApi.list({ keyType: 'ZMK' }),
});

// Write
const mut = useMutation({
  mutationFn: (body) => keysApi.generateSymmetric(body),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['keys'] }),
});
```

---

## Backend (sentinel-hsm-gateway)

Separate repo: `sentinel-hsm-gateway`.  
Default URL: `http://localhost:8090`  
API prefix: `/api/v1` (semantic) and `/thales/command` (raw HSM commands)
