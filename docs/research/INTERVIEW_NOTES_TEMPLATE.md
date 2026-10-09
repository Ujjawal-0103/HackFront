# Developer Interview Notes Template

> **Usage Instructions:** Complete one copy of this template for each qualified developer interview.  
> **Status:** Template Ready | Field Submissions: **PENDING HUMAN RESEARCH** (Do NOT fabricate completed sessions).

---

## 1. Participant Metadata & Qualification

- **Participant Code:** `[P-01 / P-02 / ...]`
- **Interview Date & Time:** `[YYYY-MM-DD HH:MM]`
- **Interviewer Name:** `[Tannu Kumari / Ujjawal Agrawal / Team Member]`
- **Role / Title:** `[e.g., Staff Backend Engineer / Full Stack Lead]`
- **Company / Org Type:** `[e.g., Series B SaaS / Enterprise Fintech / Open Source Core]`
- **Primary Tech Stack:** `[e.g., TypeScript, Node.js, Next.js, PostgreSQL]`
- **Repository Characteristics:**
  - Age: `[e.g., 4 years]`
  - Total Contributors: `[e.g., 25+]`
  - Active AI Assistants: `[e.g., GitHub Copilot Enterprise, Cursor]`
- **Screening Criteria Verified:** `[Yes / No]`

---

## 2. Recent Incident & Context

- **Specific Module / Code Encountered:**
  - _Description:_ `[Brief description of the function, pattern, or workaround under investigation]`
  - _Why it seemed non-obvious:_ `[Why was the rationale confusing or counter-intuitive?]`
  - _Original Author Availability:_ `[Still at org / Left org / Unknown author]`

---

## 3. Investigation Workflow & Workarounds

- **Step-by-Step Path Taken:**
  1. `[e.g., Ran git blame in VS Code]`
  2. `[e.g., Found commit from 2021 with message "fix: sync issue"]`
  3. `[e.g., Searched GitHub for issue #412 cited in commit]`
  4. `[e.g., Asked Copilot Chat to explain the function]`
- **Information Sources Consulted:** `[Git log, PR discussions, Jira, Slack, ADRs, Docs, Test suites]`
- **Tools Used:** `[Git CLI, GitHub Web, VS Code GitLens, AI Assistant]`

---

## 4. Role of AI Assistant & Hallucination Observations

- **Exact Query Posed to AI:** `[e.g., "Why does this function catch ECONNRESET and retry 3 times?"]`
- **AI Response Summary:** `[Summary of the AI explanation received]`
- **Plausibility vs. Veracity:**
  - Did the explanation sound plausible? `[Yes / No]`
  - Did the AI assert specific facts (bug IDs, library limitations)? `[Yes / No]`
- **Observed Difficulties & False Claims:**
  - `[Did the AI hallucinate an issue or make an ungrounded claim? Detail here]`

---

## 5. Verification Technique & Resolution

- **How Verification Was Performed:** `[How did the engineer confirm or refute the AI claim?]`
- **Total Time Spent (Minutes):** `[e.g., 35 minutes]`
- **Final Outcome:** `[Code preserved / Code refactored / Kept with added comment / Inconclusive]`
- **Consequence of Ambiguity:** `[Risk of regression / Delay in PR review / None]`

---

## 6. Contradictory Evidence & Edge Cases

- **Did the participant's behavior contradict our initial assumptions?**
  - `[e.g., Participant did not care about historical rationale and simply deleted the code, or relied exclusively on tests]`

---

## 7. Evidence Classification

- [ ] **Verified Evidence:** Directly observed behavior corroborated by screen share / commit logs.
- [ ] **Reported Incident:** Self-reported past incident (anecdotal).
- [ ] **Unresolved Assumption:** Claim requires further corroborating interviews.

---

## 8. Follow-Up Questions & Next Steps

- `[Specific questions to probe in subsequent interviews or product iterations]`
