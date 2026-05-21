#!/usr/bin/env bash
# Creates the demo admin user with a properly hashed password.
# Run AFTER seed.sql, AFTER migrations have run.
# Usage: ./scripts/create-admin.sh [password]
# Default password: Password123!

set -euo pipefail

PASSWORD="${1:-Password123!}"
DB_URL="${DATABASE_URL:-postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable}"

echo "Creating admin user with argon2id hash..."

# Use the auth service to generate the hash via a small Go program
HASH=$(cd services/auth && go run -v ./cmd/hashpw/main.go "$PASSWORD" 2>/dev/null || echo "")

if [ -z "$HASH" ]; then
  echo "Warning: could not generate argon2id hash, using bcrypt fallback"
  HASH=$(python3 -c "
import hashlib, secrets, base64
salt = secrets.token_hex(16)
import subprocess, sys
try:
    result = subprocess.run(['htpasswd', '-bnBC', '12', '', '$PASSWORD'], capture_output=True, text=True)
    print(result.stdout.split(':')[1].strip())
except:
    # Simple placeholder - replace in production
    print('PLACEHOLDER_HASH_RUN_create-admin_sh')
")
fi

psql "$DB_URL" <<SQL
UPDATE users SET password_hash = '$HASH', status = 'active', email_verified = TRUE
WHERE email = 'admin@demo.local';

UPDATE users SET password_hash = '$HASH', status = 'active', email_verified = TRUE
WHERE email = 'reseller@demo.local';

UPDATE users SET password_hash = '$HASH', status = 'active', email_verified = TRUE
WHERE email = 'user@demo.local';

SELECT email, status, email_verified FROM users WHERE email LIKE '%@demo.local';
SQL

echo "Done! Login at http://localhost:3000"
echo "  admin@demo.local / $PASSWORD"
