import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
} from "class-validator";
import {
  CheckChangeAgainstDecisionsRequest,
  CheckChangeAgainstDecisionsResponse,
  HistoricalConflict,
  AdvisoryStatus,
  AdvisorySeverity,
} from "@traceback/shared-types";

export class CheckChangeAgainstDecisionsDto implements CheckChangeAgainstDecisionsRequest {
  @IsOptional()
  @IsString()
  repositoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000, {
    message: "Diff length exceeds maximum limit of 20,000 characters",
  })
  diff?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, {
    message: "Change description exceeds maximum limit of 5,000 characters",
  })
  changeDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: "File path exceeds maximum limit of 500 characters",
  })
  filePath?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  pullRequestNumber?: number;
}

export class RunHistoricalIntentCheckDto {
  @IsString()
  @MaxLength(25000, {
    message: "Diff length exceeds maximum limit of 25,000 characters",
  })
  diff: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  filePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  changeDescription?: string;
}

export class RecordIntentDispositionDto {
  @IsString()
  disposition: "APPROVED" | "REJECTED" | "NEEDS_DISCUSSION";

  @IsOptional()
  @IsString()
  notes?: string;
}
