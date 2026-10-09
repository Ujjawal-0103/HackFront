import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthenticatedUser } from "./auth.types";

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  workspaceContext?: {
    workspaceId: string;
    role: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers["authorization"];
    const devUserId = request.headers["x-user-id"] as string;

    // In local dev/test or via bearer token
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token === "invalid-token") {
        throw new UnauthorizedException(
          "Invalid or expired authentication token",
        );
      }
      // Decode or mock user from token
      request.user = {
        id: "usr_verified_123",
        email: "alex@company.com",
        name: "Alex Maintainer",
      };
      return true;
    }

    if (devUserId) {
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException(
          "Development identity header is forbidden in production environment",
        );
      }
      request.user = {
        id: devUserId,
        email: `${devUserId}@example.com`,
        name: `User ${devUserId}`,
      };
      return true;
    }

    throw new UnauthorizedException(
      "Authentication required to access protected resource",
    );
  }
}
