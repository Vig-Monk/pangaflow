// =============================================================================
// src/modules/auth/auth.service.ts
// Business logic for auth: hashing, JWT issuance, refresh rotation.
// =============================================================================

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/error';
import { Organization, Role, User } from '../../types/models';
import {
  createOrg,
  createOrgMember,
  createUser,
  findOrgById,
  findOrgBySlug,
  findRefreshToken,
  findUserByEmail,
  findUserById,
  revokeAllUserTokens,
  revokeRefreshToken,
  storeRefreshToken,
} from './auth.queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  orgName: string;
  businessType: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<User, 'password_hash'>;
  org: Organization;
  tokens: TokenPair;
}

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: Role;
}

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 64;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hashes a refresh token with SHA-256 before storage/lookup. Refresh tokens
 * are high-entropy random strings, not low-entropy user passwords — a fast
 * cryptographic hash is correct here. bcrypt's deliberate slowness exists to
 * resist brute-forcing short, guessable secrets, which does not apply to a
 * 512-bit random token.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a URL-safe slug from an org name, appending a numeric suffix on
 * collision. e.g. "Joy's Cakes" -> "joys-cakes", then "joys-cakes-2".
 */
async function generateUniqueSlug(orgName: string): Promise<string> {
  const base = orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const candidate = base.length > 0 ? base : 'org';

  let slug = candidate;
  let suffix = 1;

  // Bounded loop: a pathological run of collisions on one base slug becomes
  // an explicit error instead of an infinite loop.
  while (suffix < 1000) {
    const existing = await findOrgBySlug(slug);
    if (!existing) {
      return slug;
    }
    suffix += 1;
    slug = `${candidate}-${suffix}`;
  }

  throw new AppError('Could not generate a unique organization slug', 500, false);
}

/**
 * Strips password_hash before a User is ever returned outside this service.
 */
function toSafeUser(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Issues a new access + refresh token pair and persists the refresh token
 * hash. Opens and releases its own single-statement client — this is not
 * used inside the register transaction (register writes its own refresh
 * token row directly, in the same BEGIN/COMMIT block as the user/org
 * inserts), so there is no double-write risk here.
 */
async function generateTokens(
  userId: string,
  orgId: string,
  role: Role
): Promise<TokenPair> {
  const payload: JwtPayload = { userId, orgId, role };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

  const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

  const client = await pool.connect();
  try {
    await storeRefreshToken(client, { userId, tokenHash, expiresAt });
  } finally {
    client.release();
  }

  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

/**
 * Registers a new user + organization + org_member + initial refresh token
 * in a single atomic pg transaction. Any failure rolls back all of it —
 * there is no partial state where a user exists without an org.
 */


    export async function register(data: RegisterInput): Promise<AuthResult> {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const slug = await generateUniqueSlug(data.orgName);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await createUser(client, {
      email: data.email,
      passwordHash,
      name: data.name,
    });

    const org = await createOrg(client, {
      name: data.orgName,
      slug,
      businessType: data.businessType,
    });

    const member = await createOrgMember(client, {
      orgId: org.id,
      userId: user.id,
      role: 'owner',
    });

    const payload: JwtPayload = { userId: user.id, orgId: org.id, role: member.role };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await storeRefreshToken(client, { userId: user.id, tokenHash, expiresAt });

    await client.query('COMMIT');

    return {
      user: toSafeUser(user),
      org,
      tokens: { accessToken, refreshToken },
    };
  } catch (err) {
    await client.query('ROLLBACK');

    // Unique-violation on users.email: race between the existence check
    // above and this insert (or a users row with no org membership, which
    // the existence check's INNER JOIN would miss). Surface it as a clean
    // 409 instead of an unhandled 500.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    ) {
      throw new AppError('An account with this email already exists', 409);
    }

    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export async function login(data: LoginInput): Promise<AuthResult> {
  const userWithOrg = await findUserByEmail(data.email);

  if (!userWithOrg) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(data.password, userWithOrg.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  const org = await findOrgById(userWithOrg.org_id);
  if (!org) {
    // Membership row pointed at an org that no longer exists — data
    // integrity issue, not a client error. Logged as 500, not exposed as 404.
    throw new AppError('Organization not found', 500, false);
  }

  const tokens = await generateTokens(userWithOrg.id, userWithOrg.org_id, userWithOrg.role);

  const { org_id: _orgId, role: _role, ...userFields } = userWithOrg;

  return {
    user: toSafeUser(userFields as User),
    org,
    tokens,
  };
}

// ---------------------------------------------------------------------------
// refreshTokens — rotation with reuse detection
// ---------------------------------------------------------------------------

/**
 * Validates an incoming refresh token, rotates it (revoke old, issue new),
 * and returns a new token pair.
 *
 * Reuse detection: if the presented token is already revoked, this is
 * treated as a signal that a previously-issued token has leaked and is
 * being replayed by an attacker. Every refresh token for that user is
 * revoked in response, forcing a fresh login on every device. This is the
 * standard mitigation under a rotation scheme.
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(refreshToken);
  const tokenRow = await findRefreshToken(tokenHash);

  if (!tokenRow) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (tokenRow.revoked) {
    await revokeAllUserTokens(tokenRow.user_id);
    throw new AppError('Refresh token has been revoked. Please log in again.', 401);
  }

  if (tokenRow.expires_at.getTime() < Date.now()) {
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  const userWithOrg = await findUserById(tokenRow.user_id);

  if (!userWithOrg) {
    throw new AppError('User account no longer exists', 401);
  }

  // Revoke the presented token before issuing its replacement — this is
  // rotation, not reuse. The new token is the only valid one going forward.
  await revokeRefreshToken(tokenHash);

  return generateTokens(userWithOrg.id, userWithOrg.org_id, userWithOrg.role);
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await revokeRefreshToken(tokenHash);
}