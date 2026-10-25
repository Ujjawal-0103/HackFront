import { IsString, IsNotEmpty } from "class-validator";
export {
  CreateRepositoryDto,
  ImportRepositoryByUrlResponse,
} from "@traceback/shared-types";

export class ImportRepositoryByUrlDto {
  @IsString()
  @IsNotEmpty()
  url!: string;
}
