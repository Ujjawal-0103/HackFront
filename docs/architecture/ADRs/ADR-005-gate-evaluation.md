# ADR-005 Evaluation Gate: Neo4j Graph Database Assessment

- **Referenced Architecture Decision:** [ADR-005: Neo4j and Knowledge Graph Justification Criteria](./ADR-005-neo4j-graph-justification.md)
- **Status:** Concluded — **Defer Neo4j for V1 Baseline**
- **Date:** 2026-10-13
- **Evaluators:** Senior Full-Stack Engineering Team

---

## 1. Context and Gate Condition

ADR-005 established strict justification criteria to avoid introducing unnecessary operational complexity:

> _"Neo4j will only be introduced if Sprint 4 evaluation shows that relational/hybrid retrieval fails on >20% of multi-hop rationale queries and a prototype Neo4j graph improves Recall@5 by at least 15 percentage points."_

During Sprint 4, both retrieval modes were implemented and benchmarked on identical test sets across the 10 evaluation archetypes:

- **Mode A:** PostgreSQL Full-Text Lexical Baseline (`EvidenceSearchService`).
- **Mode B:** Baseline combined with bounded Neo4j Graph-Neighbour Expansion (`GraphRetrieverService`).

---

## 2. Empirical Benchmark Comparison

| Metric                         | Mode A (PostgreSQL Baseline) | Mode B (Baseline + Neo4j Graph) |   Delta ($\Delta$)   |      ADR-005 Threshold Met?      |
| :----------------------------- | :--------------------------: | :-----------------------------: | :------------------: | :------------------------------: |
| **Recall@5**                   |          **0.889**           |            **0.889**            | $+0.000$ ($0.0$ pp)  | **No** (requires $\ge +15.0$ pp) |
| **Precision@5**                |          **0.622**           |            **0.644**            | $+0.022$ ($+2.2$ pp) |               N/A                |
| **Mean Reciprocal Rank (MRR)** |          **0.889**           |            **0.889**            |       $+0.000$       |               N/A                |
| **Abstention Accuracy**        |          **1.000**           |            **1.000**            |       $+0.000$       |               N/A                |
| **Query Latency**              |          **1.2 ms**          |           **2.8 ms**            | $+1.6$ ms ($+133\%$) |               N/A                |

---

## 3. Findings and Analysis

1. **High Effectiveness of Structured Relational Retrieval:**
   Technical code explanations overwhelmingly hinge on concrete technical symbols (function names, error codes, commit SHAs, file paths, issue numbers). PostgreSQL indexed search over `SourceRecord`s (`title`, `content`, `filePath`) successfully retrieves relevant evidence in $\approx 89\%$ of cases.

2. **Graph Expansion Utility vs. Cost:**
   Graph expansion successfully discovers structurally connected nodes (e.g. Issue #77 $\rightarrow$ PR #104 $\rightarrow$ Commit `7788abc`), but in technical code verification, the primary commit or PR already contains direct textual references to the issue or symbol. Consequently, graph expansion increases Precision@5 slightly ($+2.2$ pp) by surfacing additional context, but does **not** increase Recall@5 by the required $\ge 15.0$ percentage points.

3. **Operational Complexity:**
   Enforcing a mandatory Neo4j dependency introduces:
   - Dedicated JVM/container resource overhead (~1GB RAM).
   - Dual-database consistency challenges (PostgreSQL remains authoritative).
   - Increased query latency (+1.6ms per retrieval).

---

## 4. Final Architecture Gate Recommendation

**RECOMMENDATION: DEFER NEO4J FOR V1 BASELINE.**

- **V1 Production Runtime:** Deploy with PostgreSQL full-text search and relational indexing as the sole primary evidence store.
- **Modularity:** Retain `Neo4jService`, `GraphProjectionService`, and `GraphRetrieverService` in the codebase with automatic graceful degradation (`graphAvailable: false`), allowing opt-in graph evaluation in environments where Neo4j is configured without impacting baseline stability.
