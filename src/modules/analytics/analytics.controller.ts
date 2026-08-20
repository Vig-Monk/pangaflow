// =============================================================================
// src/modules/analytics/analytics.controller.ts
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as analyticsQueries from './analytics.queries';

const AnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function getAnalyticsOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const parsed = AnalyticsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid date filters', 400);
    }

    // Default to last 30 days if range is not provided
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const startDate = parsed.data.startDate
      ? new Date(parsed.data.startDate).toISOString()
      : thirtyDaysAgo.toISOString();

    const endDate = parsed.data.endDate
      ? new Date(parsed.data.endDate).toISOString()
      : now.toISOString();

    const raw = await analyticsQueries.getFinancialAnalyticsData(orgId, {
      startDate,
      endDate,
    });

    // 1. P&L Math
    const orderRev = parseFloat(raw.order_revenue);
    const posRev = parseFloat(raw.pos_revenue);
    const grossRevenue = Math.round((orderRev + posRev) * 100) / 100;
    const cogs = Math.round(parseFloat(raw.order_cogs) * 100) / 100;
    const grossProfit = Math.round((grossRevenue - cogs) * 100) / 100;
    const grossMarginPercent = grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 1000) / 10 : 0;

    const operatingExpenses = Math.round(parseFloat(raw.total_expenses) * 100) / 100;
    const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100;
    const netMarginPercent = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

    // 2. Working Capital Anatomy
    const liquidCash = Math.round(parseFloat(raw.total_cash_collected) * 100) / 100;
    const inventoryValue = Math.round(parseFloat(raw.inventory_value) * 100) / 100;
    const customerDebt = Math.round(parseFloat(raw.total_debt) * 100) / 100;
    const totalWorkingCapital = Math.round((liquidCash + inventoryValue + customerDebt) * 100) / 100;

    const cashPercent = totalWorkingCapital > 0 ? Math.round((liquidCash / totalWorkingCapital) * 100) : 0;
    const stockPercent = totalWorkingCapital > 0 ? Math.round((inventoryValue / totalWorkingCapital) * 100) : 0;
    const debtPercent = totalWorkingCapital > 0 ? Math.max(0, 100 - cashPercent - stockPercent) : 0;

    // 3. Debt Aging Buckets
    const fresh0To7Days = Math.round(parseFloat(raw.debt_0_7d) * 100) / 100;
    const aging8To30Days = Math.round(parseFloat(raw.debt_8_30d) * 100) / 100;
    const staleOver30Days = Math.round(parseFloat(raw.debt_over_30d) * 100) / 100;

    const overdueList = raw.overdue_debtors.map((d) => ({
      customerId: d.customer_id,
      customerName: d.customer_name,
      customerPhone: d.customer_phone,
      balance: parseFloat(d.balance),
      daysOverdue: d.days_overdue,
      lastActivityAt: d.last_activity_at.toISOString(),
    }));

    // 4. Category Performance
    const categories = raw.category_profits.map((c) => {
      const catRev = parseFloat(c.revenue);
      const catCogs = parseFloat(c.cogs);
      const catProfit = parseFloat(c.gross_profit);
      return {
        name: c.category_name,
        revenue: catRev,
        cogs: catCogs,
        grossProfit: catProfit,
        marginPercent: catRev > 0 ? Math.round((catProfit / catRev) * 1000) / 10 : 0,
        unitsSold: c.units_sold,
      };
    });

    const responsePayload = {
      period: {
        startDate,
        endDate,
      },
      pnl: {
        grossRevenue,
        cogs,
        grossProfit,
        grossMarginPercent,
        operatingExpenses,
        netProfit,
        netMarginPercent,
      },
      workingCapital: {
        liquidCash,
        inventoryValue,
        customerDebt,
        totalUnitsInStock: raw.total_units_in_stock,
        totalWorkingCapital,
        allocation: {
          cashPercent,
          stockPercent,
          debtPercent,
        },
      },
      debtAging: {
        totalDebt: customerDebt,
        debtorsCount: raw.debtors_count,
        buckets: {
          fresh0To7Days,
          aging8To30Days,
          staleOver30Days,
        },
        overdueList,
      },
      categories,
    };

    success(res, responsePayload);
  } catch (err) {
    next(err);
  }
}