# CLAIMBACK — Dynamic Consumer Protection & Recovery Utility

CLAIMBACK helps individuals organize product purchases, receipts, return windows, warranty durations, refundable deposits, and pending refund or warranty claims across **INR (₹ — Indian Rupee)**, **USD ($)**, **EUR (€)**, **GBP (£)**, **AED**, **SGD**, **CAD**, and **AUD** so deadlines are not missed and supporting evidence is ready before contacting a seller.

---

## Application Editions Included

1. **Dynamic Single-Page Web Application (`/`)**:
   - Interactive **Overview Command** with a Live Coverage Simulator, Smart Receipt Quick-Parser (`₹`, `Rs.`, `INR`, `$`, `€`, `£`), and Recovery Accounting Pipeline.
   - **Purchase Vault** with animated Card & Ledger switchers, per-record currency entry, and live return/warranty progress bars.
   - **Deadline Radar** with Priority Queue, Interactive Monthly Calendar Grid, and Chronological Event Timeline.
   - **Recovery Center** with Split Claim Studio, Kanban Pipeline Board, customizable correspondence letters, evidence checklists, and strict financial separation.
   - **Dynamic Preferences**: Instant multi-currency switcher (`INR ₹` with `en-IN` lakh/crore formatting + global currencies), Dynamic Typography scaling (`A- / A / A+`), Light/Dark dual-theme toggle, and `localStorage` + `/api/workspace` persistence.
2. **Standalone Zero-Build HTML Pages** (also available directly):
   - `claimback.html` — Standalone **Purchase Vault**
   - `deadlines.html` — Standalone **Deadline Radar**
   - `recovery-center.html` — Standalone **Recovery Center**
   - `prompts.txt` — Master prompt and implementation prompts.

---

## Deploying to Vercel (Zero Config)

This repository is pre-configured for **Vercel** via `vercel.json` and serverless functions in `/api/health.ts` and `/api/workspace.ts` (zero paid APIs or environment secrets required).

### Method 1: GitHub + Vercel Dashboard (Recommended)
1. Push or export this project to a GitHub repository.
2. Open [vercel.com/new](https://vercel.com/new) and import your repository.
3. Vercel automatically reads `vercel.json` (`buildCommand`: `npm run build:vercel`, `outputDirectory`: `dist`, SPA rewrites for `/vault`, `/deadlines`, `/recovery`, plus standalone `/claimback.html`, `/deadlines.html`, `/recovery-center.html`).
4. Click **Deploy**.

### Method 2: Vercel CLI (1 Command)
```bash
npm install && npx vercel --prod
```

---

## Running Locally

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
