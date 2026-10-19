import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceSearchService } from "../evidence/evidence-search.service";
import { redactSecrets, truncateDiff } from "../ingestion/diff-sanitizer";
import {
  CheckChangeAgainstDecisionsResponse,
  HistoricalConflict,
  AdvisoryStatus,
  AdvisorySeverity,
  EvidenceReference,
  SourceRecordDto,
} from "@traceback/shared-types";
import { CheckChangeAgainstDecisionsDto } from "./advisory.dto";

export interface CheckChangeOptions extends CheckChangeAgainstDecisionsDto {
  workspaceId: string;
  repositoryId: string;
}

@Injectable()
export class AdvisoryService {
  private readonly logger = new Logger(AdvisoryService.name);

  public static readonly MAX_DIFF_CHARS = 20000;
  public static readonly MAX_DESC_CHARS = 5000;

  private readonly INJECTION_PATTERNS = [
    /<\/?(?:system|prompt|instruction|developer|admin)[^>]*>/gi,
    /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/gi,
    /disregard\s+(?:all\s+)?(?:prior\s+)?(?:rules|prompts|decisions)/gi,
    /mark\s+(?:as\s+)?safe/gi,
    /no\s+conflict\s+detected/gi,
    /approve\s+(?:this\s+)?(?:pr|change|merge)/gi,
    /bypass\s+check/gi,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceSearch: EvidenceSearchService,
  ) {}

  /**
   * Evaluates a proposed code change or diff against historical decisions,
   * architectural constraints (ADRs), past rollbacks, and recorded invariants.
   *
   * STRICT SAFETY BOUNDARY:
   * This check is purely advisory and read-only. It never modifies code,
   * commits changes, approves PRs, or blocks deployment.
   */
  async checkChangeAgainstDecisions(
    options: CheckChangeOptions,
  ): Promise<CheckChangeAgainstDecisionsResponse> {
    const { workspaceId, repositoryId } = options;

    // 1. Validate repository access and workspace ownership
    await this.verifyRepositoryAccess(workspaceId, repositoryId);

    // 2. Validate input presence and length
    const rawDiff = options.diff?.trim() || "";
    const rawDesc = options.changeDescription?.trim() || "";

    if (!rawDiff && !rawDesc && !options.pullRequestNumber) {
      throw new BadRequestException(
        "Either a proposed diff, change description, or pull request number must be provided for advisory analysis.",
      );
    }

    if (rawDiff.length > AdvisoryService.MAX_DIFF_CHARS) {
      throw new BadRequestException(
        `Proposed diff exceeds maximum permitted length of ${AdvisoryService.MAX_DIFF_CHARS} characters.`,
      );
    }

    if (rawDesc.length > AdvisoryService.MAX_DESC_CHARS) {
      throw new BadRequestException(
        `Change description exceeds maximum permitted length of ${AdvisoryService.MAX_DESC_CHARS} characters.`,
      );
    }

    // 3. Sanitize inputs and wrap in untrusted boundary delimiters
    const sanitizedDiff = this.sanitizeDiffText(rawDiff);
    const sanitizedDesc = this.sanitizeText(rawDesc);

    // 4. Extract target files and symbols from diff / options
    const targetFiles = this.extractTargetFiles(
      sanitizedDiff,
      options.filePath,
    );
    const targetKeywords = this.extractChangeKeywords(
      sanitizedDiff,
      sanitizedDesc,
    );

    // 5. Query historical evidence and decisions
    const primaryFile = targetFiles[0] || options.filePath;
    const searchTerms = [
      primaryFile ? primaryFile.split(/[\\/]/).pop() : "",
      ...targetKeywords,
    ]
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");

    const query = searchTerms || "architectural decision ADR revert constraint";

    const searchResponse = await this.evidenceSearch.search({
      workspaceId,
      repositoryId,
      query,
      filePath: primaryFile,
      limit: 15,
    });

    const relevantSources = (searchResponse.items || []).map(
      (item) => item.source,
    );

    // 6. Inspect records for ADRs, constraints, past reverts, and safeguard removals
    const conflicts: HistoricalConflict[] = [];
    const limitations: string[] = [];

    // Check for removed mutex / lock / concurrency guards
    if (this.detectRemovedMutex(sanitizedDiff)) {
      const lockEvidence = relevantSources.filter(
        (s) =>
          s.title.toLowerCase().includes("mutex") ||
          s.title.toLowerCase().includes("lock") ||
          s.title.toLowerCase().includes("race") ||
          (s.snippet && s.snippet.toLowerCase().includes("mutex")) ||
          (s.snippet && s.snippet.toLowerCase().includes("race condition")),
      );

      conflicts.push({
        conflictId: `conflict-${Date.now()}-mutex`,
        historicalConstraint:
          "Concurrency Synchronization & Mutex Locking Invariant",
        severity: "HIGH",
        severityBasis:
          "Removal of mutex locking in concurrency-sensitive operations historically introduced race conditions and state corruption.",
        explanation:
          "The proposed diff removes or disables a mutex/lock synchronization mechanism that was historically added to protect shared resource integrity.",
        supportingEvidence: lockEvidence.map((e) =>
          this.mapEvidenceReference(e),
        ),
        recommendedFollowUp:
          "Verify concurrency safety with multi-threaded stress tests or retain the mutex lock.",
      });
    }

    // Check for disabled auth / token verification
    if (this.detectDisabledSecurity(sanitizedDiff)) {
      conflicts.push({
        conflictId: `conflict-${Date.now()}-auth`,
        historicalConstraint:
          "Authentication & Authorization Verification Invariant",
        severity: "HIGH",
        severityBasis:
          "Disabling authentication or bypass of security guards exposes protected workspace data.",
        explanation:
          "The proposed diff appears to bypass, comment out, or remove security authorization checks.",
        supportingEvidence: relevantSources
          .filter(
            (s) =>
              s.title.toLowerCase().includes("auth") ||
              s.title.toLowerCase().includes("security"),
          )
          .map((e) => this.mapEvidenceReference(e)),
        recommendedFollowUp:
          "Ensure authentication guards and session validations remain strictly active.",
      });
    }

    // Check for matches against historical reverts or rollbacks
    const historicalReverts = relevantSources.filter(
      (s) =>
        s.title.toLowerCase().includes("revert") ||
        s.title.toLowerCase().includes("rollback"),
    );

    for (const revert of historicalReverts) {
      // If the change keywords match the reverted change description
      const hasOverlap = targetKeywords.some((kw) =>
        revert.title.toLowerCase().includes(kw.toLowerCase()),
      );
      if (hasOverlap) {
        conflicts.push({
          conflictId: `conflict-${revert.id}-revert`,
          historicalConstraint: `Historical Commit Reversion: ${revert.referenceKey}`,
          severity: "MEDIUM",
          severityBasis:
            "Re-introduction of code patterns that were previously reverted in the repository history.",
          explanation: `A previous commit (${revert.referenceKey}: "${revert.title}") was explicitly reverted. The proposed change re-touches this area with similar changes.`,
          supportingEvidence: [this.mapEvidenceReference(revert)],
          recommendedFollowUp:
            "Review the historical PR/commit discussion for the revert to verify if the root issue was addressed.",
        });
      }
    }

    // Check for explicit ADR (Architecture Decision Record) conflicts
    const adrRecords = relevantSources.filter(
      (s) =>
        s.sourceType === "DOCUMENTATION" &&
        (s.title.toUpperCase().includes("ADR") ||
          (s.filePath && s.filePath.toUpperCase().includes("ADR"))),
    );

    for (const adr of adrRecords) {
      conflicts.push({
        conflictId: `conflict-${adr.id}-adr`,
        historicalConstraint: `Documented Architecture Decision: ${adr.title}`,
        severity: "MEDIUM",
        severityBasis:
          "Proposed modifications touch architectural components governed by recorded decision records.",
        explanation: `Historical record "${adr.title}" documents architectural invariants for this component. Verify the proposed change conforms to the documented decisions.`,
        supportingEvidence: [this.mapEvidenceReference(adr)],
        recommendedFollowUp:
          "Review the ADR document and verify design compatibility before proceeding.",
      });
    }

    // 7. Determine overall advisory status
    let advisoryStatus: AdvisoryStatus = "NO_CONFLICT_DETECTED";
    let summary =
      "No direct conflicts with recorded historical decisions or past reversions were detected.";

    if (conflicts.some((c) => c.severity === "HIGH")) {
      advisoryStatus = "CONFLICT_DETECTED";
      summary = `Detected ${conflicts.length} possible historical conflict(s), including high-severity invariant violations. Review historical evidence citations below.`;
    } else if (conflicts.length > 0) {
      advisoryStatus = "POTENTIAL_RISK";
      summary = `Identified ${conflicts.length} potential risk(s) or historical decision overlap(s). Advisory review recommended.`;
    } else if (relevantSources.length === 0) {
      advisoryStatus = "INSUFFICIENT_EVIDENCE";
      summary =
        "No historical decisions, ADRs, or related commit history found for the target scope. Absence of evidence does not prove the change is risk-free.";
      limitations.push(
        "No indexed documentation or commits match the modified file paths.",
      );
    }

    if (rawDiff.length === 0 && rawDesc.length > 0) {
      limitations.push(
        "Change analysis was performed on textual description only; concrete diff inspection provides higher confidence.",
      );
    }

    return {
      advisoryStatus,
      summary,
      conflicts,
      advisoryNotice:
        "This analysis is advisory only. Traceback does not block merges, approve pull requests, or alter source code. Human review is required.",
      limitations,
      inspectedSourcesCount: relevantSources.length,
      evaluatedAt: new Date().toISOString(),
      repositoryId,
      targetFilePath: primaryFile,
    };
  }

  private async verifyRepositoryAccess(
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    const repo = await this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        workspaceId,
      },
      select: { id: true, fullName: true },
    });

    if (!repo) {
      throw new NotFoundException(
        `Repository "${repositoryId}" not found in workspace "${workspaceId}".`,
      );
    }
  }

  private sanitizeDiffText(diff: string): string {
    if (!diff) return "";
    const redacted = redactSecrets(diff);
    const { text } = truncateDiff(redacted, AdvisoryService.MAX_DIFF_CHARS);

    let sanitized = text;
    for (const pattern of this.INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[SANITIZED_DIRECTIVE]");
    }
    return `<untrusted_diff>\n${sanitized}\n</untrusted_diff>`;
  }

  private sanitizeText(text: string): string {
    if (!text) return "";
    let sanitized = text;
    for (const pattern of this.INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[SANITIZED_DIRECTIVE]");
    }
    return sanitized;
  }

  private extractTargetFiles(diff: string, overridePath?: string): string[] {
    const files: string[] = [];
    if (overridePath) {
      files.push(overridePath);
    }

    const diffFileRegex =
      /(?:^\+\+\+\s+b\/|^---\s+a\/|diff --git a\/.* b\/)(.*)$/gm;
    let match: RegExpExecArray | null;
    while ((match = diffFileRegex.exec(diff)) !== null) {
      const path = match[1]?.trim();
      if (path && path !== "/dev/null" && !files.includes(path)) {
        files.push(path);
      }
    }
    return files;
  }

  private extractChangeKeywords(diff: string, description: string): string[] {
    const combined = `${diff} ${description}`.toLowerCase();
    const keywords: string[] = [];

    const candidateTerms = [
      "mutex",
      "lock",
      "cache",
      "timeout",
      "retry",
      "token",
      "auth",
      "session",
      "cors",
      "transaction",
      "revert",
      "memory",
      "leak",
    ];

    for (const term of candidateTerms) {
      if (combined.includes(term) && !keywords.includes(term)) {
        keywords.push(term);
      }
    }
    return keywords;
  }

  private detectRemovedMutex(diff: string): boolean {
    const removedLineRegex = /^-\s*.*(?:mutex|lock|acquire|release).*$/im;
    return removedLineRegex.test(diff);
  }

  private detectDisabledSecurity(diff: string): boolean {
    const disabledAuthRegex =
      /^-\s*.*(?:authguard|verifytoken|isauthenticated|validatecredentials).*$/im;
    const bypassRegex =
      /^\+\s*.*(?:skipauth|bypassauth|admin = true|unauthenticated = true).*$/im;
    return disabledAuthRegex.test(diff) || bypassRegex.test(diff);
  }

  private mapEvidenceReference(source: SourceRecordDto): EvidenceReference {
    return {
      id: source.id,
      sourceType: source.sourceType,
      referenceKey: source.referenceKey,
      title: source.title,
      author: source.author,
      timestamp: source.recordedAt,
      url: source.url,
      snippet: source.snippet,
      filePath: source.filePath,
    };
  }
}
