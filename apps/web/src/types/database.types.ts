export type DBType = 'mysql' | 'postgresql'

export interface Database {
  id: string
  organization_id: string
  name: string
  db_type: DBType
  db_name: string
  host: string
  port: number
  status: 'active' | 'suspended' | 'error'
  size_mb: number
  created_at: string
  updated_at: string
  users?: DBUser[]
}

export interface DBUser {
  id: string
  organization_id: string
  database_id: string
  username: string
  privileges: string[]
  created_at: string
}

export interface CreateDatabaseRequest {
  name: string
  db_type: DBType
  password: string
}

export interface CreateDBUserRequest {
  username: string
  password: string
  privileges?: string[]
}

export const DB_PRIVILEGES = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE',
  'CREATE', 'DROP', 'INDEX', 'ALTER',
  'ALL PRIVILEGES',
]
