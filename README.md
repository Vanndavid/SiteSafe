# Ai Compliance 
### AI-Assisted Compliance Monitoring for Construction & Trade Sites

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
- BullMQ + Redis (background jobs)
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

### Phase 4 – The "SaaS" Architecture
- [ ] Authentication (Clerk)
- [ ] Multi-Tenancy (Organization and team members)
- [ ] Payments (Stripe)
**Goal:** Transform it from a "Single-Player Demo" into a "Multi-User Platform" ready for paying customers.

### Phase 5 – The "Final" Polish
- [ ] Landing Page
- [ ] Email/Phone Notifications
- [ ] Cloud Storage
**Goal:** Make it look production-ready

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

# go to http://localhost:5173/

