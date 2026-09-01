// =============================================================================
// soko-api/src/modules/auth/auth.service.ts
// Business logic for auth: password hashing, JWT generation, and refresh rotation.
// =============================================================================

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { PoolClient } from 'pg';
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

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

function toSafeUser(user: User): Omit<User, 'password_hash'> {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Issues and persists access/refresh token pair. Reusable in or out of transactions.
 */
async function generateAndPersistTokens(
  userId: string,
  orgId: string,
  role: Role,
  client?: PoolClient
): Promise<TokenPair> {
  const payload: JwtPayload = { userId, orgId, role };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

  const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

  if (client) {
    await storeRefreshToken(client, { userId, tokenHash, expiresAt });
  } else {
    const standaloneClient = await pool.connect();
    try {
      await storeRefreshToken(standaloneClient, { userId, tokenHash, expiresAt });
    } finally {
      standaloneClient.release();
    }
  }

  return { accessToken, refreshToken };
}

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

    // 1. Create User
    const user = await createUser(client, {
      email: data.email,
      passwordHash,
      name: data.name,
    });

    // 2. Create Organization
    const org = await createOrg(client, {
      name: data.orgName,
      slug,
      businessType: data.businessType,
    });

    // 3. Auto-provision initial published store record for the storefront
    await client.query(
      `INSERT INTO stores (org_id, slug, name, status)
       VALUES ($1, $2, $3, 'published')
       ON CONFLICT (org_id) DO NOTHING`,
      [org.id, slug, data.orgName]
    );

    // 4. Create Owner Membership
    const member = await createOrgMember(client, {
      orgId: org.id,
      userId: user.id,
      role: 'owner',
    });

    // 5. Generate and persist token pair
    const tokens = await generateAndPersistTokens(user.id, org.id, member.role, client);

    await client.query('COMMIT');

    return {
      user: toSafeUser(user),
      org,
      tokens,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');

    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      throw new AppError('An account with this email already exists', 409);
    }

    throw err;
  } finally {
    client.release();
  }
}

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
    throw new AppError('Organization not found', 500, false);
  }

  const tokens = await generateAndPersistTokens(userWithOrg.id, userWithOrg.org_id, userWithOrg.role);

  const { org_id: _orgId, role: _role, ...userFields } = userWithOrg;

  return {
    user: toSafeUser(userFields as User),
    org,
    tokens,
  };
}

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

  await revokeRefreshToken(tokenHash);

  return generateAndPersistTokens(userWithOrg.id, userWithOrg.org_id, userWithOrg.role);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await revokeRefreshToken(tokenHash);
}