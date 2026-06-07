# Ai Compliance 
### AI-Assisted Compliance

**Ai Compliance** is a prototype internal compliance tool designed for organisations that manage time-sensitive documents such as licenses, certifications, permits, or insurance policies.

The system automatically extracts expiry dates from uploaded documents, monitors them continuously, and reminds users before deadlines (e.g. 30 days before expiry) to reduce compliance risk and operational disruption.

---

## Problem Statement

Many organisations rely on documents that have strict expiry or renewal deadlines:

- Licenses and permits 
- Certifications
- Insurances 

In practice, these documents are:
- Stored as PDFs or photos
- Manually checked
- Easy to miss when expired
- Often discovered only during audits or incidents

The result:
- Missed deadlines
- Compliance breaches
- Fines
- Legal risks

**Ai Compliance automates this workflow** by extracting key dates directly from documents and monitoring them automatically.

---

## Core Idea

Instead of manual data entry:

> A user uploads a document.
The system extracts structured data, tracks the expiry date, and reminds them before it becomes a problem.

The system is designed as an **internal operations tool**, not a public marketplace.

---

## Key Features

### 1. AI-Based Document Extraction
- Accepts photos or scans of documents
- Uses multimodal AI to extract:
  - Expiry date
  - License / certificate number
  - Holder name
- Handles varied layouts and low-quality images

### 2. Deadline & Compliance Tracking
- Stores extracted expiry dates in structured form
- Automatically calculates:
  - Expired
  - Expiring soon (e.g. within 30 days)
  - Valid

### 3. Asynchronous Processing
- Document analysis runs in background workers
- Uploads return immediately
- Prevents UI blocking and API timeouts
- Scales independently of user traffic

### 4. Compliance Monitoring & Alerts
- Scheduled jobs scan documents daily
- Flags upcoming expiries
- Sends automated reminders via email/SMS

### 6. Compliance Overview API
- New endpoint: `GET /api/documents/overview`
- Returns compliance-ready totals (`expired`, `expiringSoon`, `valid`, `missingExpiry`, etc.)
- Supports configurable expiry windows via `expiringWithinDays` query param
- Includes nearest expiring documents for dashboards and audit workflows

### 5. Human Override (Important)
- AI decisions can be manually overridden
- Final compliance responsibility remains with humans
- Demonstrates responsible AI usage in production systems

---

## System Architecture

High-level flow:

User uploads document
→ API stores file
→ Job queued (Redis / BullMQ)
→ AI worker analyzes document
→ Structured metadata saved
→ Compliance status updated
→ UI reflects status
→ Scheduler sends reminders

### Why this architecture?
- AI calls are slow and unreliable → async processing
- External APIs (AI, SMS) → isolation & retries
- Compliance logic must be auditable → structured storage

---

## Tech Stack

### Backend
- Node.js + TypeScript
- Express
- BullMQ + Redis (background jobs) X AWS SQS + Lambda
- MongoDB (flexible document schemas)

### AI
- Google Gemini (Multimodal Vision + Reasoning)
- Structured JSON extraction

### Frontend
- React
- Material UI
- Simple dashboard with traffic-light status indicators

### Infrastructure
- Docker
- Environment-based configuration
- Local or cloud-ready

---

## Why These Choices?

### Why AI instead of OCR?
Traditional OCR fails on:
- Handwritten expiry dates
- Inconsistent layouts
- Jurisdiction-specific logic

Multimodal AI allows **extraction + reasoning**, not just text recognition.

---

### Why MongoDB?
Different document types (licenses, insurance, certifications) have:
- Different required fields
- Different validation rules

A flexible schema simplifies iteration while still allowing indexing on:
- Expiry dates
- Document type
- User ID

---

### Why Background Jobs?
AI analysis can take seconds and fail intermittently.

Using queues allows:
- Retry logic
- Failure isolation
- Non-blocking APIs
- Horizontal scaling of workers

---

## Trade-offs

Design decisions here are deliberate compromises between speed-to-value for a prototype and long-run operational rigidity.

### AI extraction vs OCR or manual rules
**Gains:** Handles messy scans, handwritten fields, and layout variety that brittle parsers miss.  
**Costs:** Higher per-document cost and latency than pure OCR, nondeterministic edge cases, and a need for human override and monitoring. Regulatory liability still sits with humans, not the model.

### Document database (MongoDB) vs relational SQL
**Gains:** Heterogeneous document types can evolve without migration churn; easy to attach semi-structured AI output.  
**Costs:** Fewer enforced cross-entity constraints at the DB layer; complex reporting and strict audit schemas may eventually push toward clearer boundaries or complementary stores.

### Asynchronous workers vs synchronous API responses
**Gains:** APIs stay fast and tolerant of slow or flaky AI and messaging providers; workers can retry and scale out.  
**Costs:** Stronger reliance on queues, observability, and idempotent jobs—users see eventual consistency until processing finishes.

### Cloud queue & object storage vs Redis and local disks
**Gains:** Durable uploads, managed scaling, and a path to production-aligned deployments.  
**Costs:** More moving pieces, credentials, and local-dev setup than an all-on-one-machine stack; tighter coupling to a cloud provider unless abstractions stay thin.

### Prototype breadth vs enterprise controls
**Gains:** The core workflow (upload → extract → track → remind) ships first with hosted auth and billing scaffolding.  
**Costs:** Subscription state syncing, granular entitlements, org-wide tenancy, and full notification hardening remain follow-on work—not hidden, but consciously deferred.

---

## Development Roadmap

### Phase 1 – AI Core
- [x] Node.js + TypeScript setup
- [x] Gemini API integration
**Goal:** Prove reliable extraction from real documents

### Phase 2 – Application Layer
- [x] MongoDB schemas (User, Document)
- [x] File upload handling
- [x] BullMQ worker pipeline  
**Goal:** Reliable storage & processing pipeline

### Phase 3 – Product Layer (MVP)
- [x] React dashboard
- [x] Scheduled expiry checks
- [x] Notification  
**Goal:** End-to-end usable prototype

### Phase 4 – Cloud
- [x] S3 (replace local storage)
- [x] SQS (replace queue and redis)
- [x] Lambda (replace worker) 
**Goal:** Utilzing cloud services

### Phase 5 – The "SaaS" Architecture
- [x] Test Case
- [x] Authentication (JWT)
- [ ] WebSocket
- [ ] Multi-Tenancy (Organization and team members)
- [x] Payments (Stripe Checkout)
**Goal:** Transform it from a "Single-Player Demo" into a "Multi-User Platform" ready for paying customers.

Payments now use a hosted Stripe Checkout flow:

- Signed-in users can start a subscription checkout session from the dashboard
- The backend creates the Stripe Checkout session with the authenticated user attached as metadata
- Billing URLs are environment-driven so local, staging, and production environments can each return to the correct frontend

What is still intentionally left for the next SaaS step:

- Stripe webhooks to persist subscription state in MongoDB
- Entitlement checks that gate features by plan
- Organization-level billing once multi-tenancy is complete

### Phase 6 – The "Final" Polish
- [x] Landing Page
- [ ] Email/Phone Notifications
**Goal:** Make it look production-ready

---

## Authentication API (JWT)

The backend uses email/password auth with short-lived access tokens and httpOnly refresh cookies. Refresh token IDs are tracked in memory (sessions reset on server restart).

### Environment variables

```env
JWT_SECRET=replace_with_a_long_random_jwt_secret
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=7d
```

### Endpoints

| Endpoint | Auth | Request | Response |
|----------|------|---------|----------|
| `POST /api/auth/register` | Public | `{ name?, email, password }` | `{ accessToken, user }` + refresh cookie |
| `POST /api/auth/login` | Public | `{ email, password }` | `{ accessToken, user }` + refresh cookie |
| `POST /api/auth/refresh` | Cookie | Send `Cookie: refreshToken=...` | `{ accessToken, user }` + rotated refresh cookie |
| `POST /api/auth/logout` | Cookie | Optional refresh cookie | `{ message }` |
| `GET /api/auth/me` | Bearer | `Authorization: Bearer <accessToken>` | `{ user }` |

All other protected API routes require `Authorization: Bearer <accessToken>`.

### Frontend integration

The React app uses in-memory JWT auth via `AuthProvider`:

- Sign in / register from the header dialog
- `TRY DEMO` logs in or registers `demo@mail.com`
- Access tokens stay in memory; refresh uses an httpOnly cookie
- On `401`, the API client refreshes the session and retries

---

## Example Use Case

1. Site manager uploads a photo of a White Card
2. System processes it asynchronously
3. Expiry date is extracted and validated
4. Status appears as:
   - 🟢 Valid
   - 🟡 Expiring soon
   - 🔴 Expired
5. Reminder is automatically scheduled

---

## Limitations (By Design)

This project intentionally does **not**:
- Attempt fraud detection
- Replace compliance officers
- Automate legal decisions

The AI provides **decision support**, not authority.

---

## Future Improvements (Out of Scope for This Prototype)

The current system intentionally focuses on the core compliance workflow.
The following improvements were consciously left out to maintain scope and clarity:

Authentication & Access Control

- User authentication and role-based access (e.g. admin vs viewer)
- Organisation-level document ownership
- Audit logs for document changes and overrides

Cloud & Infrastructure
- Object storage for uploads (e.g. S3-compatible storage)
- Horizontal scaling of workers
- Managed Redis / MongoDB services

Reliability & Observability
- Job metrics and dashboards
- Dead-letter queues for failed jobs
- Structured logging and tracing

Integrations
- Calendar integrations (Google / Outlook)
- Webhooks for external systems
- Compliance export reports

---

## Getting Started

```bash
# Clone
git clone https://github.com/Vanndavid/AiCompliance.git
cd AiCompliance
docker-compose up -d --build

# At this point, the application has evolved to using AWS services, so to setup local development
# 1. Uncomment redis, mongodb, worker, in docker-compose.yml to use them
# 2. You need to point the API to use local drivers instead of AWS SDKs in api.ts
#    // src/routes/api.ts
#    // import { upload } from "../middleware/uploadMiddleware"; // AWS S3 ☁️
#    import { upload } from "../middleware/uploadLocal";         // Local Disk 💻
# 3. Queue Driver (src/controllers/documentController.ts) Switch the job producer from SQS to BullMQ:
#    // src/controllers/documentController.ts
#    // import { addDocumentJob } from "../queues/sqsProducer";   // AWS SQS ☁️
#    import { addDocumentJob } from "../queues/documentQueue";  // Redis BullMQ 💻

# go to http://localhost:5173/

# Testing Backend
docker exec -it aicompliance_backend npm test
