# Changelog — Bulk Email Engine

All notable changes to this project, in reverse chronological order.

---

## 2026-07-12

### feat: consistent AppNav header across all pages (`aea6c32`)
- Extracted shared `app/components/AppNav.tsx` component
- Logo + "Bulk Email Engine" brand on the left
- 5 nav items with icons: Vendor Campaign, New Campaign, Dashboard, Template Builder, Sequences
- Active page highlighted with blue pill border
- `rightSlot` prop for page-specific actions (Dashboard AI Follow-Up / Refresh, Sequences New Sequence button)
- User email + Sign Out on the right
- Applied uniformly to: Vendors, Campaign, Dashboard, Sequences list, Sequence editor
- Sequences pages now include `firebaseSignOut` support

### feat: redesign table cell context menu + add nav icons (`df59592`)
- Table context menu rebuilt to match reference design
  - BORDER: style dropdown, width slider, color swatch with "This cell / All cells" scope toggle
  - CELL BACKGROUND: 25-colour swatch grid + custom colour swatch with scope toggle
  - TEXT COLOR: 25-colour swatch grid + custom swatch (cell scope only)
  - CELL ALIGNMENT: single row of 6 buttons — 3 horizontal (left/centre/right) + 3 vertical (↑ ↕ ↓)
  - ROWS & COLUMNS: Insert row above/below, insert column left/right, delete row/column/table
- Nav header icons added across Campaign, Dashboard, and Vendors pages
  - `BuildingIcon` → Vendor Campaign
  - `MailPlusIcon` → New Campaign
  - `LayoutDashboardIcon` → Dashboard
  - `PaintbrushIcon` → Template Builder
  - `GitBranchIcon` → Sequences

### fix: target HATCH schema in migrations 004 and 005 (`f4fb53f`)
- Hardcoded `SCHEMA_NAME = 'HATCH'` in all `SYS.TABLES` / `SYS.INDEXES` guard queries
- All `CREATE TABLE` / `CREATE INDEX` statements use fully-qualified `"HATCH"."TABLE_NAME"` form
- Changed to `CREATE COLUMN TABLE` (appropriate for SAP HANA Cloud analytics workloads)
- Each index creation wrapped in its own `DO BEGIN` guard — safe to re-run (idempotent)
- Matches `DO BEGIN` guard pattern and style of existing migrations 001–003

### feat: full cell editor context menu for table element (`6e7d38c`)
- Right-click any table cell to open rich cell-editor panel
- Border style, width, colour — scoped to this cell or all cells
- Cell background colour with swatch palette + custom picker
- Text colour with swatch palette + custom picker
- 3×3 cell alignment grid + top/middle/bottom vertical quick buttons
- Insert row above/below, insert column left/right, delete row, delete column, delete table
- Per-cell styles stored in `cellStyles[][]: CellStyle` on `TableElement`
- Per-cell styles emitted correctly in HTML export (`htmlExporter.ts`)
- `BorderStyle` and `CellStyle` types added to `lib/types` (`types.ts`)

### feat: email sequence automation with visual drag-and-drop flow canvas (`7cc737a`)
- Full drip/automation sequence system with node-graph canvas (ActiveCampaign-style)
- **Database migrations**
  - `migrations/004_create_sequences.sql` — `SEQUENCES` table (ID, NAME, OWNER_UID, FLOW_JSON, STATUS)
  - `migrations/005_create_sequence_enrollments.sql` — `SEQUENCE_ENROLLMENTS` table with 3 indexes
- **Type definitions** added to `lib/types.ts`
  - `SequenceNodeType`, `SequenceStatus`, `EnrollmentStatus`, `SequenceNodeData`
  - `SequenceNode`, `SequenceEdge`, `SequenceFlow`, `Sequence`, `SequenceEnrollment`, `SequenceRunResult`
- **API routes**
  - `GET/POST /api/sequences` — list and create sequences
  - `GET/PUT/DELETE /api/sequences/[id]` — get, update, delete single sequence
  - `POST /api/sequences/[id]/enroll` — enroll recipients into sequence
  - `POST /api/sequences/[id]/run` — trigger run engine
  - `GET /api/sequences/[id]/status` — per-node enrollment counts
- **Run engine** (`lib/sequenceEngine.ts`)
  - Loads due enrollments (`NEXT_RUN_AT <= NOW()`)
  - Walks DAG node by node: `start` → advance; `wait` → set `NEXT_RUN_AT`; `condition` → query `RECIPIENT_LOGS` and branch yes/no; `email` → call `sendPersonalizedBatch()`; `end` → mark completed
- **Canvas UI** (`@xyflow/react`)
  - `app/sequences/page.tsx` — sequence list with status badges
  - `app/sequences/[id]/page.tsx` — canvas editor with Save / Run Now / Enroll buttons
  - `FlowCanvas.tsx` — React Flow wrapper with drag-and-drop, edge connectors
  - `NodePalette.tsx` — draggable node type sidebar
  - `NodeConfigPanel.tsx` — right-side config panel per node type
  - Node components: `StartNode`, `EmailNode`, `WaitNode`, `ConditionNode`
- **Email node** supports three content methods:
  - Open existing Template Builder (modal overlay)
  - Upload JSON (via `parseAndConvertJson` + `exportBodyHtml`)
  - AI generation via existing SAP AI Core `/api/campaign/generate-template`
- "Sequences" nav link added to Campaign and Dashboard pages

---

## 2026-07-12 — Template Builder session

### remove: delete Preview button from campaign compose step (`6e7414e`)
- Removed preview button added to campaign compose step (Step 2 HTML body editor)

### feat: add Preview button to campaign compose step HTML body editor (`091a8b1`)
- (Subsequently removed — see above)

### fix: relabel Copy HTML button to clarify it is for marketing platform editors (`cc42ff7`)
- Button label changed from "HTML" to "Copy HTML source"
- Tooltip now reads: *"Copy HTML source — paste into marketing platform editors (Mailchimp, HubSpot, SendGrid), not into email clients"*

### feat: add Send Test Email button to TemplateBuilder toolbar (`49641e7`)
- "Send Test Email" button in toolbar opens a modal to enter recipient address
- Posts to new `POST /api/campaign/send-test` endpoint
- Uses `sendPersonalizedBatch()` to deliver rendered HTML to a real inbox via SendGrid

### feat: add 'Preview in browser' button to open rendered email in new tab (`9aba430`)
- Creates a Blob URL from exported HTML body and opens it in a new tab
- Blob URL is auto-revoked after 60 seconds
- Workaround for Outlook/Gmail security restriction that prevents pasting raw HTML

### fix: use exportBodyHtml for Copy HTML to avoid raw DOCTYPE in email clients (`321106e`)
- `handleCopyHtml` in `Toolbar.tsx` now calls `exportBodyHtml()` instead of `exportHtml()`
- Avoids copying `<!DOCTYPE html>` / `<head>` / `<body>` wrappers into clipboard

### fix: clean up mangled imports and stray HTML in htmlExporter (`67fc338`)
- Fixed merged/duplicate import lines in `TemplateBuilder/index.tsx`
- Removed stray `</html>\`;` appended after `exportBodyHtml` in `htmlExporter.ts`

### feat: right-click context menu for Button/Link element (`bf39566`)
- Right-click a button element to edit: Label, URL, background colour, text colour, font size, border radius

### feat: add sapphire blue header to TemplateBuilder (`895b604`)
- Gradient header bar with title and subtitle in the Template Builder modal

### feat: table right-click menu, responsive toolbar, AI bar moved below toolbar (`a514be2`)
- Early table right-click menu (structure / borders / cells / header shading)
- Toolbar made responsive; AI generation bar moved below main toolbar

### feat: show recipient column headers as insertable field tokens in TemplateBuilder (`3e48594`)
- Column headers from uploaded recipient file shown as clickable tokens
- Clicking a token inserts `{{COLUMN_NAME}}` merge tag into selected text element

### feat: import and convert legacy JSON schema in TemplateBuilder (`4aa9517`)
- Upload button accepts saved template JSON
- `parseAndConvertJson()` converts legacy schema to current `TemplateState`

### feat: add AI content generation bar to TemplateBuilder (`1f2c5ef`)
- "✦ Write with AI" bar calls `/api/campaign/generate-template` (SAP AI Core)
- Assembles sections into full HTML body on response

### feat: add Template Builder to top nav on all pages (`d1d6a4b`)
- Template Builder button with `PaintbrushIcon` added to nav on Campaign, Dashboard, Vendors pages

### feat: canvas presets, grid/snap, tracking scripts, z-order, lock, preview, background image (`a7e5bfb`)
- Canvas presets (width options: 500 / 600 / 700 px)
- Grid overlay + snap-to-grid
- Tracking script manager (GA4, GTM, Meta Pixel, custom)
- Z-order controls (bring to front / send to back)
- Element lock toggle
- Preview mode (read-only render)
- Background image upload

### fix: resolve stale closure crash in TemplateBuilder (`7066551`)
- Used refs for undo/redo history to fix stale closure bug

### feat: add visual email template builder to campaign composer (`cbead92`)
- Initial Template Builder — drag-and-drop canvas with Text, Image, Button, Divider, Table, Spacer elements
- Undo/redo, resize handles, element toolbar
- HTML export (`exportHtml`, `exportBodyHtml`)

---

## 2026-06-23

### feat: add collapsible AI instructions editor to Follow-Up panel (`f9986d4`)
- Collapsible panel in AI Follow-Up to edit the system prompt / instructions

### fix: switch to SAP AI Core orchestration API (`ed094b7`)
- Deployment ID `da10475442205aca` used for AI Core orchestration endpoint

### fix: correct SAP AI Core inference URL (`0519d76`, `2235c01`, `8c6105b`)
- Series of fixes to resolve 404 on AI Core — correct path is `/v2/inference/deployments`
- Added debug logging for `chatUrl` and `deploymentId`

### fix: bypass SAP SDK connectivity layer for AI Core (`c05777a`)
- Call AI Core REST API directly via `fetch` instead of SAP SDK to resolve silent failures

### fix: improve AI Core error logging (`032e340`)
- Expose full cause chain and credential shape in error logs

### fix: CORS hardening — assertSameOrigin (`beb62ca`)
- Compare origin host against request `Host` header

### fix: wire SAP AI Core credentials from individual env vars (`679560a`)
- Read `AICORE_*` env vars individually instead of relying on VCAP_SERVICES

### feat: AI Follow-Up panel powered by SAP AI Core (`e3fdd25`)
- Right-side panel on Dashboard generates follow-up email drafts using SAP AI Core
- Analyses campaign engagement segments (engaged / unresponsive / failed)
- Returns subject + body per segment

### fix: campaign filter — click row selects only that campaign (`c3bd35c`)
- Clicking a campaign row selects only that one; checkbox still supports multi-select

### fix: switch Google sign-in to popup + add Excel export to dashboard (`8611c93`)

---

## 2026-06-22

### feat: add favicon from HatchEvent logo (`2a9b3f2`)

### feat: add reply-to header and document sender/reply-to env vars (`67e21e4`)

### fix: only require EMAIL_ADDRESS column — FIRST_NAME / LAST_NAME now optional (`f95fc9d`)

### fix: include campaignName in handleDispatch dependency array (`fb63079`)

### fix: make vendor search server-side across all pages (`ec8a463`)

### feat: per-campaign sender selection + fix test send campaignName (`30662eb`)

### feat: dashboard — show unselect all button on campaign chips (`2ad015c`)

### feat: add new vendor form — POST to HANA with duplicate email check (`82248e3`)

### feat: add Google Analytics (G-DHNLD638YR) (`9aa1306`)

### chore: remove debug logging, keep only error logs (`7e4229e`)

### fix: read batch_id from top-level event field, not custom_args (`e09ab07`)

### fix: snake_case all SendGrid API fields, add send/error logging (`bf4c408`)

### fix: bypass SendGrid SDK — use raw fetch to preserve custom_args in payload (`fb4d1e2`)
- SendGrid Node SDK was silently stripping `custom_args` from the outgoing payload

---

## 2026-06-21

### fix: move custom_args to message level for webhook batch_id propagation (`2658cad`)

### fix: add processEvent diagnostics to webhook handler (`bbd53a5`)

### feat: dashboard batch multi-select + webhook diagnostics logging (`0af5b8b`)

### feat: dashboard batch multi-select — filter by campaign, aggregate metrics (`d7f00df`)

### fix: remove incorrect top-level 'to' field so emails deliver to actual recipients (`90bf852`)

### feat: add email/password sign-in to login page (`fdb869b`)

### fix: switch Firebase auth to redirect to resolve COOP warning on Vercel (`de860d1`)

### fix: various build errors — ECDSA typo, hdb types, sendgrid content cast, dashboard Suspense (`d88d0fb`)

### chore: remove standalone output for Vercel deployment (`392797d`)

### fix: resolve hdb type error and SendGrid content array type (`774519c`)

### feat: Initial commit — Bulk Email Engine (`2a774b5`)
- Next.js 15 / React 19 app on Vercel
- SAP HANA Cloud database via `hdb` driver
- SendGrid bulk email dispatch with custom_args tracking
- Firebase Authentication (Google + email/password)
- Campaign wizard: upload XLSX → compose → preview → dispatch
- Webhook handler for delivery/open/click/bounce events
- Real-time dashboard with KPI cards and recipient table
- Vendor management page with server-side search and pagination
