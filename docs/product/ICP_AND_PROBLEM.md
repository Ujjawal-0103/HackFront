# Ideal Customer Profile (ICP) & Problem Definition

> **Status:** Working Hypothesis — Pending Empirical Validation via Human Interviews  
> **Last Updated:** 2026-10-09

---

## 1. Problem Hypothesis

Developers maintaining established software repositories frequently encounter legacy functions, convoluted workarounds, and non-obvious architecture whose rationale is not apparent from the code syntax alone.

When developers ask existing AI coding assistants (such as GitHub Copilot, Cursor, or Claude Code) _"Why was this written this way?"_, the generated answers:

1. Often sound completely confident and syntactically convincing.
2. Frequently confuse _what_ the code does with _why_ it was originally constructed.
3. May hallucinate historical bug reports, issue numbers, or platform bugs that never existed.
4. Fail to provide traceable citations connecting claims to concrete Git commits, PR discussions, or architectural records.

As a result, engineers waste significant time manually digging through version control logs or, worse, accept false AI assumptions that lead to regressions when modifying legacy code.

---

## 2. Ideal Customer Profile (ICP) — Provisional

### Firmographic & Repository Profile

- **Repository Maturity:** Established codebases (>2 years old, >1,000 commits, >10 active or past contributors).
- **Technology Ecosystem:** Primary focus on JavaScript / TypeScript (Node.js, React, Next.js, monorepos), expandable to Python and Go.
- **Documentation Hygiene:** Variable; may have sparse inline comments, occasional PR descriptions, and scattered issue trackers.
- **Tooling Stack:** Development teams actively utilizing AI coding assistants (e.g., GitHub Copilot, Cursor, Claude Code).

### Developer Persona Details

- **Title / Role:** Senior Software Engineer, Staff Engineer, Tech Lead, or Open Source Maintainer.
- **Key Responsibilities:** Code review, legacy refactoring, incident post-mortems, architectural stewardship.
- **Frequency of Need:** 2–5 times per week when navigating legacy modules, investigating regressions, or conducting code reviews.
- **Current Alternatives / Workarounds:**
  - Running `git log -S <symbol>`, `git blame`, or `git log -p <file>`.
  - Searching GitHub pull request history and closed issue discussions.
  - Relying on team institutional memory (e.g., asking former authors on Slack).
  - Blindly trusting AI explanations without historical verification.

---

## 3. Evidence vs. Assumptions Ledger

| Area                            | Current Status    | Supporting Evidence                                                                                                              | Provisional Assumption / Unknown                                                                                |
| :------------------------------ | :---------------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **Problem Frequency**           | Assumption        | Anecdotal developer reports and community forum discussions describe AI hallucinations when explaining legacy code.              | Exact weekly incidence rate across enterprise engineering teams requires validation via structured interviews.  |
| **Existing Workaround Latency** | Partial Evidence  | Manual investigation using `git log`, `git blame`, and GitHub search typically consumes 15–45 minutes per incident.              | Whether engineers perceive this latency as painful enough to warrant introducing a dedicated verification tool. |
| **AI Assistant Limitation**     | Verified Evidence | Commercial AI assistants prioritize conversational fluency and local token context over exhaustive Git commit history traversal. | Whether upcoming assistant upgrades (e.g. deeper indexing) will partially satisfy this need natively.           |
| **Willingness to Verify**       | Hypothesis        | Developers will actively review decomposed claims and evidence cards if presented in <90 seconds.                                | Whether developers will engage in structured adjudication or prefer passive inline summaries.                   |

---

## 4. Why a Dedicated Verification Layer is Justified

Existing coding assistants operate as generative authoring engines. Their objective function rewards producing fluent completions given immediate context windows. In contrast, verifying historical provenance requires:

1. **Adversarial & Skeptical Evaluation:** Actively searching for contradictory evidence or verifying absence.
2. **Deterministic Provenance Tracking:** Providing immutable links to commit SHAs, line numbers, and issue threads.
3. **Calibrated Abstention:** Saying _"We cannot find evidence for this claim in repo history"_ rather than guessing plausible rationale.
4. **Human Supervised Adjudication:** Maintaining clear separation between model confidence and authoritative human review.
