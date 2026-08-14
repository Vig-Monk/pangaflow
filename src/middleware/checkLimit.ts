import { RequestHandler } from 'express';
import { query } from '../config/db';
import { AppError } from '../utils/error';
import { PLANS } from '../config/constants';
import { PlanName } from '../types/models';

interface OrgPlanRow {
  plan: PlanName;
}

interface CustomerCountRow {
  count: string;
}

export interface LimitReachedDetails {
  currentPlan: PlanName;
  currentCount: number;
  limit: number;
  upgradeOptions: Array<{ plan: PlanName; label: string; price_kes: number }>;
}

export const checkCustomerLimit: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.orgId) {
      throw new AppError('Unauthorized', 401);
    }

    const orgResult = await query<OrgPlanRow>(
      `SELECT plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [req.orgId]
    );

    const org = orgResult.rows[0];

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const planConfig = PLANS[org.plan];
    const limit = planConfig.customerLimit;

    if (limit === null) {
      next();
      return;
    }

    const countResult = await query<CustomerCountRow>(
      `SELECT COUNT(*) AS count
       FROM   customers
       WHERE  org_id     = $1
         AND  deleted_at IS NULL`,
      [req.orgId]
    );

    const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

    if (currentCount >= limit) {
      const upgradeOptions = (Object.keys(PLANS) as PlanName[])
        .filter((planName) => planName !== org.plan && PLANS[planName].customerLimit === null)
        .map((planName) => ({
          plan: planName,
          label: PLANS[planName].label,
          price_kes: PLANS[planName].price_kes,
        }));

      const details: LimitReachedDetails = {
        currentPlan: org.plan,
        currentCount,
        limit,
        upgradeOptions,
      };

      throw new AppError(
        `Customer limit reached for the ${planConfig.label} plan (${limit} customers). Upgrade to add more.`,
        403,
        true,
        details
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const checkProductLimit: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.orgId) {
      throw new AppError('Unauthorized', 401);
    }

    const orgResult = await query<OrgPlanRow>(
      `SELECT plan FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [req.orgId]
    );

    const org = orgResult.rows[0];

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const planConfig = PLANS[org.plan];
    const limit = planConfig.productLimit;

    if (limit === null) {
      next();
      return;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM   products
       WHERE  org_id     = $1
         AND  deleted_at IS NULL`,
      [req.orgId]
    );

    const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

    if (currentCount >= limit) {
      const upgradeOptions = (Object.keys(PLANS) as PlanName[])
        .filter((planName) => planName !== org.plan && PLANS[planName].productLimit === null)
        .map((planName) => ({
          plan: planName,
          label: PLANS[planName].label,
          price_kes: PLANS[planName].price_kes,
        }));

      const details: LimitReachedDetails = {
        currentPlan: org.plan,
        currentCount,
        limit,
        upgradeOptions,
      };

      throw new AppError(
        `Product limit reached for the ${planConfig.label} plan (${limit} products). Upgrade to add more.`,
        403,
        true,
        details
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};