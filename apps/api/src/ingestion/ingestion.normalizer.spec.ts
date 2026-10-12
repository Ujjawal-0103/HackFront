import {
  normalizeRepositoryMetadata,
  normalizeCommit,
  normalizeCommitDiff,
  normalizePullRequest,
  normalizePullRequestComment,
  normalizeIssue,
  normalizeIssueComment,
  normalizeReviewToComment,
  IngestionNormalizationError,
} from "./ingestion.normalizer";
import {
  GitHubRepoDetails,
  GitHubCommitDetail,
  GitHubPullRequestDetail,
  GitHubIssueSummary,
  GitHubComment,
  GitHubReview,
} from "../github/github-ingestion.types";

describe("Ingestion Normalizer (Sprint 3 Part 4)", () => {
  describe("normalizeRepositoryMetadata", () => {
    it("should normalize valid repository metadata", () => {
      const raw: GitHubRepoDetails = {
        id: 998877,
        name: "HackFront",
        fullName: "Ujjawal-0103/HackFront",
        owner: "Ujjawal-0103",
        description: "Traceback verification engine",
        defaultBranch: "main",
        isPrivate: true,
        isFork: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-01T00:00:00Z",
        sizeKb: 2048,
      };

      const normalized = normalizeRepositoryMetadata(raw);
      expect(normalized).toEqual({
        githubRepoId: 998877,
        fullName: "Ujjawal-0103/HackFront",
        defaultBranch: "main",
        isPrivate: true,
        description: "Traceback verification engine",
        sizeKb: 2048,
      });
    });

    it("should handle optional description and default branch fallback", () => {
      const raw: GitHubRepoDetails = {
        id: 112233,
        name: "test-repo",
        fullName: "org/test-repo",
        owner: "org",
        defaultBranch: "",
        isPrivate: false,
        isFork: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        sizeKb: 0,
      };

      const normalized = normalizeRepositoryMetadata(raw);
      expect(normalized.defaultBranch).toBe("main");
      expect(normalized.description).toBeNull();
      expect(normalized.isPrivate).toBe(false);
    });

    it("should throw on missing numeric ID or empty full name", () => {
      expect(() =>
        normalizeRepositoryMetadata({} as GitHubRepoDetails),
      ).toThrow(IngestionNormalizationError);

      expect(() =>
        normalizeRepositoryMetadata({
          id: 123,
          name: "",
          fullName: "",
          owner: "",
        } as GitHubRepoDetails),
      ).toThrow(IngestionNormalizationError);
    });
  });

  describe("normalizeCommit & normalizeCommitDiff", () => {
    it("should normalize commit detail and child diffs while capturing parent SHAs", () => {
      const rawCommit: GitHubCommitDetail = {
        sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        message: "feat: add table memoization",
        author: {
          name: "Alex Maintainer",
          email: "alex@company.com",
          date: "2025-04-12T10:00:00Z",
        },
        committer: {
          name: "Alex Maintainer",
          email: "alex@company.com",
          date: "2025-04-12T10:00:00Z",
        },
        url: "https://github.com/org/repo/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        parentShas: ["f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9"],
        stats: { additions: 15, deletions: 2, total: 17 },
        files: [
          {
            filename: "src/table.ts",
            status: "modified",
            additions: 15,
            deletions: 2,
            changes: 17,
            patch: "@@ -1,5 +1,18 @@\n+export const Table = ...",
          },
          {
            filename: "assets/logo.png",
            status: "added",
            additions: 0,
            deletions: 0,
            changes: 0,
          },
        ],
      };

      const normalized = normalizeCommit(rawCommit);
      expect(normalized.sha).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");
      expect(normalized.message).toBe("feat: add table memoization");
      expect(normalized.authorName).toBe("Alex Maintainer");
      expect(normalized.authorEmail).toBe("alex@company.com");
      expect(normalized.committedAt.toISOString()).toBe(
        "2025-04-12T10:00:00.000Z",
      );
      expect(normalized.parentShas).toEqual([
        "f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9",
      ]);
      expect(normalized.diffs).toHaveLength(2);

      expect(normalized.diffs[0]).toEqual({
        filePath: "src/table.ts",
        status: "modified",
        additions: 15,
        deletions: 2,
        diffHunk: "@@ -1,5 +1,18 @@\n+export const Table = ...",
        isBinary: false,
      });

      expect(normalized.diffs[1]).toEqual({
        filePath: "assets/logo.png",
        status: "added",
        additions: 0,
        deletions: 0,
        diffHunk: null,
        isBinary: true,
      });
    });

    it("should fallback to committer info when author info is missing", () => {
      const rawCommit: GitHubCommitDetail = {
        sha: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
        message: "chore: update dependencies",
        author: { name: "", email: "", date: "" },
        committer: {
          name: "CI Bot",
          email: "bot@company.com",
          date: "2025-05-01T12:00:00Z",
        },
        url: "https://github.com/org/repo/commit/b2c3",
        parentShas: [],
        stats: { additions: 1, deletions: 1, total: 2 },
        files: [],
      };

      const normalized = normalizeCommit(rawCommit);
      expect(normalized.authorName).toBe("CI Bot");
      expect(normalized.authorEmail).toBe("bot@company.com");
      expect(normalized.committedAt.toISOString()).toBe(
        "2025-05-01T12:00:00.000Z",
      );
    });

    it("should throw IngestionNormalizationError on invalid commit SHA or date", () => {
      expect(() =>
        normalizeCommit({
          sha: "invalid-short-sha",
          message: "test",
          author: { name: "A", date: "2025-01-01" },
          committer: { name: "A", date: "2025-01-01" },
          url: "",
          parentShas: [],
          stats: { additions: 0, deletions: 0, total: 0 },
          files: [],
        }),
      ).toThrow(IngestionNormalizationError);

      expect(() =>
        normalizeCommit({
          sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
          message: "test",
          author: { name: "A", date: "invalid-date-string" },
          committer: { name: "A", date: "invalid-date-string" },
          url: "",
          parentShas: [],
          stats: { additions: 0, deletions: 0, total: 0 },
          files: [],
        }),
      ).toThrow(IngestionNormalizationError);
    });

    it("should throw on commit file with empty filename", () => {
      expect(() =>
        normalizeCommitDiff({
          filename: "",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
        }),
      ).toThrow(IngestionNormalizationError);
    });

    it("should normalize GitHubCommitFile adhering to interface without binary property", () => {
      const textFile = {
        filename: "src/calculator.ts",
        status: "modified",
        additions: 5,
        deletions: 1,
        changes: 6,
        patch: "@@ -1,3 +1,7 @@\n+export function add(a: number, b: number) { return a + b; }",
      };
      const normalizedText = normalizeCommitDiff(textFile);
      expect(normalizedText.isBinary).toBe(false);
      expect(normalizedText.diffHunk).toContain("export function add");

      const binaryFile = {
        filename: "assets/logo.png",
        status: "added",
        additions: 0,
        deletions: 0,
        changes: 0,
      };
      const normalizedBinary = normalizeCommitDiff(binaryFile);
      expect(normalizedBinary.isBinary).toBe(true);
      expect(normalizedBinary.diffHunk).toBeNull();
    });
  });

  describe("normalizePullRequest & normalizePullRequestComment", () => {
    it("should normalize an open pull request", () => {
      const rawPr: GitHubPullRequestDetail = {
        number: 42,
        title: "feat: add virtualized rows",
        body: "Solves memory leak on 10k rows.",
        author: "contributor-1",
        state: "open",
        isDraft: false,
        createdAt: "2025-03-01T00:00:00Z",
        updatedAt: "2025-03-02T00:00:00Z",
        url: "https://github.com/org/repo/pull/42",
        additions: 100,
        deletions: 20,
        changedFiles: 3,
        baseRef: "main",
        headRef: "feat/virtual-rows",
        headSha: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
      };

      const normalized = normalizePullRequest(rawPr);
      expect(normalized).toEqual({
        number: 42,
        title: "feat: add virtualized rows",
        body: "Solves memory leak on 10k rows.",
        author: "contributor-1",
        state: "open",
        isMerged: false,
        mergedAt: null,
        closedAt: null,
        url: "https://github.com/org/repo/pull/42",
      });
    });

    it("should normalize merged pull request with mergedAt timestamp", () => {
      const rawPr: GitHubPullRequestDetail = {
        number: 88,
        title: "fix: security token redaction",
        body: null as any,
        author: "security-auditor",
        state: "closed",
        isDraft: false,
        createdAt: "2025-02-01T00:00:00Z",
        updatedAt: "2025-02-05T00:00:00Z",
        mergedAt: "2025-02-05T12:00:00Z",
        closedAt: "2025-02-05T12:00:00Z",
        url: "https://github.com/org/repo/pull/88",
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        baseRef: "main",
        headRef: "fix/tokens",
        headSha: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
      };

      const normalized = normalizePullRequest(rawPr);
      expect(normalized.state).toBe("merged");
      expect(normalized.isMerged).toBe(true);
      expect(normalized.mergedAt?.toISOString()).toBe(
        "2025-02-05T12:00:00.000Z",
      );
      expect(normalized.body).toBeNull();
    });

    it("should throw on non-positive PR number", () => {
      expect(() =>
        normalizePullRequest({
          number: 0,
          title: "PR",
          author: "user",
          state: "open",
          isDraft: false,
          createdAt: "",
          updatedAt: "",
          url: "",
        }),
      ).toThrow(IngestionNormalizationError);
    });

    it("should normalize pull request comment", () => {
      const rawComment: GitHubComment = {
        id: "12345678901",
        author: "reviewer-alex",
        body: "Looks good, please add one test.",
        createdAt: "2025-03-02T15:30:00Z",
        updatedAt: "2025-03-02T15:30:00Z",
        url: "https://github.com/org/repo/pull/42#comment-123",
      };

      const normalized = normalizePullRequestComment(rawComment);
      expect(normalized).toEqual({
        githubCommentId: "12345678901",
        author: "reviewer-alex",
        body: "Looks good, please add one test.",
        createdAt: new Date("2025-03-02T15:30:00Z"),
      });
    });
  });

  describe("normalizeIssue & normalizeIssueComment", () => {
    it("should normalize an open issue", () => {
      const rawIssue: GitHubIssueSummary = {
        number: 101,
        title: "Bug: Table crashes on Safari 16",
        body: "Steps to reproduce: open table with > 100 rows.",
        state: "open",
        author: "safari-user",
        isPullRequest: false,
        commentsCount: 3,
        createdAt: "2025-03-10T00:00:00Z",
        updatedAt: "2025-03-11T00:00:00Z",
        url: "https://github.com/org/repo/issues/101",
      };

      const normalized = normalizeIssue(rawIssue);
      expect(normalized).toEqual({
        number: 101,
        title: "Bug: Table crashes on Safari 16",
        body: "Steps to reproduce: open table with > 100 rows.",
        author: "safari-user",
        state: "open",
        closedAt: null,
        url: "https://github.com/org/repo/issues/101",
      });
    });

    it("should normalize closed issue and comments", () => {
      const rawIssue: GitHubIssueSummary = {
        number: 102,
        title: "Resolved bug",
        body: null as any,
        state: "closed",
        author: "reporter",
        isPullRequest: false,
        commentsCount: 1,
        createdAt: "2025-03-01T00:00:00Z",
        updatedAt: "2025-03-05T00:00:00Z",
        closedAt: "2025-03-05T08:00:00Z",
        url: "https://github.com/org/repo/issues/102",
      };

      const normalized = normalizeIssue(rawIssue);
      expect(normalized.state).toBe("closed");
      expect(normalized.closedAt?.toISOString()).toBe(
        "2025-03-05T08:00:00.000Z",
      );

      const comment = normalizeIssueComment({
        id: "99887766",
        author: "fixer",
        body: "Fixed in #42.",
        createdAt: "2025-03-05T07:59:00Z",
        updatedAt: "2025-03-05T07:59:00Z",
        url: "https://github.com/org/repo/issues/102#comment-99",
      });
      expect(comment.githubCommentId).toBe("99887766");
      expect(comment.author).toBe("fixer");
      expect(comment.body).toBe("Fixed in #42.");
    });

    it("should throw on non-positive issue number", () => {
      expect(() =>
        normalizeIssue({
          number: -1,
          title: "Bad issue",
          state: "open",
          author: "user",
          isPullRequest: false,
          commentsCount: 0,
          createdAt: "",
          updatedAt: "",
          url: "",
        }),
      ).toThrow(IngestionNormalizationError);
    });
  });

  describe("normalizeReviewToComment", () => {
    it("should convert a GitHub review into a comment with state prefix", () => {
      const rawReview: GitHubReview = {
        id: 777123,
        user: "lead-reviewer",
        body: "Approved with minor suggestions on types.",
        state: "APPROVED",
        submittedAt: "2025-03-03T10:00:00Z",
      };

      const comment = normalizeReviewToComment(rawReview);
      expect(comment).not.toBeNull();
      expect(comment?.githubCommentId).toBe("review_777123");
      expect(comment?.author).toBe("lead-reviewer");
      expect(comment?.body).toBe(
        "[Review: APPROVED] Approved with minor suggestions on types.",
      );
      expect(comment?.createdAt.toISOString()).toBe("2025-03-03T10:00:00.000Z");
    });

    it("should return null for empty review with no body and no state", () => {
      expect(
        normalizeReviewToComment({ id: 0, user: "", state: "" }),
      ).toBeNull();
    });
  });
});
