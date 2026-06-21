-- ============================================================
-- Migration: 003_add_campaign_name_to_recipient_logs
-- Target:    SAP HANA Cloud
-- Run via:   SAP HANA Database Explorer SQL Console
-- ============================================================

DO BEGIN
  DECLARE col_exists INT;

  SELECT COUNT(*) INTO col_exists
    FROM SYS.TABLE_COLUMNS
   WHERE SCHEMA_NAME = CURRENT_SCHEMA
     AND TABLE_NAME  = 'RECIPIENT_LOGS'
     AND COLUMN_NAME = 'CAMPAIGN_NAME';

  IF :col_exists = 0 THEN
    EXEC 'ALTER TABLE RECIPIENT_LOGS ADD ("CAMPAIGN_NAME" NVARCHAR(200))';
  END IF;
END;
