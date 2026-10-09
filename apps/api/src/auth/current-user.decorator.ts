import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from './auth.guard';
import { AuthenticatedUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
