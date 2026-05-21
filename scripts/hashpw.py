#!/usr/bin/env python3
"""Generate argon2id password hash compatible with XP-Panel auth service.
Usage: python scripts/hashpw.py [password]
"""
import sys
import secrets

try:
    import argon2.low_level as al
except ImportError:
    print("Install argon2-cffi: pip install argon2-cffi", file=sys.stderr)
    sys.exit(1)

password = sys.argv[1] if len(sys.argv) > 1 else "Password123!"
salt = secrets.token_bytes(16)
hash_bytes = al.hash_secret_raw(
    secret=password.encode(),
    salt=salt,
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    type=al.Type.ID,
)
print(f"{salt.hex()}${hash_bytes.hex()}")
