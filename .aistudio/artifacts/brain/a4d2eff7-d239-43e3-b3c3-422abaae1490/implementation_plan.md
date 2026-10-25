# Implementation Plan — SevaTrack AI (NGO Contribution & Expense Coordinator)

## Architecture Overview
- **Backend (`server.ts`)**: Express server with Vite middleware in development. Uses a robust file-backed or SQLite/JSON persistence layer supporting organization tenant isolation, audit logging, file uploads (with MIME validation & random storage names), receipt OCR extraction via `@google/genai` (`gemini-3.8-flash`), and GenAI follow-up task generation with schema validation.
- **Frontend (`src/`):** React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons + Motion animations. Styled following the SaaS dashboard design constitution (clean neutrals, tabular numerals, accessible contrast, zero pill badges, 60-30-10 color harmony).
- **Core Modules:**
  1. **Event Workspace:** Manage events, budgets, statuses, and associate records.
  2. **Contribution Management:** Track monetary vs in-kind contributions, partial payments, promised vs received amounts, audit trail, duplicate prevention.
  3. **Expense & Receipt Management:** Manual expense entry, secure receipt uploads, OCR extraction of merchant/date/amount/currency with human verification step, review statuses (pending, verified, rejected), duplicate/missing receipt flagging.
  4. **GenAI Follow-up Assistant:** Generate reviewable follow-up tasks from event notes and financial records using `@google/genai`, requiring manual user confirmation before creation.
  5. **Financial Dashboard & Reports:** Deterministic metrics (promised vs received cash, outstanding commitments, verified vs pending expenses, budget utilization, separate non-kind totals).

## Detailed Steps
1. **Backend Infrastructure (`server.ts` & storage):**
   - Setup data storage schemas for Organizations, Events, Contributions, Expenses, Receipts, Tasks, and Audit Logs.
   - Implement authentication/tenant middleware (simulated org context with multi-org switcher).
   - Implement receipt upload middleware (`multer` or custom multipart parser with MIME validation, size limits, randomized filenames).
   - Implement Gemini OCR endpoint (`/api/receipts/ocr`) using `@google/genai` (`gemini-3.8-flash`).
   - Implement GenAI Follow-up Task Generator endpoint (`/api/ai/tasks`) using `@google/genai` with structured JSON output schema.
   - Implement CRUD endpoints for Events, Contributions, Expenses, Receipts, Tasks, and Audit Logs with server-side validation and audit trail recording.

2. **Frontend Components (`src/`):**
   - **Navigation & Layout:** Top bar contract (brand wordmark, clean nav links, primary action) + organization switcher.
   - **Dashboard View:** Key metrics cards (promised vs received, cash outstanding, verified expenses, budget utilization) with tabular numerals and clean charts/breakdowns.
   - **Event Workspace View:** Event switcher, event details, budget tracking.
   - **Contributions View:** Contribution table, partial payment dialog, in-kind vs monetary breakdown, audit trail drawer.
   - **Expenses & Receipts View:** Expense list, receipt upload dropzone, OCR review modal (comparing extracted vs verified fields), status badges (verified, pending, rejected).
   - **GenAI Follow-up Assistant View:** Note input, AI task generation, review and approve/edit workflow before task creation.
   - **Audit Logs & Reports View:** Complete immutable audit trail of financial changes.

3. **Verification & Testing:**
   - Run type checking (`npm run lint`).
   - Verify build (`npm run build`).
