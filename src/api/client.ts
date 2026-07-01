import axios from 'axios';
import { toast } from 'sonner';
import { useSession } from '@/store/session';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api/v1',
  timeout: 30_000,
});

api.interceptors.request.use((cfg) => {
  const { jwt, user, selectedBankId } = useSession.getState();
  if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
  // Per-request bankScope (set by keysApi.list) overrides the session bank:
  //   'all'  -> send no X-Bank-Id so the gateway returns every bank (admin)
  //   number -> scope to that bank
  //   unset  -> fall back to the session's active bank
  const scope = (cfg as { bankScope?: number | 'all' }).bankScope;
  if (scope === 'all') {
    // intentionally omit X-Bank-Id
  } else if (typeof scope === 'number') {
    cfg.headers['X-Bank-Id'] = String(scope);
  } else {
    const bankId = selectedBankId ?? user?.bankId;
    if (bankId) cfg.headers['X-Bank-Id'] = String(bankId);
  }
  if (user?.branchId) cfg.headers['X-Branch-Id'] = String(user.branchId);
  return cfg;
});

// Soft session-expiry handling: on a 401 we toast once and clear the session.
// Clearing the session re-renders <RequireAuth>, which navigates to /login WITHOUT a
// full page reload (so the toast survives) and records the current location in router
// state (`from`) so Login can return the user where they were. Parallel 401s only
// toast once; any successful response re-arms the notice.
let sessionExpiredNotified = false;
api.interceptors.response.use(
  (r) => { sessionExpiredNotified = false; return r; },
  (err) => {
    if (err?.response?.status === 401) {
      const { jwt, clear } = useSession.getState();
      if (jwt && !sessionExpiredNotified) {
        sessionExpiredNotified = true;
        toast.error('Session expired — please sign in again.');
      }
      clear();
    }
    return Promise.reject(err);
  }
);
