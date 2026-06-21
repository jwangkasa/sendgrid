/**
 * lib/types.ts
 *
 * Canonical TypeScript interfaces shared across server routes, hooks, and
 * UI components. A single source of truth avoids type drift between layers.
 */

// ─── Database row shape ───────────────────────────────────────────────────────

export interface RecipientLog {
  ID: string;
  FIRST_NAME: string | null;
  LAST_NAME: string | null;
  CATEGORY: string | null;
  COMPANY: string | null;
  EMAIL_ADDRESS: string;
  PHONE_NUMBER: string | null;
  COMMENTS: string | null;
  BATCH_ID: string;
  CAMPAIGN_NAME: string | null;
  SG_MESSAGE_ID: string | null;
  DELIVERY_STATUS: DeliveryStatus;
  OPEN_COUNT: number;
  CLICK_COUNT: number;
  FAILURE_REASON: string | null;
  CREATED_AT: string;
  UPDATED_AT: string;
}

// Exhaustive union mirrors the HANA column constraint comment in the DDL
export type DeliveryStatus =
  | 'Pending'
  | 'Queued'
  | 'Processed'
  | 'Delivered'
  | 'Opened'
  | 'Clicked'
  | 'Bounced'
  | 'Dropped'
  | 'Failed';

// ─── Campaign wizard state ────────────────────────────────────────────────────

/** One parsed row from the uploaded .xlsx file */
export interface RecipientRow {
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL_ADDRESS: string;
  CATEGORY: string;
  COMPANY: string;
  PHONE_NUMBER: string;
  COMMENTS: string;
  /** Preserve any extra columns present in the sheet */
  [key: string]: string;
}

export interface EmailTemplate {
  subject:      string;
  htmlBody:     string;
  textBody:     string;
}

export type WizardStep = 'ingestion' | 'compose' | 'preview';

// ─── API request / response contracts ────────────────────────────────────────

export interface DispatchRequestBody {
  campaignName: string;
  recipients:   RecipientRow[];
  template:     EmailTemplate;
  batchId:      string;
}

// ─── Firestore campaign document ──────────────────────────────────────────────

export type CampaignStatus = 'dispatched' | 'partial' | 'failed';
export type CampaignSource = 'excel' | 'vendor';

export interface CampaignDoc {
  batchId:          string;
  name:             string;
  subject:          string;
  htmlBody:         string;
  textBody:         string;
  totalRecipients:  number;
  sendgridAccepted: number;
  createdBy:        string;
  createdAt:        string;   // ISO timestamp
  status:           CampaignStatus;
  source:           CampaignSource;
}

export interface CampaignRecipientDoc {
  email:          string;
  firstName:      string;
  lastName:       string;
  company:        string;
  category:       string;
  deliveryStatus: string;
  openCount:      number;
  clickCount:     number;
  sgMessageId:    string | null;
  failureReason:  string | null;
  updatedAt:      string;   // ISO timestamp
}

export interface DispatchResponseBody {
  batchId: string;
  totalQueued: number;
  sendgridAccepted: number;
  message: string;
}

export interface MetricsResponseBody {
  batchId: string;
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  dropped: number;
  failed: number;
  pending: number;
  deliveryRate: number;   // 0–100
  openRate: number;       // 0–100
  clickRate: number;      // 0–100
  rows: RecipientLog[];
}

// ─── SendGrid webhook payload ─────────────────────────────────────────────────

/** Subset of the SendGrid event object we care about */
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: SendGridEventType;
  sg_message_id?: string;
  reason?: string;
  url?: string;
  custom_args?: {
    batch_id?: string;
    email?: string;
    [key: string]: string | undefined;
  };
}

export type SendGridEventType =
  | 'processed'
  | 'delivered'
  | 'open'
  | 'click'
  | 'bounce'
  | 'dropped'
  | 'deferred'
  | 'spamreport'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'group_resubscribe';
