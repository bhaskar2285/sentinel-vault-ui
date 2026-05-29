import { api } from './client';

export interface Bank {
  recId: number;
  code: string;
  name: string;
  description?: string;
  shortCode?: string;
  fiid?: string;
  isDefault?: 'Y' | 'N';
  loginMethodType?: 'DB' | 'LDAP' | 'MSAD' | 'MTLS';
  ldapIp?: string | null;
  ldapPort?: number | null;
  baseDn?: string | null;
  searchBaseDn?: string | null;
  permissionMethodType?: 'DB' | 'IDM';
  countryIso2?: string;
  swiftBic?: string | null;
  regulatorId?: string | null;
  recordStatus?: 'Y' | 'N';
}

export interface Branch {
  recId: number;
  msBankId: number;
  code: string;
  name: string;
  branchType?: string;
  countryIso2?: string;
}

export const adminApi = {
  listBanks: () => api.get<Bank[]>('/admin/banks').then((r) => r.data),
  getBank: (id: number) => api.get<Bank>(`/admin/banks/${id}`).then((r) => r.data),
  createBank: (body: Partial<Bank>) => api.post<Bank>('/admin/banks', body).then((r) => r.data),
  updateBank: (id: number, body: Partial<Bank>) =>
    api.put<Bank>(`/admin/banks/${id}`, body).then((r) => r.data),

  listBranches: (bankId: number) =>
    api.get<Branch[]>(`/admin/banks/${bankId}/branches`).then((r) => r.data),
};

export interface Pool {
  id: number;
  vendor: string;
  name: string;
  lbStrategy: string;
  enabled: boolean;
}

export interface HsmNode {
  id: number;
  poolId: number;
  vendor: string;
  host: string;
  port: number;
  weight: number;
  direction: 'OUTBOUND' | 'INBOUND';
  enabled: boolean;
  health: 'UNKNOWN' | 'UP' | 'DOWN' | 'DRAINING';
}

export const fleetApi = {
  listPools: () => api.get<Pool[]>('/pools').then((r) => r.data),
  listNodes: () => api.get<HsmNode[]>('/hsms').then((r) => r.data),
  drainNode: (id: number) => api.post(`/hsms/${id}/drain`).then((r) => r.data),
};

export interface AuditEntry {
  id: number;
  cmdCode: string;
  bankRecId?: number;
  staffLoginname?: string;
  keyUuid?: string;
  errCode?: string;
  latencyMs?: number;
  createdAt: string;
}

export const auditApi = {
  list: (params: { from?: string; to?: string; bankId?: number; cmd?: string } = {}) =>
    api.get<AuditEntry[]>('/audit', { params }).then((r) => r.data),
};
