# Verification Evaluation Strategy & Benchmark Plan

> **Objective:** Empirically evaluate Traceback's retrieval recall, claim assessment fidelity, citation validity, and abstention calibration.  
> **Status:** Evaluation Framework Baseline | Benchmark Execution: Planned for Sprints 4 & 5  
> **Last Updated:** 2026-10-09

---

## 1. Evaluation Dataset Architecture (10 Benchmark Archetypes)

To ensure Traceback performs accurately across complex real-world repository conditions, the evaluation dataset defines 10 distinct case archetypes:

1. **ARCH-01 (Explicitly Documented Decision):** Rationale is explicitly stated in an existing ADR or comprehensive commit message.
2. **ARCH-02 (Incomplete / Sparse Evidence):** Commit message is brief (`"fix bug"`); PR discussion contains only partial hints.
3. **ARCH-03 (Contradictory Historical Sources):** An early PR introduces an optimization; a later PR reverts it due to a production regression.
4. **ARCH-04 (Missing Rationale):** Initial import or squash commit with zero documented reasoning (requires strict abstention).
5. **ARCH-05 (Multiple-Claim Explanation):** Complex AI explanation asserting 3–5 distinct historical reasons in a single response.
6. **ARCH-06 (Incorrect / Invented AI Claims):** AI generated a plausible-sounding but completely fictitious bug number or library incompatibility.
7. **ARCH-07 (Stale Historical Records):** Explaining code where the cited architecture was refactored in a subsequent major version.
8. **ARCH-08 (Multi-Hop Dispersed Evidence):** Evidence spread across an initial issue, an external PR review comment, and an inline code comment.
9. **ARCH-09 (Adversarial Prompt Injection Attempt):** Commit message or PR body containing text attempting to coerce the LLM verifier into marking false claims as `Supported`.
10. **ARCH-10 (Human Uncertainty / Ambiguous Intent):** Subtle architectural trade-off where even human maintainers disagree on the primary intent.

---

## 2. Evaluation Case Schema

Each evaluation case must contain the following fields (defined in `docs/evaluation/evaluation-case-template.csv`):

- `case_id`: Unique identifier (e.g., `CASE-001`).
- `archetype`: One of the 10 defined archetypes.
- `repo_slug`: Authorized repository (e.g., `owner/repo`).
- `target_symbol`: Function or code snippet under investigation.
- `target_file_path`: Relative file path.
- `input_explanation`: The AI-generated explanation under test.
- `expected_claims_count`: Ground-truth count of decomposed claims.
- `ground_truth_evidence_ids`: Expected commit SHAs, PR numbers, or line ranges.
- `expected_reference_verdict`: Expected truth label (`SUPPORTED`, `CONTRADICTED`, `UNVERIFIED`).
- `expected_abstention`: Boolean flag indicating whether the system must abstain.
- `notes_and_limitations`: Contextual notes for human evaluators.

---

## 3. Quantitative Metrics & Calculation Methods

### Metric 1: Retrieval Precision & Recall at Rank K ($P@K$ and $R@K$)

Measures whether the retrieval engine returns genuine historical artifacts.
$$\text{Recall@}K = \frac{|\text{Retrieved Ground Truth Evidence in Top } K|}{|\text{Total Ground Truth Evidence}|}$$
$$\text{Precision@}K = \frac{|\text{Retrieved Ground Truth Evidence in Top } K|}{K}$$

- **Target:** $R@5 \ge 0.85$, $P@5 \ge 0.70$ on indexed repositories.

### Metric 2: Citation Validity Rate ($CVR$)

Measures the percentage of surfaced evidence references that correspond to real, accessible GitHub commits, PRs, or file lines.
$$CVR = \frac{\text{Count of Valid, Clickable Source URLs}}{\text{Total Citations Generated}} \times 100\%$$

- **Target:** $100.0\%$ (Zero hallucinated citations permitted).

### Metric 3: Claim Assessment Accuracy ($CAA$)

Measures agreement between the preliminary AI assessment and verified ground-truth reference labels.
$$CAA = \frac{\text{Correctly Classified Claims}}{\text{Total Evaluated Claims}}$$

- **Target:** $CAA \ge 85\%$ on benchmark dataset.

### Metric 4: Calibrated Abstention Quality ($AQ$)

Measures the system's ability to abstain when evidence is absent (ARCH-04 and ARCH-02), rather than guessing.
$$AQ = \frac{\text{True Abstentions on Sparse/Missing Cases}}{\text{Total Sparse/Missing Evidence Cases}}$$

- **Target:** $AQ \ge 95\%$ (Model must not fabricate rationale when evidence is absent).

### Metric 5: Unsupported Assertion Rate ($UAR$)

Measures the frequency with which the system asserts high confidence without matching evidence.
$$UAR = \frac{\text{Claims Marked Supported Without Ground-Truth Citation}}{\text{Total Claims Marked Supported}}$$

- **Target:** $UAR \le 2.0\%$.

### Metric 6: Human Review Completion Rate ($HCR$) & Workflow Latency ($WL$)

- $HCR$: Percentage of started verification sessions where the human reviewer assigns verdicts to all claims.
- $WL$: Total elapsed time from explanation submission to report export.
  - **Target:** $WL \le 90\text{ seconds}$ on benchmark tasks.

---

## 4. Benchmark Execution Protocol

1. Baseline tests will be executed in Sprint 4 (Evidence Store) and Sprint 5 (Claim Assessment).
2. All empirical scores will be recorded in this directory alongside git commit hashes of the evaluated model adapter.
3. No claims of superiority or accuracy improvements will be published without reproducible test logs.
