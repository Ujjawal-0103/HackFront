# Developer Interview Guide — Understanding Legacy Code Rationale

> **Research Goal:** Uncover how software engineers investigate non-obvious code implementations, how they use AI coding assistants in this process, and where existing tools fail.  
> **Methodology:** Semi-structured qualitative interviews focused exclusively on _real past incidents_, avoiding hypothetical opinions.  
> **Status:** Prepared & Approved for Execution | Fieldwork: **PENDING HUMAN INTERVIEWS**

---

## 1. Participant Qualification & Screening Criteria

To ensure high-fidelity insights, prospective interviewees must meet all of the following criteria:

1. Actively maintain or contribute to a production software codebase with >2 years of active development.
2. The codebase has more than 5 distinct historical contributors.
3. Regularly use an AI coding assistant (e.g., GitHub Copilot, Cursor, Claude Code, ChatGPT) at least 3 days per week.
4. Have encountered an unfamiliar or non-obvious piece of code within the past 30 days whose original rationale was not immediately obvious.

---

## 2. Interview Protocol & Conduct Guidelines

- **Duration:** 30–45 minutes.
- **Recording & Consent:** Secure recorded consent for audio/transcript solely for internal analysis; confirm strict anonymity.
- **Interviewer Stance:** Neutral, inquisitive, non-defensive. Do not pitch Traceback or lead the witness.
- **Follow-up Probe Technique:** When an interviewee states an outcome, probe with: _"Can you walk me through the specific steps you took next?"_ and _"What did you see on your screen at that moment?"_

---

## 3. Core Past-Behavior Interview Questions (8 Mandatory Inquiries)

### Question 1: Recent Incident Context

> _"Tell me about the last time you encountered a function, workaround, or architectural choice in your repository where you found yourself asking: 'Why on earth is the code written like this?'"_

- _Probe:_ What was the codebase? How old was it? Was the original author still at the company?

### Question 2: Initial Action & Investigation Workflow

> _"What were the very first steps you took to figure out why that code was there?"_

- _Probe:_ Did you run git blame? Did you search PRs? Did you ask a colleague? Which tool did you open first?

### Question 3: Tooling & Information Sources Consulted

> _"Which specific tools, logs, tickets, or documentation sources did you consult during that investigation?"_

- _Probe:_ How easy was it to find the relevant commit or pull request discussion?

### Question 4: Time Spent & Operational Cost

> _"Approximately how long did that entire investigation take, from when you first paused to when you felt confident enough to proceed?"_

- _Probe:_ Did it block your work, delay a release, or lead to a team discussion?

### Question 5: Role of AI Assistants

> _"Did you ask an AI assistant (like Copilot, Cursor, or Claude) to explain the code? If so, what exactly did you ask it, and what did it tell you?"_

- _Probe:_ Did the answer sound plausible? What made you trust or doubt it?

### Question 6: Unresolved Difficulties & Hallucination Experience

> _"What remained difficult, ambiguous, or unresolved even after reading the AI's explanation?"_

- _Probe:_ Did the AI ever assert a reason (e.g., "This prevents memory leak in library X") that turned out to be completely false upon checking?

### Question 7: Verification Technique

> _"How did you verify whether the AI's explanation was historically accurate versus just a plausible guess?"_

- _Probe:_ Did you manually check commits? Did you run tests? Did you look for an ADR?

### Question 8: Outcome of Inconclusive Investigations

> _"What happened if you were completely unable to establish the original rationale? Did you keep the code, rewrite it, or wrap it in a comment?"_

- _Probe:_ Have you ever rewritten legacy code thinking it was obsolete, only to cause an outage because of a forgotten edge case?

---

## 4. Post-Interview Synthesis Checklist

Immediately following the interview, the interviewer must:

1. Complete the `INTERVIEW_NOTES_TEMPLATE.md` within 2 hours.
2. Tag observed behaviors with evidence classifications (`Verified Evidence`, `Observed Workaround`, `Contradictory Behavior`).
3. Note any unexpected participant behaviors that challenge our product hypotheses.
