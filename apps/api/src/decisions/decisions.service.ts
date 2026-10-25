import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  ReviewDecisionDto,
  SupersedeDecisionDto,
  ProposeFromClaimDto,
} from "./decisions.dto";
import {
  DecisionStatus,
  DecisionSeverity,
  EngineeringDecisionDto,
  EvidenceReference,
} from "@traceback/shared-types";
import { AuthenticatedUser } from "../auth/auth.types";

@Injectable()
export class DecisionsService {
  private readonly logger = new Logger(DecisionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async verifyRepository(workspaceId: string, repositoryId: string) {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repositoryId, workspaceId },
    });
    if (!repo) {
      throw new NotFoundException(
        `Repository ${repositoryId} not found in workspace ${workspaceId}.`,
      );
    }
    return repo;
  }

  async listDecisions(
    workspaceId: string,
    repositoryId: string,
    status?: DecisionStatus,
  ): Promise<EngineeringDecisionDto[]> {
    await this.verifyRepository(workspaceId, repositoryId);

    const where: any = { workspaceId, repositoryId };
    if (status) {
      where.status = status;
    }

    const records = await this.prisma.engineeringDecision.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => this.mapDecisionToDto(r));
  }

  async getDecisionById(
    workspaceId: string,
    repositoryId: string,
    id: string,
  ): Promise<EngineeringDecisionDto> {
    await this.verifyRepository(workspaceId, repositoryId);

    const record = await this.prisma.engineeringDecision.findFirst({
      where: { id, workspaceId, repositoryId },
    });

    if (!record) {
      throw new NotFoundException(`Engineering decision ${id} not found.`);
    }

    return this.mapDecisionToDto(record);
  }

  async createDecision(
    workspaceId: string,
    repositoryId: string,
    dto: CreateDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.verifyRepository(workspaceId, repositoryId);

    const record = await this.prisma.engineeringDecision.create({
      data: {
        workspaceId,
        repositoryId,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        decision: dto.decision.trim(),
        rationale: dto.rationale.trim(),
        targetFilePath: dto.targetFilePath?.trim() || null,
        targetSymbol: dto.targetSymbol?.trim() || null,
        status: (dto.status as any) || "CANDIDATE",
        severity: (dto.severity as any) || "MEDIUM",
        supportingEvidence: (dto.supportingEvidence as any) || [],
        relatedCommitSha: dto.relatedCommitSha?.trim() || null,
        relatedPrNumber: dto.relatedPrNumber || null,
        supersedesId: dto.supersedesId || null,
        createdFromClaimId: dto.createdFromClaimId || null,
        reviewerId: user?.id || null,
        reviewerName: user?.name || null,
      },
    });

    this.logger.log(
      `Created engineering decision ${record.id} (${record.status}) for repo ${repositoryId}`,
    );

    return this.mapDecisionToDto(record);
  }

  async updateDecision(
    workspaceId: string,
    repositoryId: string,
    id: string,
    dto: UpdateDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.getDecisionById(workspaceId, repositoryId, id);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.summary !== undefined) updateData.summary = dto.summary.trim();
    if (dto.decision !== undefined) updateData.decision = dto.decision.trim();
    if (dto.rationale !== undefined)
      updateData.rationale = dto.rationale.trim();
    if (dto.targetFilePath !== undefined)
      updateData.targetFilePath = dto.targetFilePath?.trim() || null;
    if (dto.targetSymbol !== undefined)
      updateData.targetSymbol = dto.targetSymbol?.trim() || null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.severity !== undefined) updateData.severity = dto.severity;
    if (dto.reviewNotes !== undefined)
      updateData.reviewNotes = dto.reviewNotes?.trim() || null;
    if (dto.supersedesId !== undefined)
      updateData.supersedesId = dto.supersedesId;
    if (dto.supersededById !== undefined)
      updateData.supersededById = dto.supersededById;

    const updated = await this.prisma.engineeringDecision.update({
      where: { id },
      data: updateData,
    });

    return this.mapDecisionToDto(updated);
  }

  async acceptDecision(
    workspaceId: string,
    repositoryId: string,
    id: string,
    dto: ReviewDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.getDecisionById(workspaceId, repositoryId, id);

    const updated = await this.prisma.engineeringDecision.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        reviewerId: user?.id || null,
        reviewerName: user?.name || "Human Reviewer",
        reviewNotes:
          dto.reviewNotes?.trim() || "Accepted as historical constraint.",
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Decision ${id} accepted by ${user?.name || "anonymous"}`);
    return this.mapDecisionToDto(updated);
  }

  async rejectDecision(
    workspaceId: string,
    repositoryId: string,
    id: string,
    dto: ReviewDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.getDecisionById(workspaceId, repositoryId, id);

    const updated = await this.prisma.engineeringDecision.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        reviewerId: user?.id || null,
        reviewerName: user?.name || "Human Reviewer",
        reviewNotes: dto.reviewNotes?.trim() || "Rejected candidate decision.",
        reviewedAt: new Date(),
      },
    });

    return this.mapDecisionToDto(updated);
  }

  async disputeDecision(
    workspaceId: string,
    repositoryId: string,
    id: string,
    dto: ReviewDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.getDecisionById(workspaceId, repositoryId, id);

    const updated = await this.prisma.engineeringDecision.update({
      where: { id },
      data: {
        status: "DISPUTED",
        reviewerId: user?.id || null,
        reviewerName: user?.name || "Human Reviewer",
        reviewNotes:
          dto.reviewNotes?.trim() || "Decision disputed by reviewer.",
        reviewedAt: new Date(),
      },
    });

    return this.mapDecisionToDto(updated);
  }

  async supersedeDecision(
    workspaceId: string,
    repositoryId: string,
    newDecisionId: string,
    dto: SupersedeDecisionDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    const oldDecision = await this.getDecisionById(
      workspaceId,
      repositoryId,
      dto.supersedesId,
    );

    // Update old decision to SUPERSEDED
    await this.prisma.engineeringDecision.update({
      where: { id: oldDecision.id },
      data: {
        status: "SUPERSEDED",
        supersededById: newDecisionId,
        reviewNotes:
          `Superseded by decision ${newDecisionId}. ${dto.notes || ""}`.trim(),
      },
    });

    // Update new decision to mark what it supersedes
    const updatedNew = await this.prisma.engineeringDecision.update({
      where: { id: newDecisionId },
      data: {
        supersedesId: oldDecision.id,
        status: "ACCEPTED",
        reviewerId: user?.id || null,
        reviewerName: user?.name || null,
        reviewedAt: new Date(),
      },
    });

    return this.mapDecisionToDto(updatedNew);
  }

  async proposeFromClaim(
    workspaceId: string,
    repositoryId: string,
    dto: ProposeFromClaimDto,
    user?: AuthenticatedUser,
  ): Promise<EngineeringDecisionDto> {
    await this.verifyRepository(workspaceId, repositoryId);

    const claim = await this.prisma.claim.findUnique({
      where: { id: dto.claimId },
      include: {
        session: true,
        evidence: true,
      },
    });

    if (!claim) {
      throw new NotFoundException(`Claim ${dto.claimId} not found.`);
    }

    if (
      claim.session.workspaceId !== workspaceId ||
      claim.session.repositoryId !== repositoryId
    ) {
      throw new ForbiddenException(
        "Claim does not belong to the specified workspace or repository.",
      );
    }

    // Convert evidence records to EvidenceReference items
    const evidenceItems: EvidenceReference[] = claim.evidence.map((ev) => ({
      id: ev.id,
      sourceType: ev.sourceType as any,
      referenceKey: ev.referenceKey,
      title: ev.title,
      author: ev.author,
      timestamp: ev.timestamp.toISOString(),
      url: ev.url,
      snippet: ev.snippet || undefined,
      filePath: ev.filePath || undefined,
      lineRange:
        ev.lineStart && ev.lineEnd
          ? { start: ev.lineStart, end: ev.lineEnd }
          : undefined,
    }));

    const title =
      dto.title?.trim() ||
      (claim.targetSymbol
        ? `Architectural Constraint for ${claim.targetSymbol}`
        : claim.text.slice(0, 100));

    const decisionRecord = await this.prisma.engineeringDecision.create({
      data: {
        workspaceId,
        repositoryId,
        title,
        summary: `Derived from verified claim: "${claim.text}"`,
        decision: `Preserve established architectural constraint: ${claim.text}`,
        rationale: `Verified historical evidence confirms this requirement was intentionally implemented. Original session explanation: "${claim.session.explanation.slice(0, 300)}"`,
        targetFilePath:
          claim.session.targetFilePath || (evidenceItems[0]?.filePath ?? null),
        targetSymbol: claim.targetSymbol || null,
        status: "CANDIDATE",
        severity: (dto.severity as any) || "HIGH",
        supportingEvidence: (evidenceItems as any) || [],
        relatedCommitSha:
          evidenceItems.find((e) => e.sourceType === "COMMIT")?.referenceKey ||
          null,
        relatedPrNumber:
          parseInt(
            evidenceItems
              .find((e) => e.sourceType === "PULL_REQUEST")
              ?.referenceKey.replace(/[^0-9]/g, "") || "0",
            10,
          ) || null,
        createdFromClaimId: claim.id,
        reviewerId: user?.id || null,
        reviewerName: user?.name || null,
      },
    });

    this.logger.log(
      `Proposed engineering decision candidate ${decisionRecord.id} from claim ${claim.id}`,
    );

    return this.mapDecisionToDto(decisionRecord);
  }

  private mapDecisionToDto(record: any): EngineeringDecisionDto {
    return {
      id: record.id,
      workspaceId: record.workspaceId,
      repositoryId: record.repositoryId,
      title: record.title,
      summary: record.summary,
      decision: record.decision,
      rationale: record.rationale,
      targetFilePath: record.targetFilePath,
      targetSymbol: record.targetSymbol,
      status: record.status as DecisionStatus,
      severity: record.severity as DecisionSeverity,
      supportingEvidence:
        (record.supportingEvidence as EvidenceReference[]) || [],
      relatedCommitSha: record.relatedCommitSha,
      relatedPrNumber: record.relatedPrNumber,
      reviewerId: record.reviewerId,
      reviewerName: record.reviewerName,
      reviewNotes: record.reviewNotes,
      reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
      supersedesId: record.supersedesId,
      supersededById: record.supersededById,
      createdFromClaimId: record.createdFromClaimId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
