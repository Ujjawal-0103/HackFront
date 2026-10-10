import { IsOptional, IsIn } from "class-validator";
import { SyncTrigger } from "@traceback/shared-types";

export class TriggerSyncDto {
  @IsOptional()
  @IsIn(["MANUAL", "WEBHOOK"], {
    message: 'trigger must be either "MANUAL" or "WEBHOOK"',
  })
  trigger?: SyncTrigger;
}
