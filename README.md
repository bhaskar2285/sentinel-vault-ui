# sentinel-vault-ui

Bank-scoped HSM key vault console. Vault aesthetic (shadcn + IBM Plex + HSL semantic theme) on top of `sentinel-hsm-gateway` REST API.

## Run

```bash
bun install
bun run dev               # http://localhost:5175 — proxies /api → :8090
```

Override gateway target:
```bash
VITE_API_TARGET=http://localhost:8090 bun run dev
```

## Stack

- React 18 + Vite 6 + TS
- shadcn/ui (Radix primitives) — copied from `xenticatesecurevault-main`
- Tailwind 3 + HSL CSS-var semantic theme (light)
- IBM Plex Sans / Mono
- axios + @tanstack/react-query
- zustand (selected bank persistence)
- react-router-dom v7

## Backend

Points at `sentinel-hsm-gateway` at `http://localhost:8090/api/v1` (host port 8090, container 8080).

Tenant scope: `X-Bank-Id` header injected by axios interceptor from zustand store.

## Phases

- P0 — scaffold + design tokens
- P1 — Layout + BankSelector + /login + /keys (Locate, full hex visible)
- P2 — remaining pages (KeyCreate, KeyDetail, Crypto, Pools, Audit, Admin)
- P3 — gateway DTO patch (`encryptedBlobHex` on `KeySummaryResponse`)
