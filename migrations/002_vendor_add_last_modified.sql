-- ============================================================
-- Migration: 002_vendor_add_last_modified
-- Target:    SAP HANA Cloud (schema HATCH)
-- Run via:   SAP HANA Database Explorer SQL Console or hdbsql
-- ============================================================

DO BEGIN
  DECLARE col_exists INT;

  SELECT COUNT(*) INTO col_exists
    FROM SYS.TABLE_COLUMNS
   WHERE SCHEMA_NAME = 'HATCH'
     AND TABLE_NAME  = 'VENDOR'
     AND COLUMN_NAME = 'LAST_MODIFIED';

  IF :col_exists = 0 THEN
    EXEC 'ALTER TABLE "HATCH"."VENDOR" ADD ("LAST_MODIFIED" TIMESTAMP)';
  END IF;
END;
