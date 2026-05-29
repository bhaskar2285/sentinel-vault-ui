import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  staffId: number;
  loginname: string;
  bankId?: number;
  bankCode?: string;
  branchId?: number;
  roles?: string[];
}

interface SessionState {
  jwt: string | null;
  user: SessionUser | null;
  /** Active bank scope — defaults to user.bankId, can be overridden via BankSelector for ADMIN */
  selectedBankId: number | null;
  setSession: (jwt: string, user: SessionUser) => void;
  setSelectedBankId: (id: number | null) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      jwt: null,
      user: null,
      selectedBankId: null,
      setSession: (jwt, user) =>
        set({ jwt, user, selectedBankId: user.bankId ?? null }),
      setSelectedBankId: (id) => set({ selectedBankId: id }),
      clear: () => set({ jwt: null, user: null, selectedBankId: null }),
    }),
    { name: 'sentinel.session' }
  )
);
