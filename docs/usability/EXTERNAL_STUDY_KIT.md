# Traceback External Usability Study Kit & Protocol Materials

> **Document Status:** Official Protocol Materials (Ready for Execution)  
> **Target Audience:** Study Moderators, Observers, and External Developer Participants  
> **Current Study Execution Status:** **PENDING HUMAN RESEARCH / NOT YET COMPLETED**  
> _(In strict compliance with project radical honesty principles, external sessions have not been fabricated. These materials are prepared for execution with recruited external developers in staging or preview environments)._

---

## 1. Study Overview & Ethical Framework

### 1.1 Study Purpose

Traceback helps developers maintaining established codebases verify AI-generated code explanations against recorded repository artifacts (Git commits, PRs, issues, ADRs, test records). This study assesses:

1. Ease of account creation and initial repository orientation.
2. Comprehension of the fundamental epistemological distinction between **Preliminary Machine Assessment** (heuristic citation match) and **Authoritative Human Verdict**.
3. Usability of evidence exploration, claim verification, human verdict submission, and report export.
4. Perceived system trustworthiness, cognitive friction, and confidence in verification decisions.

### 1.2 Target Participant Profile

- **Roles:** Full-stack engineers, backend engineers, software architects, code reviewers.
- **Experience Level:** 2+ years maintaining non-trivial Git repositories (> 100 commits, multiple contributors).
- **Tooling Background:** Familiar with GitHub PR workflows and AI coding tools (GitHub Copilot, Cursor, Claude Code, etc.).
- **Cohort Size:** 5–8 participants (standard Nielsen Norman Group usability cohort).

---

## 2. Participant Information & Consent Form

```text
================================================================================
PARTICIPANT INFORMED CONSENT & PRIVACY NOTICE
Project: Traceback Usability Evaluation (Sprint 9 Release Hardening)
================================================================================

PURPOSE OF THIS STUDY:
You are invited to evaluate Traceback, a developer verification platform.
We are testing the usability and clarity of the software interface — NOT your
individual engineering ability. Any difficulty you experience indicates an area
where the system can be improved.

WHAT WILL HAPPEN:
1. You will be asked to complete 8 realistic software maintenance tasks using a
   test repository in a controlled web sandbox.
2. We ask that you "think aloud" as you navigate, narrating your thought process,
   expectations, and points of confusion.
3. The session will take approximately 45–60 minutes.
4. An observer will record completion time, task success, and verbal feedback.
   Screen recordings (if captured) are used exclusively for interface analysis.

DATA PRIVACY & ANONYMIZATION:
- No personally identifiable credentials or private code repositories are used.
- Your identity will be permanently decoupled from recorded data and replaced
  with an anonymous code (e.g., P-01, P-02).
- Aggregated findings will be summarized in open engineering documentation.
- You may decline to answer any question or pause/terminate the study at any time
  without explanation.

VOLUNTARY CONSENT:
By signing below, you acknowledge that you have read this form, had your questions
answered, and consent to participate in this usability study.

Participant Signature: _______________________   Date: _______________
Participant Printed Name: ____________________
```

---

## 3. Moderator Script & Think-Aloud Instructions

```text
================================================================================
TRACEBACK MODERATOR SCRIPT
================================================================================

[PHASE 1: WELCOME & WARM-UP — 5 MINUTES]

Moderator:
"Hello [Participant Name], thank you for joining us today. My name is [Moderator Name],
and I will be facilitating today's session.

Today, we are testing Traceback, a system designed to help developers verify
whether AI-generated explanations of legacy code are actually supported by
historical Git commits, pull requests, issues, and architecture records.

Before we begin, a few key reminders:
1. We are testing the software, NOT you. There are no right or wrong actions.
   If something feels confusing, that is a flaw in the system, not you.
2. Please think aloud throughout the session. Tell me what you are looking for,
   what you expect to see, what surprises you, and what decisions you are making.
3. If you get stuck, try what you would normally do in your work. I will observe
   silently during tasks, but I will prompt you if you fall quiet.
4. Do you have any questions before we look at the tasks?"

[Collect signed consent form]

[PHASE 2: TASK-BASED EVALUATION — 35 MINUTES]

Moderator:
"I am now going to give you a Task Sheet with 8 sequential tasks. Please read each
task prompt aloud before beginning it, and let me know when you feel you have
completed it or reached a stopping point."

--- TASK 1: Account Creation & Sign-In ---
Moderator Prompts (if silent > 15s):
- "What are you noticing on this form?"
- "What do you expect to happen after clicking submit?"

--- TASK 2: Repository Selection & Ingestion Inspection ---
Moderator Prompts (if silent > 15s):
- "What is your sense of whether this repository is ready for verification?"
- "Where would you look to see how recently it was indexed?"

--- TASK 3: Historical Evidence Search ---
Moderator Prompts (if silent > 15s):
- "What keywords did you choose, and what did you expect to see?"
- "What provenance or source information do you see on the result cards?"

--- TASK 4: AI Explanation Verification ---
Moderator Prompts (if silent > 15s):
- "How does the system present the claims from the explanation?"
- "What does the machine confidence score tell you?"

--- TASK 5: Epistemological Understanding Check (Verbal Probe) ---
Moderator (Standardized Question):
"Looking at the screen right now, in your own words, what is the difference
between the 'Machine Assessment' badge and the 'Human Verdict' controls?"
[Listen for: machine assessment is heuristic/statistical; human verdict is authoritative].

--- TASK 6: Record & Revise Human Verdict ---
Moderator Prompts (if silent > 15s):
- "Where would you go to record that you agree or disagree with this claim?"
- "Do you see a way to document your rationale for the team?"

--- TASK 7: Verification History & Session Reload ---
Moderator Prompts (if silent > 15s):
- "Imagine you left for lunch and came back. How would you retrieve this session?"
- "Are your earlier verdict and notes preserved?"

--- TASK 8: Export Sanitized Verification Report ---
Moderator Prompts (if silent > 15s):
- "Where would you look to export this result for a PR or compliance audit?"
- "Looking at the export preview or file, does it look complete?"

[PHASE 3: DEBRIEF & SYSTEM USABILITY SCALE — 10 MINUTES]

Moderator:
"Thank you for completing the tasks! We will now finish with a brief 10-question
usability scale and three open feedback questions."
```

---

## 4. Participant-Facing Task Sheet

```text
================================================================================
PARTICIPANT TASK SHEET
Scenario: You have joined an engineering team maintaining a critical core engine.
You have been asked to verify several architectural decisions using Traceback.
================================================================================

TASK 1 — Account Setup
Prompt: Navigate to the Traceback application. Register a new developer account
using your email and a password of your choice, then ensure you are signed in.
Target: Authenticated navigation view visible.

TASK 2 — Repository Orientation
Prompt: From your active workspace, locate the repository "alpha/core-engine".
Inspect whether the repository is already synchronized or if a sync is required.
Target: View repository indexing status and commit count.

TASK 3 — Historical Evidence Search
Prompt: The team wants to know why a mutex lock was added to the worker pool.
Search historical evidence for "worker pool mutex", filter to commits, and inspect
the canonical commit URL and code diff snippet.
Target: Locate commit 7f8a9b1 with canonical GitHub URL.

TASK 4 — Submit Explanation for Verification
Prompt: An AI coding assistant provided the following explanation:
"The Mutex lock in worker pool was introduced to prevent concurrent race conditions
and thread starvation during high-throughput dispatch."
Submit this explanation for verification against "alpha/core-engine".
Target: View extracted claims and preliminary evidence matches.

TASK 5 — Epistemological Check
Prompt: Once the verification results appear, review the claims. Explain aloud to
the moderator what the difference is between the "Preliminary Machine Assessment"
and the "Human Verdict" column.
Target: Verbal explanation of heuristic match vs authoritative human judgment.

TASK 6 — Record Your Review Verdict
Prompt: Based on the historical commit evidence, record a human verdict of
"SUPPORTED" on Claim 1, with the note "Confirmed in commit 7f8a9b1". Then update
the review notes to add "Verified by [Your Initials]".
Target: Human verdict persisted with audit history.

TASK 7 — Retrieve Past Session from History
Prompt: Simulate leaving your workstation. Return to the History tab, find the
verification session you just completed, reopen it, and confirm all claims and
your review notes are intact.
Target: Session reopened from database with zero data loss.

TASK 8 — Export Verification Report
Prompt: Export the verified session as a JSON report conforming to the team's
standard verification format (`traceback.report.v1`).
Target: Export generated and downloaded/copied without credential leakage.
```

---

## 5. Observer & Data Collection Matrix

| Participant ID | Task ID | Completion Status (PASS / PARTIAL / FAIL) | Duration (sec) | Misclicks / Errors Count | Confusion Moments (verbalized) | Observer Notes       |
| -------------- | ------- | ----------------------------------------- | -------------- | ------------------------ | ------------------------------ | -------------------- |
| P-01           | Task 1  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 2  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 3  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 4  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 5  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 6  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 7  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |
| P-01           | Task 8  | `[ ]` PASS `[ ]` PARTIAL `[ ]` FAIL       | _____ s        | _____                    | ____________________           | ____________________ |

### Criteria Definitions:

- **PASS:** Participant completed the task autonomously without moderator intervention.
- **PARTIAL:** Participant completed the core goal but required a clarifying prompt or took > 2x expected time.
- **FAIL:** Participant gave up, chose an incorrect stopping point, or encountered an unrecoverable error.

---

## 6. Post-Study System Usability Scale (SUS) Questionnaire

Participants rate each statement on a 5-point Likert scale (1 = Strongly Disagree, 5 = Strongly Agree):

1. I think that I would like to use Traceback frequently for code reviews. `[ 1 | 2 | 3 | 4 | 5 ]`
2. I found Traceback unnecessarily complex. `[ 1 | 2 | 3 | 4 | 5 ]`
3. I thought Traceback was easy to use. `[ 1 | 2 | 3 | 4 | 5 ]`
4. I think that I would need the support of a technical person to use Traceback. `[ 1 | 2 | 3 | 4 | 5 ]`
5. I found the various functions in Traceback were well integrated. `[ 1 | 2 | 3 | 4 | 5 ]`
6. I thought there was too much inconsistency in Traceback. `[ 1 | 2 | 3 | 4 | 5 ]`
7. I would imagine that most developers would learn to use Traceback very quickly. `[ 1 | 2 | 3 | 4 | 5 ]`
8. I found Traceback very cumbersome to use. `[ 1 | 2 | 3 | 4 | 5 ]`
9. I felt very confident using Traceback. `[ 1 | 2 | 3 | 4 | 5 ]`
10. I needed to learn a lot of things before I could get going with Traceback. `[ 1 | 2 | 3 | 4 | 5 ]`

### Debriefing Qualitative Questions:

1. _What was the single most valuable feature you used today?_
2. _Where did you experience hesitation or doubt about what the system was doing?_
3. _How did you feel about the separation between what the AI recommended versus your human verdict?_

---

## 7. Anonymized Results Aggregation Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TracebackUsabilityStudyResults",
  "type": "object",
  "properties": {
    "studyId": { "type": "string" },
    "executionDate": { "type": "string", "format": "date" },
    "status": { "type": "string", "enum": ["COMPLETED", "PENDING_RECRUITMENT"] },
    "totalParticipants": { "type": "integer" },
    "averageSusScore": { "type": "number", "minimum": 0, "maximum": 100 },
    "taskMetrics": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "taskId": { "type": "string" },
          "taskName": { "type": "string" },
          "completionRate": { "type": "number" },
          "averageTimeSeconds": { "type": "number" },
          "commonFrictionPoints": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["taskId", "taskName", "completionRate", "averageTimeSeconds"]
      }
    }
  },
  "required": ["studyId", "executionDate", "status", "totalParticipants"]
}
```
