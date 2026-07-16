-- ============================================================
-- Migration: 006_create_sequence_audit_logs
-- Target:    SAP HANA Cloud  |  Schema: HATCH
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

-- ── Step 1: Create table (guarded) ───────────────────────────
DO BEGIN
  DECLARE table_exists INT;

  SELECT COUNT(*) INTO table_exists
    FROM SYS.TABLES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_AUDIT_LOGS';

  IF :table_exists = 0 THEN
    EXEC '
      CREATE COLUMN TABLE "HATCH"."SEQUENCE_AUDIT_LOGS" (
        "ID"           VARCHAR(36)  NOT NULL,
        "SEQUENCE_ID"  VARCHAR(36)  NOT NULL,
        "RAN_AT"       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "PROCESSED"    INTEGER      NOT NULL DEFAULT 0,
        "EMAILS_SENT"  INTEGER      NOT NULL DEFAULT 0,
        "COMPLETED"    INTEGER      NOT NULL DEFAULT 0,
        "ERRORS"       INTEGER      NOT NULL DEFAULT 0,
        PRIMARY KEY ("ID")
      )
    ';
  END IF;
END;

-- ── Step 2: Index for per-sequence queries (newest first) ─────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_AUDIT_LOGS'
     AND INDEX_NAME  = 'IDX_SAL_SEQUENCE';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_SAL_SEQUENCE"
            ON "HATCH"."SEQUENCE_AUDIT_LOGS" ("SEQUENCE_ID", "RAN_AT" DESC)';
  END IF;
END;

-- ── Verification ──────────────────────────────────────────────
-- SELECT COLUMN_NAME, DATA_TYPE_NAME, DEFAULT_VALUE, IS_NULLABLE
--   FROM SYS.TABLE_COLUMNS
--  WHERE SCHEMA_NAME = 'HATCH'
--    AND TABLE_NAME  = 'SEQUENCE_AUDIT_LOGS'
--  ORDER BY POSITION;
