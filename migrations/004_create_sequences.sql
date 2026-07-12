-- ============================================================
-- Migration: 004_create_sequences
-- Target:    SAP HANA Cloud  |  Schema: HATCH
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

-- ── Step 1: Create table (guarded) ───────────────────────────
DO BEGIN
  DECLARE table_exists INT;

  SELECT COUNT(*) INTO table_exists
    FROM SYS.TABLES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCES';

  IF :table_exists = 0 THEN
    EXEC '
      CREATE COLUMN TABLE "HATCH"."SEQUENCES" (
        "ID"         VARCHAR(36)      NOT NULL,
        "NAME"       NVARCHAR(200)    NOT NULL,
        "OWNER_UID"  NVARCHAR(128)    NOT NULL,
        "FLOW_JSON"  NCLOB            NOT NULL,
        "STATUS"     VARCHAR(20)      NOT NULL DEFAULT ''draft'',
        "CREATED_AT" TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UPDATED_AT" TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("ID")
      )
    ';
  END IF;
END;

-- ── Step 2: Index on OWNER_UID ────────────────────────────────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCES'
     AND INDEX_NAME  = 'IDX_SEQUENCES_OWNER';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_SEQUENCES_OWNER"
            ON "HATCH"."SEQUENCES" ("OWNER_UID")';
  END IF;
END;

-- ── Verification ──────────────────────────────────────────────
-- SELECT COLUMN_NAME, DATA_TYPE_NAME, DEFAULT_VALUE, IS_NULLABLE
--   FROM SYS.TABLE_COLUMNS
--  WHERE SCHEMA_NAME = 'HATCH'
--    AND TABLE_NAME  = 'SEQUENCES'
--  ORDER BY POSITION;
