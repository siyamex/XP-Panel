import { api } from './client'
import type { Database, DBUser, CreateDatabaseRequest, CreateDBUserRequest } from '@/types/database.types'

export const databasesApi = {
  list: () =>
    api.get<{ databases: Database[]; total: number }>('/databases'),

  create: (data: CreateDatabaseRequest) =>
    api.post<Database>('/databases', data),

  delete: (id: string) =>
    api.delete(`/databases/${id}`),

  listUsers: () =>
    api.get<{ users: DBUser[] }>('/database-users'),

  createUser: (data: CreateDBUserRequest & { database_id?: string }) =>
    api.post<DBUser>('/database-users', data),

  deleteUser: (id: string) =>
    api.delete(`/database-users/${id}`),
}
