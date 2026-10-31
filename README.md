# CLAIMBACK — Consumer Protection Utility

CLAIMBACK is a standalone, zero-backend consumer-protection web application built exclusively with **HTML5**, **CSS3**, and **Vanilla JavaScript**. It helps individuals organize product purchases, receipts, return windows, warranty durations, refundable deposits, and pending refund or warranty claims so deadlines are not missed and supporting evidence is ready before contacting a seller.

---

## Project Files

- `claimback.html` — **Purchase Vault**: Record purchases and refundable deposits, calculate return deadlines and warranty end dates (with exact seller-date overrides), distinguish seller-verified policies from user-entered estimates, attach local proof-of-purchase metadata/previews, search/filter/sort records, and export CSVs.
- `deadlines.html` — **Deadline Radar**: View return windows, warranty expirations, refundable deposits, and claim follow-ups sorted by urgency, filter by category and workflow status (`Needs Action`, `In Progress`, `Completed`, `Not Applicable`), set earlier preparation dates, flag missing information, and inspect a chronological Event Timeline.
- `recovery-center.html` — **Recovery Center**: Create refund, return, repair, replacement, or deposit claims linked to Purchase Vault items, track claim statuses (`Draft`, `Submitted`, `Awaiting Response`, `Resolved`, `Rejected`, `Closed`), calculate **Requested**, **Pending**, **Seller-Approved (Unpaid)**, and **Confirmed Recovered (Received)** amounts separately, manage interactive supporting-evidence checklists, generate editable correspondence letters with clipboard copy, log dated activity history, and export CSV/TXT summaries.
- `index.html` — Launchpad entry point that automatically routes to `claimback.html`.
- `prompts.txt` — Contains the master prompt and engineering implementation prompts.

---

## How to Run the Application

### Option 1: Open Directly in Any Modern Browser (No Server or Build Required)
1. Download or locate the project folder on your computer.
2. Double-click **`claimback.html`** (or `deadlines.html` / `recovery-center.html`) to open it directly in Chrome, Firefox, Edge, or Safari.
3. All CSS and JavaScript are embedded directly inside each HTML file—no `npm`, Node.js, backend server, or internet API is required.

> **Browser Note on `localStorage` across `file://` URLs:** Most desktop browsers share `localStorage` across standalone HTML files opened from the same folder. If your browser isolates `file://` origins per file, either open via any static local server (Option 2) or use **Data & Privacy -> Export / Import Full JSON Backup** to move data between files.

### Option 2: Run via Local Static Server
If you want a unified `http://localhost` origin:
```bash
python3 -m http.server 3000
```
Then visit `http://localhost:3000/claimback.html` in your browser.

---

## Shared `localStorage` Keys

All three standalone pages read and write the same versioned keys:
- `claimback_initialized_v1` — Tracks first-run initialization so clearly labeled fictional sample records populate automatically on first launch.
- `claimback_purchases_v1` — Purchase Vault records, policy verification flags, and local proof-of-purchase metadata.
- `claimback_deadline_meta_v1` — Workflow action states (`needs_action`, `in_progress`, `completed`, `not_applicable`), user preparation dates, and preparation notes.
- `claimback_custom_deadlines_v1` — Standalone refund/deposit deadlines created directly in Deadline Radar.
- `claimback_claims_v1` — Recovery Center claims, financial stages, evidence checklists, letter drafts, and dated activity logs.

---

## Consumer Policy, Accounting & Privacy Principles

1. **Seller Terms Govern Eligibility**: Calculated return windows and warranty end dates are planning aids. When a seller specifies an exact calendar cutoff or written policy exclusions, record the exact date and verify the seller's official terms.
2. **Strict Financial Separation**: Requested amounts and seller-approved amounts are **never** labeled as recovered money until you check **"Payment actually received"** and record the received payout amount and date.
3. **Editable Drafts Only**: Generated request letters are customizable personal correspondence drafts, not legal advice or guarantees of seller approval.
4. **Local-Only Privacy**: CLAIMBACK never uploads receipts or records to external services. Browser `localStorage` is unencrypted local storage and is erased if you clear site data—never enter bank logins, card numbers, or passwords, and export JSON backups periodically via **Data & Privacy**.
