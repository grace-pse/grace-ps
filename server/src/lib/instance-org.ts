import type { Organization } from '@prisma/client';
import { prisma } from './prisma.js';

let cached: Organization | null = null;

export async function getInstanceOrg(): Promise<Organization> {
  if (cached) return cached;
  const org = await prisma.organization.findFirst();
  if (!org) {
    throw new Error(
      'Instance not bootstrapped — POST /api/auth/register to create the singleton organization.',
    );
  }
  cached = org;
  return cached;
}

export async function getInstanceOrgOrNull(): Promise<Organization | null> {
  if (cached) return cached;
  const org = await prisma.organization.findFirst();
  if (org) cached = org;
  return cached;
}

export function invalidateInstanceOrg(): void {
  cached = null;
}
