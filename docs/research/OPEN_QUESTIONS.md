# Open Research & Product Questions

> **Status:** Active Tracking Ledger | Last Updated: 2026-10-09

---

## 1. User & Market Questions (Pending Human Interviews)

1. **OQ-01:** How many times per sprint does a senior engineer encounter code where the original author is unavailable and the rationale is unknown?
2. **OQ-02:** When an AI assistant produces an explanation that sounds plausible, what percentage of engineers verify it vs. accepting it at face value?
3. **OQ-03:** What is the maximum acceptable latency for a verification workflow before an engineer abandons the process (e.g., 30s vs 90s vs 3min)?
4. **OQ-04:** Would developers prefer an external web application, an in-editor IDE extension (VS Code / JetBrains), or an interactive CLI / MCP tool?

## 2. Technical & Architecture Questions (To Evaluate in Sprints 2–5)

1. **OQ-05:** Does graph traversal (Neo4j) provide measurable recall improvements over hybrid vector + BM25 search for repository commit history, or does it add unnecessary operational complexity?
2. **OQ-06:** What is the empirical token cost of decomposing long explanations into atomic claims and evaluating them against retrieved diffs?
3. **OQ-07:** How does the system handle squash-merged repositories where fine-grained commit rationale was squashed into a single generic message?
4. **OQ-08:** How effective is prompt delimiter defense against prompt injection embedded in malicious commit messages or pull request descriptions?
