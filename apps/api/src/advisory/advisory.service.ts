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
  HistoricalIntentOutcome,
  HumanDisposition,
  IntentConflictItem,
  HistoricalIntentCheckSessionDto,
  RunHistoricalIntentCheckRequest,
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

    // Check for conflicts against persistent Engineering Decision Memory
    const decisions = this.prisma.engineeringDecision
      ? await this.prisma.engineeringDecision.findMany({
          where: {
            repositoryId,
            status: { in: ["ACCEPTED", "IN_REVIEW"] },
          },
        })
      : [];

    for (const dec of decisions) {
      const pathMatch = dec.targetFilePath && targetFiles.some((f) => f.includes(dec.targetFilePath!) || dec.targetFilePath!.includes(f));
      const keywordMatch = targetKeywords.some(
        (kw) =>
          dec.title.toLowerCase().includes(kw) ||
          dec.decision.toLowerCase().includes(kw) ||
          dec.rationale.toLowerCase().includes(kw),
      );
      const symbolMatch = dec.targetSymbol && (sanitizedDiff.includes(dec.targetSymbol) || sanitizedDesc.includes(dec.targetSymbol));

      if (pathMatch || symbolMatch || keywordMatch) {
        const isAccepted = dec.status === "ACCEPTED";
        conflicts.push({
          conflictId: `conflict-decision-${dec.id}`,
          historicalConstraint: `Reviewed Engineering Decision: ${dec.title}`,
          severity: isAccepted ? (dec.severity as any) || "HIGH" : "MEDIUM",
          severityBasis: isAccepted
            ? `Change modifies a code area governed by an ACCEPTED engineering decision (${dec.id}).`
            : `Change touches a candidate engineering decision under review (${dec.id}).`,
          explanation: `Engineering Decision (${dec.status}): "${dec.decision}". Rationale: "${dec.rationale}". Target scope: ${dec.targetFilePath || dec.targetSymbol || "repository"}.`,
          supportingEvidence: ((dec.supportingEvidence as any[]) || []).map((ev: any) => ({
            id: ev.id || dec.id,
            sourceType: ev.sourceType || "DOCUMENTATION",
            referenceKey: ev.referenceKey || dec.relatedCommitSha || `DEC-${dec.id.slice(0, 8)}`,
            title: ev.title || dec.title,
            author: ev.author || dec.reviewerName || "Engineering Team",
            timestamp: ev.timestamp || dec.createdAt.toISOString(),
            url: ev.url || "",
            snippet: ev.snippet || dec.decision,
            filePath: ev.filePath || dec.targetFilePath || undefined,
          })),
          recommendedFollowUp: `Review decision ${dec.id}. If this change intentionally alters the constraint, propose an updated or superseding decision record.`,
        });
      }
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
    } else if (relevantSources.length === 0 && decisions.length === 0) {
      advisoryStatus = "INSUFFICIENT_EVIDENCE";
      summary =
        "No historical decisions, ADRs, or related commit history found for the target scope. Absence of evidence does not prove the change is risk-free.";
      limitations.push(
        "No indexed documentation, decisions, or commits match the modified file paths.",
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
      inspectedSourcesCount: relevantSources.length + decisions.length,
      evaluatedAt: new Date().toISOString(),
      repositoryId,
      targetFilePath: primaryFile,
    };
  }

  /**
   * Flagship Feature Two: Historical Intent Check
   * Runs advisory check against prospective code change and records an auditable session.
   */
  async runHistoricalIntentCheck(
    options: {
      workspaceId: string;
      repositoryId: string;
      diff: string;
      filePath?: string;
      changeDescription?: string;
    },
  ): Promise<HistoricalIntentCheckSessionDto> {
    const { workspaceId, repositoryId, diff, filePath, changeDescription } = options;
    await this.verifyRepositoryAccess(workspaceId, repositoryId);

    const checkResult = await this.checkChangeAgainstDecisions({
      workspaceId,
      repositoryId,
      diff,
      filePath,
      changeDescription,
    });

    // Map to HistoricalIntentOutcome
    let outcome: HistoricalIntentOutcome = "NO_KNOWN_CONFLICT";
    if (checkResult.advisoryStatus === "CONFLICT_DETECTED") {
      outcome = "DOCUMENTED_CONFLICT";
    } else if (checkResult.advisoryStatus === "POTENTIAL_RISK") {
      outcome = "POTENTIAL_CONFLICT";
    } else if (checkResult.advisoryStatus === "INSUFFICIENT_EVIDENCE" || (!diff.trim() && !changeDescription?.trim())) {
      outcome = "INSUFFICIENT_CONTEXT";
    }

    const intentConflicts: IntentConflictItem[] = checkResult.conflicts.map((c) => ({
      id: c.conflictId,
      title: c.historicalConstraint,
      affectedCodeOrSymbol: filePath || undefined,
      severity: c.severity,
      outcome: outcome,
      rationale: c.explanation,
      unestablishedContext: c.severityBasis,
      supportingEvidence: c.supportingEvidence,
      recommendedReview: c.recommendedFollowUp,
    }));

    let sessionId = `intent-${Date.now()}`;
    let createdAt = new Date();
    let updatedAt = new Date();
    let humanDisposition: string | null = null;
    let dispositionNotes: string | null = null;

    if (this.prisma.intentCheckSession) {
      const session = await this.prisma.intentCheckSession.create({
        data: {
          workspaceId,
          repositoryId,
          diff: diff || "",
          filePath: filePath || null,
          changeDescription: changeDescription || null,
          status: "COMPLETED",
          conflicts: intentConflicts as any,
        },
      });
      sessionId = session.id;
      createdAt = session.createdAt;
      updatedAt = session.updatedAt;
      humanDisposition = session.humanDisposition;
      dispositionNotes = session.dispositionNotes;
    }

    this.logger.log(`Created intent check session ${sessionId} with outcome ${outcome}`);

    return {
      id: sessionId,
      workspaceId,
      repositoryId,
      diff: diff || "",
      filePath: filePath || null,
      changeDescription: changeDescription || null,
      status: "COMPLETED",
      outcome,
      summary: checkResult.summary,
      conflicts: intentConflicts,
      humanDisposition: (humanDisposition as any) || null,
      dispositionNotes,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  async listIntentCheckSessions(
    workspaceId: string,
    repositoryId: string,
  ): Promise<HistoricalIntentCheckSessionDto[]> {
    await this.verifyRepositoryAccess(workspaceId, repositoryId);

    const records = await this.prisma.intentCheckSession.findMany({
      where: { workspaceId, repositoryId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return records.map((r) => this.mapIntentSessionToDto(r));
  }

  async getIntentCheckSession(
    workspaceId: string,
    repositoryId: string,
    sessionId: string,
  ): Promise<HistoricalIntentCheckSessionDto> {
    await this.verifyRepositoryAccess(workspaceId, repositoryId);

    const record = await this.prisma.intentCheckSession.findFirst({
      where: { id: sessionId, workspaceId, repositoryId },
    });

    if (!record) {
      throw new NotFoundException(`Intent check session ${sessionId} not found.`);
    }

    return this.mapIntentSessionToDto(record);
  }

  async recordIntentDisposition(
    workspaceId: string,
    repositoryId: string,
    sessionId: string,
    disposition: HumanDisposition,
    notes?: string,
  ): Promise<HistoricalIntentCheckSessionDto> {
    await this.getIntentCheckSession(workspaceId, repositoryId, sessionId);

    const updated = await this.prisma.intentCheckSession.update({
      where: { id: sessionId },
      data: {
        humanDisposition: disposition,
        dispositionNotes: notes?.trim() || null,
      },
    });

    return this.mapIntentSessionToDto(updated);
  }

  private mapIntentSessionToDto(record: any): HistoricalIntentCheckSessionDto {
    const conflicts = (record.conflicts as IntentConflictItem[]) || [];
    let outcome: HistoricalIntentOutcome = "NO_KNOWN_CONFLICT";
    if (conflicts.some((c) => c.severity === "HIGH")) {
      outcome = "DOCUMENTED_CONFLICT";
    } else if (conflicts.length > 0) {
      outcome = "POTENTIAL_CONFLICT";
    }

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      repositoryId: record.repositoryId,
      diff: record.diff,
      filePath: record.filePath,
      changeDescription: record.changeDescription,
      status: record.status,
      outcome,
      summary: conflicts.length > 0
        ? `Identified ${conflicts.length} conflict(s) or historical decision overlap(s).`
        : "No direct conflicts with recorded historical decisions were detected.",
      conflicts,
      humanDisposition: (record.humanDisposition as any) || null,
      dispositionNotes: record.dispositionNotes || null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
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
