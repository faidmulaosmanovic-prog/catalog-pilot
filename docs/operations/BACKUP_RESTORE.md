# Backup and restore drill

CatalogPilot keeps its data in PostgreSQL (`DATABASE_URL`). This drill checks that a dump can be restored into an empty database.

## Local drill

The role in `DATABASE_URL` needs permission to create a database. From the repo root:

```sh
set -a
. ./.env.local
set +a
sh scripts/backup-drill.sh
```

The script dumps the current database, restores it into `catalogpilot_drill_<pid>`, prints the plan codes, and drops the throwaway database. It does not write to the live database.

## Hosted databases

On Neon, confirm point-in-time recovery is enabled and restore a branch rather than overwriting production. Record the date and the plan codes you saw.

## Last local result

31 October 2026: `scripts/backup-drill.sh` restored a dump into a throwaway database and returned plan codes `starter`, `growth`, and `pro`. The throwaway database was dropped. The live database was not modified.
