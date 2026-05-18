package domain

import "time"

type DBType string

const (
	DBTypeMySQL      DBType = "mysql"
	DBTypePostgreSQL DBType = "postgresql"
)

type Database struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	DBType         DBType    `json:"db_type"`
	DBName         string    `json:"db_name"`
	Host           string    `json:"host"`
	Port           int       `json:"port"`
	Status         string    `json:"status"`
	SizeMB         int64     `json:"size_mb"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	Users          []DBUser  `json:"users,omitempty"`
}

type DBUser struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	DatabaseID     string    `json:"database_id"`
	Username       string    `json:"username"`
	Privileges     []string  `json:"privileges"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateDatabaseRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=64"`
	DBType   DBType `json:"db_type" validate:"required"`
	Password string `json:"password" validate:"required,min=8"`
}

type CreateDBUserRequest struct {
	Username   string   `json:"username" validate:"required"`
	Password   string   `json:"password" validate:"required,min=8"`
	Privileges []string `json:"privileges"`
}

type ImportRequest struct {
	Format string `json:"format"` // sql, dump
}
