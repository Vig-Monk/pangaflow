// =============================================================================
// src/modules/auth/auth.queries.ts
// Database access layer for auth. Raw pg only. No business logic.
// =============================================================================

import { PoolClient } from 'pg';
import { query } from '../../config/db';
import { Organization, OrgMember, Role, User } from '../../types/models';

// ---------------------------------------------------------------------------
// Input typesp
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Creates a user row. Must be called with a transactional client during
 * registration, since it is always paired with an organizations + org_members
 * insert in the same atomic operation.
 */
export async function createUser(
  client: PoolClient,
  data: CreateUserInput
): Promise<User> {
  const result = await client.query<User>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, name, avatar_url, created_at, updated_at, deleted_at`,
    [data.email, data.passwordHash, data.name]
  );

  return result.rows[0];
}

/**
 * Finds a user by email, joined with their first/primary org membership.
 * Used by login. Returns null if no user exists with this email, or if the
 * user has no org membership (which should never happen post-registration,
 * but the type signature reflects that the join can legitimately miss).
 *
 * Excludes soft-deleted users.
 */
export async function findUserByEmail(
  email: string
): Promise<UserWithOrgContext | null> {
  const result = await query<UserWithOrgContext>(
    `SELECT u.id, u.email, u.password_hash, u.name, u.avatar_url,
            u.created_at, u.updated_at, u.deleted_at,
            om.org_id, om.role
     FROM users u
     INNER JOIN org_members om ON om.user_id = u.id
     WHERE u.email = $1 AND u.deleted_at IS NULL
     ORDER BY om.joined_at ASC
     LIMIT 1`,
    [email]
  );

  return result.rows[0] ?? null;
}

/**
 * Finds a user by id, joined with org membership. Used to rehydrate
 * req.user / req.orgId / req.role from a verified JWT.
 */
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

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

/**
 * Creates an organization row. Called inside the same registration
 * transaction as createUser and createOrgMember.
 */
export async function createOrg(
  client: PoolClient,
  data: CreateOrgInput
): Promise<Organization> {
  const result = await client.query<Organization>(
    `INSERT INTO organizations (name, slug, business_type)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, business_type, plan, plan_expires_at,
               settings, created_at, updated_at, deleted_at`,
    [data.name, data.slug, data.businessType]
  );

  return result.rows[0];
}

/**
 * Checks whether a slug is already taken. Used during registration to
 * generate a unique slug before the insert (avoids relying on the unique
 * constraint violation as the primary control flow signal).
 */
export async function findOrgBySlug(slug: string): Promise<Organization | null> {
  const result = await query<Organization>(
    `SELECT id, name, slug, business_type, plan, plan_expires_at,
            settings, created_at, updated_at, deleted_at
     FROM organizations
     WHERE slug = $1 AND deleted_at IS NULL`,
    [slug]
  );

  return result.rows[0] ?? null;
}
/**
 * Finds an organization by id. Used by login() to hydrate the org
 * returned alongside the token pair.
 */
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

// ---------------------------------------------------------------------------
// Org membership
// ---------------------------------------------------------------------------

/**
 * Links a user to an org with a role. Called inside the registration
 * transaction, immediately after createUser and createOrg.
 */
 
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

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

/**
 * Stores a refresh token hash. Called inside the issuing transaction
 * (register, login, or refresh-rotation).
 */
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

/**
 * Finds a refresh token by its hash. Used to validate an incoming refresh
 * request before rotating it. Does not filter on `revoked` or `expires_at`
 * here — the service layer makes those checks explicit so the reason for
 * rejection (revoked vs. expired vs. not found) is distinguishable.
 */
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

/**
 * Revokes a single refresh token by its hash. Called on logout and as the
 * first step of refresh rotation (the old token is revoked before the new
 * one is issued).
 */
export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [tokenHash]
  );
}

/**
 * Revokes every refresh token belonging to a user. Used for reuse-detection:
 * if a revoked or expired token is presented for refresh, every token for
 * that user is revoked on the assumption the token has been compromised.
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
    [userId]
  );
}