# Traceback: UX Design System & Information Architecture

## 1. Design Direction: "Developer Evidence Workspace"

Traceback's frontend is designed for high-density, technical clarity. It rejects bloated consumer SaaS templates, generic AI gradient cards, and decorative empty states in favor of an **information-dense, high-trust developer workspace** inspired by the technical clarity of Linear and the data density of GitHub.

### Core Visual Principles
1. **Evidence-First Hierarchy:** Primary surfaces prioritize Git commit SHAs, PR numbers, unified diff snippets, and author provenance over decorative illustrations.
2. **Epistemological Distinction:** Machine assessment badges and human verdict controls are rendered in distinct visual registers, ensuring automation never masquerades as human authority.
3. **Restrained Color Palette:** Neutral surfaces (clean whites and cool slates) punctuated by semantic status tokens:
   - **Supported / Invariant:** Emerald green (`#10B981` / `#059669`).
   - **Contradicted / Violation:** Crimson red (`#EF4444` / `#DC2626`).
   - **Insufficient Evidence / Risk:** Warm amber (`#F59E0B` / `#D97706`).
   - **Unverified / Context:** Cool slate (`#64748B` / `#475569`).
   - **Primary Action Accent:** Technical indigo-blue (`#2563EB`).

---

## 2. Theming Architecture

### Non-Negotiable Light Theme Default
Per project operating rules, the **Light Theme is the non-negotiable default** upon first visit, regardless of OS dark mode settings (`prefers-color-scheme`).

- **Light Theme (Default):** Soft neutral canvas (`#F8FAFC`), crisp white panel surfaces (`#FFFFFF`), dark slate typography (`#0F172A`), subtle borders (`#E2E8F0`).
- **Dark Theme (Secondary):** Deep neutral canvas (`#0B1220`), elevated panel surfaces (`#111827` / `#1F2937`), accessible high-contrast text (`#F8FAFC`), dark borders (`#334155`).
- **Persistence:** User theme preference persists in `localStorage` under `traceback_theme` and syncs across tabs via storage event listeners.
- **Unified Tokens:** Both themes utilize the same semantic CSS variable names (`var(--color-surface)`, `var(--color-text)`, `var(--color-border)`), avoiding duplicate component codebases.

---

## 3. Information Architecture & Navigation Shell

### Authenticated Application Shell
For authenticated users, the application provides an integrated header and contextual controls:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [TB] Traceback  Human-Supervised Verification  [Alpha Corp (ws_alpha) ▼]        │
│                                                                                  │
│ Overview | Verify | Historical Intent | Decision Memory | Evidence | History...   │
│                                                                                  │
│                                        [Alex Maintainer ▼]  [☀️/🌙 Theme Toggle]  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Top Bar Header:**
   - **Brand Identity:** Traceback logo mark + subtitle.
   - **Workspace Selector:** Displays active workspace with role badge (`OWNER`, `MEMBER`) and multi-tenant switcher.
   - **Primary Navigation Links:**
     - **Overview (`/`):** Workspace health, indexed repositories, recent activity, and quick launch pads.
     - **Verify (`/verify`):** Flagship claim-to-evidence decomposition and human verdict studio.
     - **Historical Intent (`/intent`):** Prospective diff check against ADRs and engineering decisions.
     - **Decision Memory (`/decisions`):** Human-reviewed architectural invariants with lifecycle management.
     - **Evidence (`/evidence`):** Full-text and scoped search across Git commits, PRs, and issues.
     - **History & Reports (`/history`):** Audit trail of verification sessions and report export (`traceback.report.v1`).
     - **Repositories (`/repositories`):** GitHub App installation, sync trigger, and Connect by URL.
   - **User Menu:** Authenticated user identity, avatar, "Switch Account", "Register New Account", and "Sign Out".
   - **Theme Toggle:** Icon-only button (`aria-label="Toggle visual theme"`).

### Unauthenticated Public Shell
Before authentication, the public shell strictly isolates workspace data:
- Navbar renders only Traceback branding, Sign In, Register, and Theme Toggle.
- Protected routes automatically redirect to `/login?returnTo=<path>`, preserving deep-link destinations safely.
- Zero workspace names, repository records, or commit history are leaked to public visitors.

---

## 4. Studio Layouts & Interaction Patterns

### 1. Verify Studio (`/verify`)
- **Split Workspace:** Left panel accepts AI-generated explanations and optional code snippets; right panel renders extracted claims.
- **Claim Cards:** Each claim displays its epistemological outcome badge (`SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`), confidence score, rationale, and underlying evidence citations.
- **Evidence Inspector Drawer:** Collapsible accordion showing source type (`COMMIT`, `PR`, `ISSUE`), clickable GitHub links, author, date, and unified patch snippet.
- **Human Review Actions:** Reviewers can mark claims as `Supported`, `Contradicted`, or `Unverified`, with notes stored in an immutable audit trail.
- **Decision Memory Bridge:** Clicking `🏛️ Propose Decision Candidate` instantly pushes the verified claim into Engineering Decision Memory.

### 2. Historical Intent Studio (`/intent`)
- **Diff Input Panel:** Accepts unified patches with live character counter (up to 25,000 characters) and file scope filter.
- **Outcome Banner:** Highlights whether changes introduce `DOCUMENTED_CONFLICT`, `POTENTIAL_CONFLICT`, `NO_KNOWN_CONFLICT`, or `INSUFFICIENT_CONTEXT`.
- **Conflict Detail Cards:** Displays the affected invariant, why historical evidence establishes a conflict, and recommended review actions.
- **Human Disposition Bar:** Reviewers can record `Approved`, `Rejected`, or `Needs Discussion` with review notes.
- **Sessions Drawer:** Quick access to the 25 most recent intent check sessions for the repository.

### 3. Engineering Decision Memory Studio (`/decisions`)
- **Lifecycle Filter Bar:** Tabs for `ALL`, `ACCEPTED`, `CANDIDATE`, `IN_REVIEW`, `SUPERSEDED`, and `DISPUTED`.
- **Decision Card Elements:**
  - Status badge and severity rating (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `ADVISORY`).
  - Target file path and symbol boundaries.
  - Concrete decision invariant and historical rationale.
  - Linked Git evidence citations and reviewer provenance.
- **Lifecycle Actions:** Buttons for `✓ Accept Invariant`, `✗ Reject Candidate`, and `⚠️ Dispute Decision`.
- **Propose Modal:** Form for proposing new candidate constraints with field validation.

---

## 5. Accessibility & Performance Checklist

- **Keyboard Navigation:** All interactive buttons, links, inputs, and modals support standard tab sequencing with high-contrast visible focus outlines (`--color-focus`).
- **Screen Reader Support:** Semantic HTML tags (`<header>`, `<main>`, `<nav>`, `<section>`, `role="alert"`, `role="status"`), descriptive `aria-label` attributes on icon-only buttons.
- **Skip Links:** Dedicated `.skip-to-content` link allows keyboard users to bypass navigation directly to `#main-content`.
- **Reduced Motion:** Interactive transitions utilize subtle durations (`0.15s ease`) and respect system motion preferences.
- **Zero Live Mock Data:** All screens render authentic data retrieved from live backend endpoints.
