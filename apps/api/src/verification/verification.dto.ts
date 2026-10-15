import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsIn,
} from "class-validator";
import { HumanVerdict } from "@traceback/shared-types";

export class VerifyExplanationDto {
  @IsString()
  @IsNotEmpty({ message: "explanation is required and cannot be empty" })
  @MaxLength(10000, {
    message: "explanation cannot exceed 10,000 characters",
  })
  explanation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, {
    message: "codeSnippet cannot exceed 5,000 characters",
  })
  codeSnippet?: string;

  @IsOptional()
  @IsString()
  targetFilePath?: string;

  @IsOptional()
  @IsString()
  targetSymbol?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxClaims?: number;
}

export class SubmitVerdictDto {
  @IsNotEmpty({ message: "verdict is required" })
  @IsIn(["SUPPORTED", "CONTRADICTED", "UNVERIFIED"], {
    message: "verdict must be SUPPORTED, CONTRADICTED, or UNVERIFIED",
  })
  verdict!: HumanVerdict;

  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: "reviewNotes cannot exceed 2000 characters",
  })
  reviewNotes?: string;
}

export class UpdateClaimDto {
  @IsString()
  @IsNotEmpty({ message: "text is required" })
  @MaxLength(2000, {
    message: "claim text cannot exceed 2000 characters",
  })
  text!: string;
}
