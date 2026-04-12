import { Router } from "express";
import { db, orderTemplatesTable, serviceTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

export const DEFAULT_TEMPLATE_FIELDS = [
  { key: "serviceType", label: "Xizmat turi",     required: true,  visible: true },
  { key: "client",      label: "Mijoz",            required: false, visible: true },
  { key: "product",     label: "Mahsulot",         required: false, visible: true },
  { key: "quantity",    label: "Soni",             required: true,  visible: true },
  { key: "unit",        label: "O'lchov birligi",  required: false, visible: true },
  { key: "shelf",       label: "Joylashuv (qolib)", required: false, visible: true },
  { key: "notes",       label: "Izoh",             required: false, visible: true },
  { key: "requireOutputQty", label: "Chiqish miqdori belgisi", required: false, visible: true },
];

// GET /api/order-templates — list all templates for store
router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
    const storeId = payload.role === "sudo"
      ? (req.query.storeId ? Number(req.query.storeId) : undefined)
      : payload.storeId;
    const templates = storeId
      ? await db.query.orderTemplatesTable.findMany({ where: eq(orderTemplatesTable.storeId, storeId), orderBy: (t, { asc }) => asc(t.createdAt) })
      : await db.query.orderTemplatesTable.findMany({ orderBy: (t, { asc }) => asc(t.createdAt) });
    res.json(templates);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /api/order-templates/by-service/:serviceTypeId — get template for a service type
router.get("/by-service/:serviceTypeId", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
    const serviceTypeId = parseInt(req.params.serviceTypeId);
    const st = await db.query.serviceTypesTable.findFirst({ where: eq(serviceTypesTable.id, serviceTypeId) });
    if (!st || !st.templateId) {
      res.json({ fields: DEFAULT_TEMPLATE_FIELDS });
      return;
    }
    const tmpl = await db.query.orderTemplatesTable.findFirst({ where: eq(orderTemplatesTable.id, st.templateId) });
    res.json(tmpl ? { ...tmpl } : { fields: DEFAULT_TEMPLATE_FIELDS });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /api/order-templates — create template
router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const { name, fields, assignToServiceTypeIds } = req.body as {
      name: string;
      fields: typeof DEFAULT_TEMPLATE_FIELDS;
      assignToServiceTypeIds?: number[];
    };
    const storeId = payload.role === "sudo" ? req.body.storeId : payload.storeId;
    if (!storeId) { res.status(400).json({ error: "storeId majburiy" }); return; }
    const [tmpl] = await db.insert(orderTemplatesTable).values({ storeId, name, fields }).returning();
    if (assignToServiceTypeIds?.length) {
      for (const stId of assignToServiceTypeIds) {
        await db.update(serviceTypesTable).set({ templateId: tmpl.id }).where(eq(serviceTypesTable.id, stId));
      }
    }
    res.status(201).json(tmpl);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PUT /api/order-templates/:id — update template
router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const id = parseInt(req.params.id);
    const { name, fields, assignToServiceTypeIds } = req.body as {
      name?: string;
      fields?: typeof DEFAULT_TEMPLATE_FIELDS;
      assignToServiceTypeIds?: number[];
    };
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (fields !== undefined) updates.fields = fields;
    const [updated] = await db.update(orderTemplatesTable).set(updates).where(eq(orderTemplatesTable.id, id)).returning();
    if (assignToServiceTypeIds !== undefined) {
      const storeId = payload.role === "sudo" ? updated.storeId : payload.storeId!;
      await db.update(serviceTypesTable)
        .set({ templateId: null })
        .where(eq(serviceTypesTable.storeId, storeId));
      for (const stId of assignToServiceTypeIds) {
        await db.update(serviceTypesTable).set({ templateId: id }).where(eq(serviceTypesTable.id, stId));
      }
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PATCH /api/order-templates/:id/assign — assign template to service types
router.patch("/:id/assign", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const id = parseInt(req.params.id);
    const { serviceTypeIds } = req.body as { serviceTypeIds: number[] };
    const storeId = payload.role === "superadmin" ? payload.storeId! : req.body.storeId;
    await db.update(serviceTypesTable)
      .set({ templateId: null })
      .where(eq(serviceTypesTable.storeId, storeId));
    for (const stId of serviceTypeIds) {
      await db.update(serviceTypesTable).set({ templateId: id }).where(eq(serviceTypesTable.id, stId));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /api/order-templates/:id — delete template
router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const id = parseInt(req.params.id);
    await db.update(serviceTypesTable).set({ templateId: null }).where(eq(serviceTypesTable.templateId, id));
    await db.delete(orderTemplatesTable).where(eq(orderTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
