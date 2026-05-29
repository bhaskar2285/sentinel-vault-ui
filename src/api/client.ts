import axios from 'axios';
import { useSession } from '@/store/session';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api/v1',
  timeout: 30_000,
});

api.interceptors.request.use((cfg) => {
  const { jwt, user, selectedBankId } = useSession.getState();
  if (jwt) cfg.headers.Authorization = `Bearer ${jwt}`;
  const bankId = selectedBankId ?? user?.bankId;
  if (bankId) cfg.headers['X-Bank-Id'] = String(bankId);
  if (user?.branchId) cfg.headers['X-Branch-Id'] = String(user.branchId);
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      useSession.getState().clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);
