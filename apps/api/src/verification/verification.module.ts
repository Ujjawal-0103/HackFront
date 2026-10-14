import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EvidenceModule } from "../evidence/evidence.module";
import { AuthModule } from "../auth/auth.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { ClaimExtractorService } from "./claim-extractor.service";
import { CitationValidatorService } from "./citation-validator.service";
import { AbstentionHandlerService } from "./abstention-handler.service";
import { ClaimAssessmentService } from "./claim-assessment.service";
import { VerificationSessionService } from "./verification-session.service";
import { VerificationController } from "./verification.controller";

@Module({
  imports: [PrismaModule, EvidenceModule, AuthModule, WorkspacesModule],
  controllers: [VerificationController],
  providers: [
    ClaimExtractorService,
    CitationValidatorService,
    AbstentionHandlerService,
    ClaimAssessmentService,
    VerificationSessionService,
  ],
  exports: [
    ClaimExtractorService,
    CitationValidatorService,
    AbstentionHandlerService,
    ClaimAssessmentService,
    VerificationSessionService,
  ],
})
export class VerificationModule {}
