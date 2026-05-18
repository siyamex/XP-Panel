import { api } from './client'
import type { Database, DBUser, CreateDatabaseRequest, CreateDBUserRequest } from '@/types/database.types'

export const databasesApi = {
  list: () =>
    api.get<{ databases: Database[]; total: number }>('/dbmanager/databases'),

  create: (data: CreateDatabaseRequest) =>
    api.post<Database>('/dbmanager/databases', data),

  delete: (id: string) =>
    api.delete(`/dbmanager/databases/${id}`),

  listUsers: (dbId: string) =>
    api.get<{ users: DBUser[] }>(`/dbmanager/databases/${dbId}/users`),

  createUser: (dbId: string, data: CreateDBUserRequest) =>
    api.post<DBUser>(`/dbmanager/databases/${dbId}/users`, data),

  deleteUser: (dbId: string, userId: string) =>
    api.delete(`/dbmanager/databases/${dbId}/users/${userId}`),
}
