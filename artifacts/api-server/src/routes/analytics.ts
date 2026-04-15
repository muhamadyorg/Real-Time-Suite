import { Router } from "express";
import { pool } from "@workspace/db";
import { verifyToken } from "../lib/auth";
import { db, accountPermissionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

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
        const svcFilter2 = `AND service_type_id = ANY($2::int[])`;
        const dateFilter2 = `AND (created_at + interval '5 hours')::date = $3::date`;
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
            ${svcFilter2}
            ${dateFilter2}
          GROUP BY period, service_type_id, service_type_name, unit
          ORDER BY period DESC, service_type_name
        `;
        const summaryRes = await pool.query(`
          SELECT COUNT(*)::int AS total_orders,
            COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(price::numeric), 0) AS total_price
          FROM orders
          WHERE store_id = $1 ${svcFilter2} ${dateFilter2}
        `, queryParams);
        const result = await pool.query(sql, queryParams);
        res.json({
          summary: summaryRes.rows[0],
          rows: result.rows.map(r => ({
            ...r,
            total_quantity: parseFloat(r.total_quantity),
            total_price: parseFloat(r.total_price),
          })),
        });
        return;
      } else {
        const dateFilter2 = `AND (created_at + interval '5 hours')::date = $2::date`;
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
          WHERE store_id = $1 ${dateFilter2}
          GROUP BY period, service_type_id, service_type_name, unit
          ORDER BY period DESC, service_type_name
        `;
        const summaryRes = await pool.query(`
          SELECT COUNT(*)::int AS total_orders,
            COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
            COALESCE(SUM(price::numeric), 0) AS total_price
          FROM orders WHERE store_id = $1 ${dateFilter2}
        `, [storeId, specificDate]);
        const result = await pool.query(sql, [storeId, specificDate]);
        res.json({
          summary: summaryRes.rows[0],
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
        ${serviceFilter}
      GROUP BY period, service_type_id, service_type_name, unit
      ORDER BY period DESC, service_type_name
    `;

    const result = await pool.query(sql, queryParams);

    const summaryRes = await pool.query(`
      SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(quantity::numeric), 0) AS total_quantity,
        COALESCE(SUM(price::numeric), 0) AS total_price
      FROM orders
      WHERE store_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        ${serviceFilter}
    `, queryParams);

    res.json({
      summary: summaryRes.rows[0],
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

// GET /api/analytics/orders — individual orders for drill-down
// Query params: storeId, periodStart=YYYY-MM-DD, periodEnd=YYYY-MM-DD, serviceTypeId
router.get("/orders", async (req, res) => {
  try {
    const access = await canAccess(req);
    if (!access.ok) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = Number(req.query.storeId ?? access.storeId);
    const periodStart = req.query.periodStart as string;
    const periodEnd = req.query.periodEnd as string;
    const serviceTypeId = req.query.serviceTypeId ? Number(req.query.serviceTypeId) : null;
    const clientId = req.query.clientId ? Number(req.query.clientId) : null;

    const conditions: string[] = ["store_id = $1"];
    const params: any[] = [storeId];

    if (periodStart) {
      params.push(periodStart);
      conditions.push(`(created_at + interval '5 hours') >= $${params.length}::timestamptz`);
    }
    if (periodEnd) {
      params.push(periodEnd);
      conditions.push(`(created_at + interval '5 hours') < $${params.length}::timestamptz`);
    }
    if (serviceTypeId) {
      params.push(serviceTypeId);
      conditions.push(`service_type_id = $${params.length}`);
    }
    if (clientId) {
      params.push(clientId);
      conditions.push(`client_id = $${params.length}`);
    }

    const sql = `
      SELECT
        id,
        order_id,
        service_type_id,
        service_type_name,
        client_id,
        client_name,
        client_phone,
        quantity,
        unit,
        price,
        shelf,
        product,
        notes,
        status,
        created_at
      FROM orders
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
