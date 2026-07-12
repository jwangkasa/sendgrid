-- ============================================================
-- Migration: 005_create_sequence_enrollments
-- Target:    SAP HANA Cloud  |  Schema: HATCH
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

-- ── Step 1: Create table (guarded) ───────────────────────────
DO BEGIN
  DECLARE table_exists INT;

  SELECT COUNT(*) INTO table_exists
    FROM SYS.TABLES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_ENROLLMENTS';

  IF :table_exists = 0 THEN
    EXEC '
      CREATE COLUMN TABLE "HATCH"."SEQUENCE_ENROLLMENTS" (
        "ID"            VARCHAR(36)    NOT NULL,
        "SEQUENCE_ID"   VARCHAR(36)    NOT NULL,
        "EMAIL_ADDRESS" NVARCHAR(254)  NOT NULL,
        "CURRENT_NODE"  VARCHAR(36)    NOT NULL,
        "STATUS"        VARCHAR(20)    NOT NULL DEFAULT ''active'',
        "NEXT_RUN_AT"   TIMESTAMP      NOT NULL,
        "LAST_BATCH_ID" VARCHAR(50),
        "METADATA"      NCLOB,
        "CREATED_AT"    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UPDATED_AT"    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("ID")
      )
    ';
  END IF;
END;

-- ── Step 2: Composite index for run-engine polling ────────────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_ENROLLMENTS'
     AND INDEX_NAME  = 'IDX_SE_NEXT_RUN';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_SE_NEXT_RUN"
            ON "HATCH"."SEQUENCE_ENROLLMENTS" ("NEXT_RUN_AT", "STATUS")';
  END IF;
END;

-- ── Step 3: Index for per-sequence queries ────────────────────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_ENROLLMENTS'
     AND INDEX_NAME  = 'IDX_SE_SEQUENCE';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_SE_SEQUENCE"
            ON "HATCH"."SEQUENCE_ENROLLMENTS" ("SEQUENCE_ID")';
  END IF;
END;

-- ── Step 4: Composite index for email + sequence lookup ───────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_ENROLLMENTS'
     AND INDEX_NAME  = 'IDX_SE_EMAIL';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_SE_EMAIL"
            ON "HATCH"."SEQUENCE_ENROLLMENTS" ("EMAIL_ADDRESS", "SEQUENCE_ID")';
  END IF;
END;

-- ── Verification ──────────────────────────────────────────────
-- SELECT COLUMN_NAME, DATA_TYPE_NAME, DEFAULT_VALUE, IS_NULLABLE
--   FROM SYS.TABLE_COLUMNS
--  WHERE SCHEMA_NAME = 'HATCH'
--    AND TABLE_NAME  = 'SEQUENCE_ENROLLMENTS'
--  ORDER BY POSITION;
