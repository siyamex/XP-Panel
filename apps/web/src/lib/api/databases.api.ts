import { api } from './client'
import type { Database, DBUser, CreateDatabaseRequest, CreateDBUserRequest } from '@/types/database.types'

export const databasesApi = {
  list: () =>
    api.get<{ databases: Database[]; total: number }>('/databases'),

  create: (data: CreateDatabaseRequest) =>
    api.post<Database>('/databases', data),

  delete: (id: string) =>
    api.delete(`/databases/${id}`),

  listUsers: (dbId: string) =>
    api.get<{ users: DBUser[] }>(`/databases/${dbId}/users`),

  createUser: (dbId: string, data: CreateDBUserRequest) =>
    api.post<DBUser>(`/databases/${dbId}/users`, data),

  deleteUser: (dbId: string, userId: string) =>
    api.delete(`/databases/${dbId}/users/${userId}`),
}
