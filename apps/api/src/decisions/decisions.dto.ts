import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  MaxLength,
} from "class-validator";
import { DecisionStatus, DecisionSeverity, EvidenceReference } from "@traceback/shared-types";

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  decision: string;

  @IsString()
  @IsNotEmpty()
  rationale: string;

  @IsOptional()
  @IsString()
  targetFilePath?: string;

  @IsOptional()
  @IsString()
  targetSymbol?: string;

  @IsOptional()
  @IsString()
  status?: DecisionStatus;

  @IsOptional()
  @IsString()
  severity?: DecisionSeverity;

  @IsOptional()
  @IsArray()
  supportingEvidence?: EvidenceReference[];

  @IsOptional()
  @IsString()
  relatedCommitSha?: string;

  @IsOptional()
  @IsInt()
  relatedPrNumber?: number;

  @IsOptional()
  @IsString()
  supersedesId?: string;

  @IsOptional()
  @IsString()
  createdFromClaimId?: string;
}

export class UpdateDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  decision?: string;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsString()
  targetFilePath?: string;

  @IsOptional()
  @IsString()
  targetSymbol?: string;

  @IsOptional()
  @IsString()
  status?: DecisionStatus;

  @IsOptional()
  @IsString()
  severity?: DecisionSeverity;

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  supersedesId?: string;

  @IsOptional()
  @IsString()
  supersededById?: string;
}

export class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class SupersedeDecisionDto {
  @IsString()
  @IsNotEmpty()
  supersedesId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProposeFromClaimDto {
  @IsString()
  @IsNotEmpty()
  claimId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  severity?: DecisionSeverity;
}
