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
  // admin/worker — check can_analyze permission
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
// Query params: period=daily|weekly|monthly, serviceTypeIds=1,2,3, days=N
router.get("/", async (req, res) => {
  try {
    const access = await canAccess(req);
    if (!access.ok) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = Number(req.query.storeId ?? access.storeId);
    const period = (req.query.period as string) ?? "daily";
    const rawIds = req.query.serviceTypeIds as string | undefined;
    const serviceTypeIds = rawIds ? rawIds.split(",").map(Number).filter(Boolean) : null;

    // Period → days back
    let days: number;
    let truncUnit: string;
    switch (period) {
      case "weekly":  days = 84; truncUnit = "week";  break;
      case "monthly": days = 365; truncUnit = "month"; break;
      default:        days = 30;  truncUnit = "day";   break;
    }

    const overrideDays = Number(req.query.days);
    if (!isNaN(overrideDays) && overrideDays > 0) days = overrideDays;

    const serviceFilter = serviceTypeIds?.length
      ? `AND service_type_id = ANY($3::int[])`
      : "";

    const queryParams: any[] = [storeId, days];
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

// GET /api/analytics/orders — har bir zakaz alohida qator
router.get("/orders", async (req, res) => {
  try {
    const access = await canAccess(req);
    if (!access.ok) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = Number(req.query.storeId ?? access.storeId);
    const rawIds = req.query.serviceTypeIds as string | undefined;
    const serviceTypeIds = rawIds ? rawIds.split(",").map(Number).filter(Boolean) : null;
    const days = Math.min(Number(req.query.days ?? 30), 365);

    const serviceFilter = serviceTypeIds?.length
      ? `AND service_type_id = ANY($3::int[])`
      : "";

    const queryParams: any[] = [storeId, days];
    if (serviceTypeIds?.length) queryParams.push(serviceTypeIds);

    const sql = `
      SELECT
        id, order_code, service_type_id, service_type_name,
        quantity, unit, price, client_name, client_phone,
        extra_fields, created_at, status, output_quantity, output_unit,
        date_trunc('day', created_at + interval '5 hours') AS day
      FROM orders
      WHERE store_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
        ${serviceFilter}
      ORDER BY created_at DESC
    `;

    const result = await pool.query(sql, queryParams);
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
