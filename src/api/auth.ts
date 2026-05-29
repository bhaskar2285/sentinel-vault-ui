import { api } from './client';

export interface LoginResp {
  success: boolean;
  reason?: string | null;
  token: string;
  staffId: number;
  bankId: number;
  bankCode: string;
}

export const authApi = {
  login: (body: { loginname: string; password: string }) =>
    api.post<LoginResp>('/auth/login', body).then((r) => r.data),
};
