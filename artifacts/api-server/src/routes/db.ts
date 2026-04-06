import { Router } from "express";
import express from "express";
import { pool } from "@workspace/db";
import { verifyToken } from "../lib/auth";

const router = Router();

function isSudo(req: express.Request): boolean {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return false;
  const payload = verifyToken(auth);
  return payload?.role === "sudo";
}

const TABLES_ORDERED = [
  "stores",
  "accounts",
  "service_types",
  "clients",
  "products",
  "orders",
  "account_permissions",
  "store_permission_modes",
];

// GET /api/db/stats
router.get("/stats", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const stats = await Promise.all(
      TABLES_ORDERED.map(async (table) => {
        const result = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        return { table, count: Number(result.rows[0].count) };
      })
    );
    const sizeRes = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    res.json({ stats, dbSize: sizeRes.rows[0].size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/db/export — export all data as SQL
router.get("/export", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let out = `-- Buyurtma tizimi DB backup\n-- Sana: ${new Date().toISOString()}\n-- Versiya: 1.0\n\n`;
    out += `SET session_replication_role = 'replica';\n\n`;

    for (const table of TABLES_ORDERED) {
      const rowsRes = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
      out += `-- ===== ${table} (${rowsRes.rows.length} ta yozuv) =====\n`;
      out += `TRUNCATE TABLE "${table}";\n`;

      for (const row of rowsRes.rows) {
        const cols = Object.keys(row).map(c => `"${c}"`).join(", ");
        const vals = Object.values(row).map(v => {
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return v.toString();
          if (typeof v === "boolean") return v ? "true" : "false";
          if (v instanceof Date) return `'${v.toISOString()}'`;
          return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
        }).join(", ");
        out += `INSERT INTO "${table}" (${cols}) VALUES (${vals});\n`;
      }
      out += `\n`;
    }

    out += `SET session_replication_role = 'DEFAULT';\n`;

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${date}.sql"`);
    res.send(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/db/import — restore from SQL text
router.post("/import", express.text({ type: "*/*", limit: "100mb" }), async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const sqlText = req.body as string;
  if (!sqlText || typeof sqlText !== "string") {
    res.status(400).json({ error: "SQL matn kerak" }); return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = 'replica'");

    const statements = sqlText
      .split("\n")
      .filter(line => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let executed = 0;
    for (const stmt of statements) {
      await client.query(stmt);
      executed++;
    }

    await client.query("SET session_replication_role = 'DEFAULT'");
    await client.query("COMMIT");
    res.json({ ok: true, executed });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
