import { api } from './client';

export interface SamAction { recId: number; name: string; description?: string }
export interface SamRole   { recId: number; msBankId: number; roleName: string; description?: string }
export interface SamTeam   { recId: number; msBankId: number; teamCode: string; teamName: string }
export interface SamStaff  {
  recId: number;
  staffFname: string;
  staffLname: string;
  staffEmail?: string;
  msBankId: number;
  msBranchId?: number;
  samTeamId: number;
  staffLoginname: string;
  userStatusCode: string;
  employeeCode?: string;
  forceChangePwdFlag: string;
  lastLoginDateTime?: string;
}
export interface SamAccessControl { recId: number; samRoleId: number; samMenuId: number; samActionId: number }

export const samApi = {
  // actions
  listActions: () => api.get<SamAction[]>('/admin/sam/actions').then(r => r.data),
  createAction: (body: { name: string; description?: string }) =>
    api.post<SamAction>('/admin/sam/actions', body).then(r => r.data),

  // roles
  listRoles: (bankId: number) =>
    api.get<SamRole[]>(`/admin/sam/banks/${bankId}/roles`).then(r => r.data),
  createRole: (bankId: number, body: { roleName: string; description?: string }) =>
    api.post<SamRole>(`/admin/sam/banks/${bankId}/roles`, body).then(r => r.data),
  deleteRole: (id: number) =>
    api.delete(`/admin/sam/roles/${id}`).then(r => r.data),

  // teams
  listTeams: (bankId: number) =>
    api.get<SamTeam[]>(`/admin/sam/banks/${bankId}/teams`).then(r => r.data),
  createTeam: (bankId: number, body: { teamCode: string; teamName: string }) =>
    api.post<SamTeam>(`/admin/sam/banks/${bankId}/teams`, body).then(r => r.data),

  // staff
  listStaff: (bankId: number) =>
    api.get<SamStaff[]>(`/admin/sam/banks/${bankId}/staff`).then(r => r.data),
  createStaff: (bankId: number, body: {
    staffFname: string; staffLname: string; staffEmail?: string;
    staffLoginname: string; password?: string;
    samTeamId: number; msBranchId?: number; employeeCode?: string;
  }) => api.post<SamStaff>(`/admin/sam/banks/${bankId}/staff`, body).then(r => r.data),
  resetPassword: (id: number, password: string) =>
    api.post(`/admin/sam/staff/${id}/reset-password`, { password }).then(r => r.data),

  // team↔role
  listTeamRoles: (teamId: number) =>
    api.get<{ recId: number; samTeamId: number; samRoleId: number }[]>(`/admin/sam/teams/${teamId}/roles`).then(r => r.data),
  bindTeamRole: (teamId: number, roleId: number) =>
    api.post(`/admin/sam/teams/${teamId}/roles/${roleId}`).then(r => r.data),

  // permissions
  listPermissions: (roleId: number) =>
    api.get<SamAccessControl[]>(`/admin/sam/roles/${roleId}/permissions`).then(r => r.data),
  grantPermission: (roleId: number, menuId: number, actionId: number) =>
    api.post<SamAccessControl>(`/admin/sam/roles/${roleId}/permissions`, { menuId, actionId }).then(r => r.data),
};
