import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth.types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
