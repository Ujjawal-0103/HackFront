import { Module, Global, forwardRef } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { WorkspacesModule } from "../workspaces/workspaces.module";

@Global()
@Module({
  imports: [forwardRef(() => WorkspacesModule)],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
