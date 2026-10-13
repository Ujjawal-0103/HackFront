import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { EvidenceSourceType } from "@prisma/client";

export class EvidenceSearchDto {
  @IsString()
  @MaxLength(1000)
  query!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EvidenceSourceType, { each: true })
  sourceTypes?: EvidenceSourceType[];

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  until?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsBoolean()
  includeGraph?: boolean;
}
