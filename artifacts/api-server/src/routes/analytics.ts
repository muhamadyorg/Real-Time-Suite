import { Router } from "express";
import { pool } from "@workspace/db";
import { verifyToken } from "../lib/auth";
import { db, accountPermissionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

function parseSummary(row: any) {
  if (!row) return row;
  return {
    total_orders: row.total_orders,
    total_quantity: parseFloat(row.total_quantity ?? "0"),
    total_price: parseFloat(row.total_price ?? "0"),
    naqd_total: parseFloat(row.naqd_total ?? "0"),
    click_total: parseFloat(row.click_total ?? "0"),
    dokonga_total: parseFloat(row.dokonga_total ?? "0"),
    qarz_total: parseFloat(row.qarz_total ?? "0"),
  };
}

async function canAccess(req: any): Promise<{ ok: boolean; storeId?: number; role?: string; accountId?: number }> {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return { ok: false };
  const payload = verifyToken(auth);
  if (!payload) return { ok: false };
  if (payload.role === "sudo" || payload.role === "superadmin") {
    return { ok: true, storeId: payload.storeId, role: payload.role, accountId: payload.id };
  }
  const perm = await db.query.accountPermissionsTable.findFirst({
    where: and(
      eq(accountPermissionsTable.accountId, payload.id),
      eq(accountPermissionsTable.permissionKey, "can_analyze")
    ),
  });
  if (perm) return { ok: true, storeId: payload.storeId, role: payload.role, accountId: payload.id };
  return { ok: false };
}

// GET /api/analytics
// Query params: period=daily|weekly|monthly, serviceTypeIds=1,2,3, days=N, date=YYYY-MM-DD (specific day)
router.get("/", async (req, res) => {
  try {
    const access = await canAccess(req);
    if (!access.ok) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = Number(req.query.storeId ?? access.storeId);
    const period = (req.query.period as string) ?? "daily";
    const rawIds = req.query.serviceTypeIds as string | undefined;
    const serviceTypeIds = rawIds ? rawIds.split(",").map(Number).filter(Boolean) : null;
    const specificDate = req.query.date as string | undefined;

    const serviceFilter = serviceTypeIds?.length
      ? `AND service_type_id = ANY($3::int[])`
      : "";

    let dateFilter: string;
    let queryParams: any[];

    if (specificDate && /^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
      // Single specific day — UTC+5 offset
      const idxOffset = serviceTypeIds?.length ? 4 : 3;
      dateFilter = `AND (created_at + interval '5 hours')::date = $${idxOffset}::date`;
      queryParams = [storeId, specificDate];
      if (serviceTypeIds?.length) queryParams = [storeId, serviceTypeIds, specificDate];
      // Re-order params
      if (serviceTypeIds?.length) {
        queryParams = [storeId, serviceTypeIds, specificDate];
        const svcFilter2 = `AND o.service_type_id = ANY($2::int[])`;
        const dateFilter2 = `AND (o.created_at + interval '5 hours')::date = $3::date`;
        const sql = `
          SELECT
            date_trunc('day', created_at + interval '5 hours') AS period,
            service_type_id,
            service_type_name,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(price::numeric), 0) AS total_price,
            unit
          FROM orders
          WHERE store_id = $1
            AND service_type_id = ANY($2::int[])
            AND (created_at + interval '5 hours')::date = $3::date
          GROUP BY period, service_type_id, service_type_name, unit
          ORDER BY period DESC, service_type_name
        `;
        const summaryRes = await pool.query(`
          SELECT COUNT(DISTINCT o.id)::int AS total_orders,
            COALESCE(SUM(o.quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(o.price::numeric), 0) AS total_price,
            COALESCE(SUM(CASE WHEN ct.type = 'naqd'    THEN o.price::numeric ELSE 0 END), 0) AS naqd_total,
            COALESCE(SUM(CASE WHEN ct.type = 'click'   THEN o.price::numeric ELSE 0 END), 0) AS click_total,
            COALESCE(SUM(CASE WHEN ct.type = 'dokonga' THEN o.price::numeric ELSE 0 END), 0) AS dokonga_total,
            COALESCE(SUM(CASE WHEN ct.type = 'qarz'    THEN o.price::numeric ELSE 0 END), 0) AS qarz_total
          FROM orders o
          LEFT JOIN LATERAL (
            SELECT type FROM client_transactions WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
          ) ct ON true
          WHERE o.store_id = $1 ${svcFilter2} ${dateFilter2}
        `, queryParams);
        const result = await pool.query(sql, queryParams);
        res.json({
          summary: parseSummary(summaryRes.rows[0]),
          rows: result.rows.map(r => ({
            ...r,
            total_quantity: parseFloat(r.total_quantity),
            total_price: parseFloat(r.total_price),
          })),
        });
        return;
      } else {
        const dateFilter2 = `AND (o.created_at + interval '5 hours')::date = $2::date`;
        const sql = `
          SELECT
            date_trunc('day', created_at + interval '5 hours') AS period,
            service_type_id,
            service_type_name,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(price::numeric), 0) AS total_price,
            unit
          FROM orders
          WHERE store_id = $1 AND (created_at + interval '5 hours')::date = $2::date
          GROUP BY period, service_type_id, service_type_name, unit
          ORDER BY period DESC, service_type_name
        `;
        const summaryRes = await pool.query(`
          SELECT COUNT(DISTINCT o.id)::int AS total_orders,
            COALESCE(SUM(o.quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(o.price::numeric), 0) AS total_price,
            COALESCE(SUM(CASE WHEN ct.type = 'naqd'    THEN o.price::numeric ELSE 0 END), 0) AS naqd_total,
            COALESCE(SUM(CASE WHEN ct.type = 'click'   THEN o.price::numeric ELSE 0 END), 0) AS click_total,
            COALESCE(SUM(CASE WHEN ct.type = 'dokonga' THEN o.price::numeric ELSE 0 END), 0) AS dokonga_total,
            COALESCE(SUM(CASE WHEN ct.type = 'qarz'    THEN o.price::numeric ELSE 0 END), 0) AS qarz_total
          FROM orders o
          LEFT JOIN LATERAL (
            SELECT type FROM client_transactions WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
          ) ct ON true
          WHERE o.store_id = $1 ${dateFilter2}
        `, [storeId, specificDate]);
        const result = await pool.query(sql, [storeId, specificDate]);
        res.json({
          summary: parseSummary(summaryRes.rows[0]),
          rows: result.rows.map(r => ({
            ...r,
            total_quantity: parseFloat(r.total_quantity),
            total_price: parseFloat(r.total_price),
          })),
        });
        return;
      }
    }

    // Date range mode
    let days: number;
    let truncUnit: string;
    switch (period) {
      case "weekly":  days = 84; truncUnit = "week";  break;
      case "monthly": days = 365; truncUnit = "month"; break;
      default:        days = 30;  truncUnit = "day";   break;
    }

    const overrideDays = Number(req.query.days);
    if (!isNaN(overrideDays) && overrideDays > 0) days = overrideDays;

    queryParams = [storeId, days];
    if (serviceTypeIds?.length) queryParams.push(serviceTypeIds);

    const svcFilterAgg = serviceTypeIds?.length ? `AND service_type_id = ANY($3::int[])` : "";
    const svcFilterAggO = serviceTypeIds?.length ? `AND o.service_type_id = ANY($3::int[])` : "";

    const sql = `
      SELECT
        date_trunc('${truncUnit}', created_at + interval '5 hours') AS period,
        service_type_id,
        service_type_name,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
        COALESCE(SUM(price::numeric), 0) AS total_price,
        unit
      FROM orders
      WHERE store_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        ${svcFilterAgg}
      GROUP BY period, service_type_id, service_type_name, unit
      ORDER BY period DESC, service_type_name
    `;

    const result = await pool.query(sql, queryParams);

    const summaryRes = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id)::int AS total_orders,
        COALESCE(SUM(o.quantity::numeric), 0) AS total_quantity,
        COALESCE(SUM(o.price::numeric), 0) AS total_price,
        COALESCE(SUM(CASE WHEN ct.type = 'naqd'    THEN o.price::numeric ELSE 0 END), 0) AS naqd_total,
        COALESCE(SUM(CASE WHEN ct.type = 'click'   THEN o.price::numeric ELSE 0 END), 0) AS click_total,
        COALESCE(SUM(CASE WHEN ct.type = 'dokonga' THEN o.price::numeric ELSE 0 END), 0) AS dokonga_total,
        COALESCE(SUM(CASE WHEN ct.type = 'qarz'    THEN o.price::numeric ELSE 0 END), 0) AS qarz_total
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT type FROM client_transactions WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
      ) ct ON true
      WHERE o.store_id = $1
        AND o.created_at >= NOW() - ($2 || ' days')::interval
        ${svcFilterAggO}
    `, queryParams);

    res.json({
      summary: parseSummary(summaryRes.rows[0]),
      rows: result.rows.map(r => ({
        ...r,
        period: r.period,
        total_quantity: parseFloat(r.total_quantity),
        total_price: parseFloat(r.total_price),
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/analytics/orders — individual orders for drill-down or full list
// Query params: storeId, periodStart=YYYY-MM-DD, periodEnd=YYYY-MM-DD, serviceTypeId, days=N
router.get("/orders", async (req, res) => {
  try {
    const access = await canAccess(req);
    if (!access.ok) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = Number(req.query.storeId ?? access.storeId);
    const periodStart = req.query.periodStart as string | undefined;
    const periodEnd = req.query.periodEnd as string | undefined;
    const serviceTypeId = req.query.serviceTypeId ? Number(req.query.serviceTypeId) : null;
    const serviceTypeIds = req.query.serviceTypeIds
      ? (req.query.serviceTypeIds as string).split(",").map(Number).filter(Boolean)
      : null;
    const clientId = req.query.clientId ? Number(req.query.clientId) : null;
    const days = req.query.days ? Math.min(Number(req.query.days), 365) : null;

    const conditions: string[] = ["store_id = $1"];
    const params: any[] = [storeId];

    const oConditions: string[] = ["o.store_id = $1"];

    if (days && !periodStart && !periodEnd) {
      params.push(days);
      oConditions.push(`o.created_at >= NOW() - ($${params.length} || ' days')::interval`);
    }
    if (periodStart) {
      params.push(periodStart);
      oConditions.push(`(o.created_at + interval '5 hours') >= $${params.length}::timestamptz`);
    }
    if (periodEnd) {
      params.push(periodEnd);
      oConditions.push(`(o.created_at + interval '5 hours') < $${params.length}::timestamptz`);
    }
    if (serviceTypeId) {
      params.push(serviceTypeId);
      oConditions.push(`o.service_type_id = $${params.length}`);
    }
    if (serviceTypeIds?.length) {
      params.push(serviceTypeIds);
      oConditions.push(`o.service_type_id = ANY($${params.length}::int[])`);
    }
    if (clientId) {
      params.push(clientId);
      oConditions.push(`o.client_id = $${params.length}`);
    }

    const sql = `
      SELECT
        o.id,
        o.order_id,
        o.service_type_id,
        o.service_type_name,
        o.client_id,
        o.client_name,
        o.client_phone,
        o.quantity,
        o.unit,
        o.output_quantity,
        o.output_unit,
        o.price,
        o.extra_fields,
        o.notes,
        o.status,
        o.created_at,
        (date_trunc('day', o.created_at + interval '5 hours'))::date AS day,
        ct.type AS payment_type,
        ct.amount AS payment_amount
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT type, amount FROM client_transactions
        WHERE order_id = o.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ct ON true
      WHERE ${oConditions.join(" AND ")}
      ORDER BY o.created_at DESC
      LIMIT 500
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
