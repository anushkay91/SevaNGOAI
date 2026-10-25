# Implementation Plan — SevaTrack AI Remediation & Audit

This plan outlines the remediation strategy for SevaTrack AI to address security, financial integrity (using Indian Rupees ₹ INR), architecture, efficiency, testing, and accessibility according to the 8-phase audit requirements.

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Currency**: All financial records, budgets, contributions, and expenses will be tracked and displayed in Indian Rupees (₹ INR).
> - **Authentication & Authorization**: Server-side session token authentication with role-based organization membership, ensuring tenant isolation and secure receipt access.
> - **Persistence**: File-based JSON storage with robust transactional audit logging and concurrency locking.

---

## 1. Overview & Core Concept

- **What It Does**: Centralizes event workspaces, contribution tracking (promised vs. received, monetary vs. in-kind), expense management, receipt OCR extraction via Gemini, AI follow-up task generation, and financial dashboards for NGOs.
- **Target Audience / Persona**: NGO administrators, financial officers, and event coordinators in India managing fundraising and project expenditures.
- **Key Value**: Guaranteed financial integrity (INR), secure tenant isolation, human-verified receipt OCR, and actionable AI follow-up tasks.

---

## 2. User Experience & Visual Design

- **Key User Flows**: 
  1. Secure authentication and organization selection.
  2. Event creation and workspace management.
  3. Recording contributions (monetary pledges, partial payments, in-kind donations) in ₹ INR.
  4. Manual expense entry and AI receipt OCR upload with side-by-side verification.
  5. Generating and approving AI follow-up tasks.
  6. Viewing verified financial totals and immutable audit trail.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean professional SaaS dashboard (neutral slate `#0F172A`, cool gray `#1E293B`, crisp white surface, indigo primary accent `#4F46E5`).
  - *Typography*: Clean sans-serif UI font paired with monospace tabular numerals (`font-mono tabular-nums`) for all monetary values and tables.
  - *Accessibility*: WCAG 2.2 AA contrast, keyboard navigation, visible focus rings, and semantic labels.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Currency Standardization (INR ₹)**
  - *Chosen Approach*: Enforce ₹ INR across all monetary inputs, calculations, and displays.
  - *Why*: Direct alignment with Indian NGO operational needs.
- **Decision 2: Server-Side Authorization & Token Auth**
  - *Chosen Approach*: Replace insecure client-supplied headers (`x-org-id`) with server-side session token validation and robust organization tenancy checks.
  - *Why*: Eliminates Insecure Direct Object Reference (IDOR) and cross-tenant data leaks.
- **Decision 3: Human-in-the-Loop Receipt Verification**
  - *Chosen Approach*: AI OCR (`gemini-3.8-flash`) extracts candidate receipt data into an editable review modal before committing to the database.
  - *Why*: Ensures 100% financial accuracy and prevents unverified OCR hallucinations.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      Client Browser                    │
│   (React 19 SPA, Tailwind CSS, Accessible UI, INR)     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / JSON / Multipart
                           ▼
┌────────────────────────────────────────────────────────┐
│               Express Server (`server.ts`)             │
│   - Session Auth & Tenant Middleware                   │
│   - File Upload & MIME / Signature Validation          │
│   - Gemini AI Service (`gemini-3.8-flash` OCR & Tasks) │
└──────────────────────────┬─────────────────────────────┘
                           │ Secure CRUD & Transactions
                           ▼
┌────────────────────────────────────────────────────────┐
│               Persistent Storage & Audit Log           │
│   - Encapsulated JSON Store (`data.json`)              │
│   - Immutable Audit Trail & Role-based Access Control  │
└────────────────────────────────────────────────────────┘
```

- **Data Models**: Organizations, Users/Sessions, Events, Contributions (Monetary / In-Kind), Expenses (Receipts, OCR, Status), Tasks (Manual / AI Generated), Audit Logs.
- **Security Controls**: File upload size limits (10MB), MIME signature checks, secure random filenames, rate limiting on AI endpoints, safe error handling without internal stack traces.
