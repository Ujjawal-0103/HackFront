import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  LoginRequest,
  LoginResponse,
  AuthSessionResponse,
  RegisterRequest,
} from "@traceback/shared-types";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentUser } from "./current-user.decorator";
import { AuthenticatedUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterRequest): Promise<LoginResponse> {
    return this.authService.register(body);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Get("session")
  @UseGuards(AuthGuard)
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthSessionResponse> {
    return this.authService.getSession(user.id);
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  async logout(
    @Headers("authorization") authHeader?: string,
  ): Promise<{ success: boolean; message: string }> {
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7).trim()
        : "";
    return this.authService.logout(token);
  }
}
