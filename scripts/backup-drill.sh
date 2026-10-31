#!/bin/sh
# Dump the CatalogPilot database and restore it into a throwaway database.
# Requires DATABASE_URL and a role that can create databases.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

dump="$(mktemp)"
name="catalogpilot_drill_$$"
cleanup() {
  rm -f "$dump"
  dropdb --if-exists "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pg_dump --no-owner --no-acl "$DATABASE_URL" > "$dump"
createdb "$name"
psql --quiet --set ON_ERROR_STOP=1 --dbname "$name" < "$dump" >/dev/null
psql --quiet --set ON_ERROR_STOP=1 --dbname "$name" --command "select code from plans order by sort_order;"
echo "Restore drill succeeded for $name"
