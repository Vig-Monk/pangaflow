// =============================================================================
// soko-api/src/modules/auth/auth.queries.ts
// Database access layer for auth. Raw pg only.
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { Organization, OrgMember, Role, User } from '../../types/models';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreateOrgInput {
  name: string;
  slug: string;
  businessType: string;
}

export interface CreateOrgMemberInput {
  orgId: string;
  userId: string;
  role: string;
}

export interface StoreRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked: boolean;
}

export interface UserWithOrgContext extends User {
  org_id: string;
  role: Role;
}

export async function createUser(
  client: PoolClient,
  data: CreateUserInput
): Promise<User> {
  const result = await client.query<User>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, name, avatar_url, created_at, updated_at, deleted_at`,
    [data.email.trim().toLowerCase(), data.passwordHash, data.name.trim()]
  );

  return result.rows[0];
}

export async function findUserByEmail(
  email: string
): Promise<UserWithOrgContext | null> {
  const result = await query<UserWithOrgContext>(
    `SELECT u.id, u.email, u.password_hash, u.name, u.avatar_url,
            u.created_at, u.updated_at, u.deleted_at,
            om.org_id, om.role
     FROM users u
     INNER JOIN org_members om ON om.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1) AND u.deleted_at IS NULL
     ORDER BY om.joined_at ASC
     LIMIT 1`,
    [email.trim()]
  );

  return result.rows[0] ?? null;
}

export async function findUserById(
  userId: string
): Promise<UserWithOrgContext | null> {
  const result = await query<UserWithOrgContext>(
    `SELECT u.id, u.email, u.password_hash, u.name, u.avatar_url,
            u.created_at, u.updated_at, u.deleted_at,
            om.org_id, om.role
     FROM users u
     INNER JOIN org_members om ON om.user_id = u.id
     WHERE u.id = $1 AND u.deleted_at IS NULL
     ORDER BY om.joined_at ASC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function createOrg(
  client: PoolClient,
  data: CreateOrgInput
): Promise<Organization> {
  const result = await client.query<Organization>(
    `INSERT INTO organizations (name, slug, business_type)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, business_type, plan, plan_expires_at,
               settings, created_at, updated_at, deleted_at`,
    [data.name.trim(), data.slug.trim().toLowerCase(), data.businessType]
  );

  return result.rows[0];
}

export async function findOrgBySlug(slug: string): Promise<Organization | null> {
  const result = await query<Organization>(
    `SELECT id, name, slug, business_type, plan, plan_expires_at,
            settings, created_at, updated_at, deleted_at
     FROM organizations
     WHERE slug = $1 AND deleted_at IS NULL`,
    [slug.trim().toLowerCase()]
  );

  return result.rows[0] ?? null;
}

export async function findOrgById(orgId: string): Promise<Organization | null> {
  const result = await query<Organization>(
    `SELECT id, name, slug, business_type, plan, plan_expires_at,
            settings, created_at, updated_at, deleted_at
     FROM organizations
     WHERE id = $1 AND deleted_at IS NULL`,
    [orgId]
  );

  return result.rows[0] ?? null;
}

export async function createOrgMember(
  client: PoolClient,
  data: CreateOrgMemberInput
): Promise<OrgMember> {
  const result = await client.query<OrgMember>(
    `INSERT INTO org_members (org_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING id, org_id, user_id, role, joined_at`,
    [data.orgId, data.userId, data.role]
  );

  return result.rows[0];
}

export async function storeRefreshToken(
  client: PoolClient,
  data: StoreRefreshTokenInput
): Promise<void> {
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [data.userId, data.tokenHash, data.expiresAt]
  );
}

export async function findRefreshToken(
  tokenHash: string
): Promise<RefreshTokenRow | null> {
  const result = await query<RefreshTokenRow>(
    `SELECT id, user_id, expires_at, revoked
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
    [userId]
  );
}