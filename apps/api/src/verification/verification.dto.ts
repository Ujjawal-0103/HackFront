import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
} from "class-validator";

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
