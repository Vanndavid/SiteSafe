# Ai Compliance 
### AI-Assisted Compliance Monitoring for Construction & Trade Sites

**Ai Compliance** is a prototype internal compliance tool designed for construction, logistics, and trade businesses to prevent **expired licenses, certifications, and insurance documents** from causing site shutdowns, safety incidents, or regulatory fines.

The system uses **multimodal AI** to extract and validate document data, then continuously monitors expiry status and alerts site managers before issues occur.

This project focuses on **practical system design**, **asynchronous processing**, and **responsible AI usage**, rather than building a generic “AI SaaS”.

---

## Problem Statement

Construction and trade sites rely on time-sensitive documents such as:

- White Cards  
- Forklift / machinery licenses  
- Trade certifications  
- Insurance certificates  

In practice, these documents are:
- Stored as PDFs or photos
- Manually checked
- Easy to miss when expired
- Often discovered only during audits or incidents

The result:
- Site shutdowns
- Compliance breaches
- Fines
- Safety risks

**Ai Compliance automates this workflow** with minimal friction for users.

---

## Core Idea

Instead of manual data entry:

> A site manager uploads a photo of a document.  
> The system extracts structured data, validates it, and tracks compliance automatically.

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

### 2. Compliance Validation
- Checks extracted data against basic rules:
  - Is the document expired?
  - Is the document type recognised?
  - Does the name match the assigned worker?
- Assigns a **confidence score** rather than absolute judgment

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
- Confidence-based validation

### Frontend
- React
- Tailwind CSS
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
- [x] `/analyze` endpoint for image → structured JSON  
**Goal:** Prove reliable extraction from real documents

### Phase 2 – Application Layer
- [x] MongoDB schemas (User, Document)
- [x] File upload handling
- [x] BullMQ worker pipeline  
**Goal:** Reliable storage & processing pipeline

### Phase 3 – Product Layer (MVP)
- [ ] React dashboard
- [ ] Traffic-light compliance status
- [ ] Scheduled expiry checks
- [ ] Email / SMS reminders  
**Goal:** End-to-end usable prototype

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
6. Manager can manually override if required

---

## Limitations (By Design)

This project intentionally does **not**:
- Attempt fraud detection
- Replace compliance officers
- Automate legal decisions

The AI provides **decision support**, not authority.

---

## Getting Started

```bash
# Clone
git clone https://github.com/yourname/sitesafe.git
cd sitesafe

# Install dependencies
npm install

# Environment
cp .env.example .env
# Add:
# GEMINI_API_KEY
# MONGODB_URI
# REDIS_URL

# Run (Docker)
docker-compose up -d


---

If you want next:
- ATS-optimised version  
- recruiter-friendly shortened README  
- interview explanation cheat-sheet  

Just say the word.
