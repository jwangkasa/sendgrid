-- ============================================================
-- Migration: 001_create_recipient_logs
-- Target:    SAP HANA Cloud
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

-- ── Step 1: Create table (guarded) ───────────────────────────
DO BEGIN
  DECLARE table_exists INT;

  SELECT COUNT(*) INTO table_exists
    FROM SYS.TABLES
   WHERE SCHEMA_NAME = CURRENT_SCHEMA
     AND TABLE_NAME  = 'RECIPIENT_LOGS';

  IF :table_exists = 0 THEN
    EXEC '
      CREATE COLUMN TABLE RECIPIENT_LOGS (
        "ID"              VARCHAR(36)     NOT NULL,
        "FIRST_NAME"      NVARCHAR(100),
        "LAST_NAME"       NVARCHAR(100),
        "CATEGORY"        NVARCHAR(100),
        "COMPANY"         NVARCHAR(200),
        "EMAIL_ADDRESS"   NVARCHAR(254)   NOT NULL,
        "PHONE_NUMBER"    NVARCHAR(30),
        "COMMENTS"        NVARCHAR(2000),
        "BATCH_ID"        VARCHAR(50)     NOT NULL,
        "SG_MESSAGE_ID"   VARCHAR(100),
        "DELIVERY_STATUS" VARCHAR(20)     NOT NULL DEFAULT ''Pending'',
        "OPEN_COUNT"      INTEGER         NOT NULL DEFAULT 0,
        "CLICK_COUNT"     INTEGER         NOT NULL DEFAULT 0,
        "FAILURE_REASON"  NVARCHAR(500),
        "CREATED_AT"      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UPDATED_AT"      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("ID")
      )
    ';
  END IF;
END;

-- ── Step 2: Non-unique index on SG_MESSAGE_ID ────────────────
-- HANA Cloud does not support partial/filtered indexes (WHERE clause).
-- We use a plain index here; uniqueness for non-NULL values is enforced
-- at the application layer in the webhook route via the timestamp guard.
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = CURRENT_SCHEMA
     AND TABLE_NAME  = 'RECIPIENT_LOGS'
     AND INDEX_NAME  = 'IDX_RECIPIENT_LOGS_SG_MESSAGE_ID';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_RECIPIENT_LOGS_SG_MESSAGE_ID"
            ON RECIPIENT_LOGS ("SG_MESSAGE_ID")';
  END IF;
END;

-- ── Step 3: Index for batch-level aggregation ─────────────────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = CURRENT_SCHEMA
     AND TABLE_NAME  = 'RECIPIENT_LOGS'
     AND INDEX_NAME  = 'IDX_RECIPIENT_LOGS_BATCH_ID';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_RECIPIENT_LOGS_BATCH_ID"
            ON RECIPIENT_LOGS ("BATCH_ID")';
  END IF;
END;

-- ── Step 4: Composite index for webhook lookup ────────────────
DO BEGIN
  DECLARE idx_exists INT;

  SELECT COUNT(*) INTO idx_exists
    FROM SYS.INDEXES
   WHERE SCHEMA_NAME = CURRENT_SCHEMA
     AND TABLE_NAME  = 'RECIPIENT_LOGS'
     AND INDEX_NAME  = 'IDX_RECIPIENT_LOGS_EMAIL_BATCH';

  IF :idx_exists = 0 THEN
    EXEC 'CREATE INDEX "IDX_RECIPIENT_LOGS_EMAIL_BATCH"
            ON RECIPIENT_LOGS ("EMAIL_ADDRESS", "BATCH_ID")';
  END IF;
END;

-- ── Verification (run manually to confirm) ────────────────────
-- SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, DEFAULT_VALUE, IS_NULLABLE
--   FROM SYS.TABLE_COLUMNS
--  WHERE SCHEMA_NAME = CURRENT_SCHEMA
--    AND TABLE_NAME  = 'RECIPIENT_LOGS'
--  ORDER BY POSITION;
