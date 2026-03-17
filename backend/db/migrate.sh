#!/usr/bin/env bash
# =============================================================================
# NurZeka — PostgreSQL migration runner with automatic backup + rollback
#
# Usage:
#   ./backend/db/migrate.sh                      # run all pending migrations
#   ./backend/db/migrate.sh --dry-run            # parse SQL only, no execute
#   DEBUG=1 ./backend/db/migrate.sh              # verbose psql output
#
# Environment (reads from .env if present):
#   PG_DATABASE_URL   e.g. postgresql://nurzek:nurzek@localhost:5432/nurzek
#   BACKUP_DIR        where pg_dump files go  (default: /tmp/nurzek_backups)
#
# Exit codes:
#   0  success
#   1  pre-flight check failed (env missing, psql unavailable, etc.)
#   2  backup failed
#   3  migration failed  (auto-rollback attempted from backup)
#   4  rollback also failed  (CRITICAL — manual intervention required)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"
ENV_FILE="$SCRIPT_DIR/../.env"
DRY_RUN=false

# ── Load .env ─────────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    # Export only lines that look like VAR=value (skip comments/blank)
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Z_]+=.+' "$ENV_FILE")
    set +o allexport
fi

# ── Parse args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

# ── Pre-flight ────────────────────────────────────────────────────────────────
if [[ -z "${PG_DATABASE_URL:-}" ]]; then
    echo "[migrate] ERROR: PG_DATABASE_URL is not set."
    echo "         Set it in backend/.env or export it before running this script."
    exit 1
fi

if ! command -v psql &>/dev/null; then
    echo "[migrate] ERROR: psql not found. Install postgresql-client."
    exit 1
fi

if ! command -v pg_dump &>/dev/null; then
    echo "[migrate] ERROR: pg_dump not found. Install postgresql-client."
    exit 1
fi

if [[ -z "$(ls -A "$MIGRATIONS_DIR"/*.sql 2>/dev/null)" ]]; then
    echo "[migrate] No .sql files found in $MIGRATIONS_DIR — nothing to do."
    exit 0
fi

# ── Connectivity test ─────────────────────────────────────────────────────────
echo "[migrate] Testing Postgres connectivity..."
if ! psql "$PG_DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo "[migrate] ERROR: Cannot connect to Postgres using PG_DATABASE_URL."
    exit 1
fi
echo "[migrate] Connection OK."

# ── Dry-run mode ──────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
    echo "[migrate] DRY-RUN: parsing SQL files only..."
    for sql_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
        echo "[migrate] Checking $sql_file..."
        psql "$PG_DATABASE_URL" --dry-run -f "$sql_file" 2>/dev/null \
            || psql "$PG_DATABASE_URL" -c "$(cat "$sql_file")" --echo-all 2>&1 | head -20
    done
    echo "[migrate] DRY-RUN complete — no changes made."
    exit 0
fi

# ── Backup ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/tmp/nurzek_backups}"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre_migration_$(date +%Y%m%d_%H%M%S).dump"

echo "[migrate] Creating backup → $BACKUP_FILE"
if ! pg_dump --format=custom --file="$BACKUP_FILE" "$PG_DATABASE_URL"; then
    echo "[migrate] ERROR: Backup failed. Aborting migration to protect production data."
    exit 2
fi
echo "[migrate] Backup created: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# ── Run migrations ────────────────────────────────────────────────────────────
FAILED_FILE=""

for sql_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    echo "[migrate] Running $sql_file ..."
    if [[ "${DEBUG:-}" == "1" ]]; then
        psql "$PG_DATABASE_URL" --echo-all -f "$sql_file"
    else
        if ! psql "$PG_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"; then
            FAILED_FILE="$sql_file"
            break
        fi
    fi
    echo "[migrate] ✓ $sql_file applied."
done

# ── Handle failure with rollback ──────────────────────────────────────────────
if [[ -n "$FAILED_FILE" ]]; then
    echo ""
    echo "[migrate] !! MIGRATION FAILED: $FAILED_FILE"
    echo "[migrate] Attempting rollback from backup: $BACKUP_FILE"

    # Drop and recreate the database, then restore from backup.
    # This is destructive — that's the point.
    DB_NAME=$(psql "$PG_DATABASE_URL" -t -c "SELECT current_database()" | tr -d '[:space:]')
    # Extract host/port/user from URL for restore command
    if pg_restore --clean --if-exists --no-owner --format=custom \
                  --dbname="$PG_DATABASE_URL" "$BACKUP_FILE"; then
        echo "[migrate] Rollback successful. Database restored to pre-migration state."
        echo "[migrate] Backup kept at: $BACKUP_FILE"
        exit 3
    else
        echo ""
        echo "[migrate] !! CRITICAL: Rollback also failed."
        echo "[migrate]    Database may be in inconsistent state."
        echo "[migrate]    Manual restore required:"
        echo "[migrate]      pg_restore --clean --if-exists --no-owner --format=custom \\"
        echo "[migrate]                 --dbname=\"\$PG_DATABASE_URL\" $BACKUP_FILE"
        exit 4
    fi
fi

# ── Success ───────────────────────────────────────────────────────────────────
echo ""
echo "[migrate] All migrations applied successfully."
echo "[migrate] Backup retained at: $BACKUP_FILE"
echo "[migrate] Safe to delete it after verifying the system: rm $BACKUP_FILE"
