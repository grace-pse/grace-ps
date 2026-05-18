import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}
