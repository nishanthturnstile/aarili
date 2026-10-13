#!/bin/sh
# Runs only when the Aarili volume is first initialized. No business tables.
set -eu
APP_OWNER_PASSWORD="$(cat /run/secrets/owner_password)"
APP_USER_PASSWORD="$(cat /run/secrets/user_password)"
export APP_OWNER_PASSWORD APP_USER_PASSWORD
psql -v ON_ERROR_STOP=1 --username postgres --dbname aarili <<'SQL'
\getenv owner_password APP_OWNER_PASSWORD
\getenv user_password APP_USER_PASSWORD
CREATE ROLE app_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_password';
CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'user_password';
ALTER DATABASE aarili OWNER TO app_owner;
REVOKE ALL ON DATABASE aarili FROM PUBLIC;
GRANT CONNECT ON DATABASE aarili TO app_user;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO app_owner;
GRANT USAGE ON SCHEMA public TO app_user;
CREATE EXTENSION pg_trgm;
CREATE EXTENSION pgcrypto;
SQL
unset APP_OWNER_PASSWORD APP_USER_PASSWORD
