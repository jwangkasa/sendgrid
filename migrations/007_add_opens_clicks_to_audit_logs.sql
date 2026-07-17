-- ============================================================
-- Migration: 007_add_opens_clicks_to_audit_logs
-- Target:    SAP HANA Cloud  |  Schema: HATCH
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

DO BEGIN
  DECLARE col_exists INT;

  SELECT COUNT(*) INTO col_exists
    FROM SYS.TABLE_COLUMNS
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_AUDIT_LOGS'
     AND COLUMN_NAME = 'OPENS';

  IF :col_exists = 0 THEN
    EXEC 'ALTER TABLE "HATCH"."SEQUENCE_AUDIT_LOGS" ADD ("OPENS" INTEGER NOT NULL DEFAULT 0)';
  END IF;
END;

DO BEGIN
  DECLARE col_exists INT;

  SELECT COUNT(*) INTO col_exists
    FROM SYS.TABLE_COLUMNS
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'SEQUENCE_AUDIT_LOGS'
     AND COLUMN_NAME = 'CLICKS';

  IF :col_exists = 0 THEN
    EXEC 'ALTER TABLE "HATCH"."SEQUENCE_AUDIT_LOGS" ADD ("CLICKS" INTEGER NOT NULL DEFAULT 0)';
  END IF;
END;
