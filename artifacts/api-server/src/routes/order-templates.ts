import { Router } from "express";
import { db, orderTemplatesTable, serviceTypesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

export const DEFAULT_TEMPLATE_FIELDS = [
  { key: "serviceType", label: "Xizmat turi",        required: true,  visible: true,  options: [] },
  { key: "client",      label: "Mijoz",               required: false, visible: true,  options: [] },
  { key: "product",     label: "Mahsulot",            required: false, visible: true,  options: [] },
  { key: "quantity",    label: "Soni",                required: true,  visible: true,  options: [] },
  { key: "unit",        label: "O'lchov birligi",     required: false, visible: true,  options: [] },
  { key: "shelf",       label: "Joylashuv (qolib)",   required: false, visible: true,  options: [] },
  { key: "notes",       label: "Izoh",                required: false, visible: true,  options: [] },
  { key: "requireOutputQty", label: "Chiqish miqdori belgisi", required: false, visible: true, options: [] },
];

// POST /api/order-templates/ensure-default
// Idempotent: store uchun "Standart" shablon yo'q bo'lsa yaratadi, bor bo'lsa qaytaradi
router.post("/ensure-default", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const storeId = payload.role === "sudo" ? Number(req.body.storeId) : payload.storeId;
    if (!storeId || storeId <= 0) { res.status(400).json({ error: "storeId kerak" }); return; }

    const existing = await db.query.orderTemplatesTable.findFirst({
      where: and(eq(orderTemplatesTable.storeId, storeId), eq(orderTemplatesTable.name, "Standart")),
    });
    if (existing) { res.json(existing); return; }

    const [tmpl] = await db.insert(orderTemplatesTable).values({
      storeId,
      name: "Standart",
      fields: DEFAULT_TEMPLATE_FIELDS,
    }).returning();
    res.status(201).json(tmpl);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /api/order-templates
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

// GET /api/order-templates/by-service/:serviceTypeId
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
    res.json(tmpl ?? { fields: DEFAULT_TEMPLATE_FIELDS });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /api/order-templates — yaratish
router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const { name, fields, assignToServiceTypeIds } = req.body;
    const storeId = payload.role === "sudo" ? req.body.storeId : payload.storeId;
    if (!storeId) { res.status(400).json({ error: "storeId majburiy" }); return; }
    const [tmpl] = await db.insert(orderTemplatesTable).values({ storeId, name, fields }).returning();
    if (Array.isArray(assignToServiceTypeIds) && assignToServiceTypeIds.length > 0) {
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

// PUT /api/order-templates/:id — yangilash
router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }
    const id = parseInt(req.params.id);
    const { name, fields, assignToServiceTypeIds } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (fields !== undefined) updateData.fields = fields;

    let updated: any;
    if (Object.keys(updateData).length > 0) {
      const [r] = await db.update(orderTemplatesTable).set(updateData).where(eq(orderTemplatesTable.id, id)).returning();
      updated = r;
    } else {
      updated = await db.query.orderTemplatesTable.findFirst({ where: eq(orderTemplatesTable.id, id) });
    }

    if (Array.isArray(assignToServiceTypeIds)) {
      // Faqat bu shablonga ulanganlarni tozala (boshqa shablonlarni TEGANMA!)
      await db.update(serviceTypesTable)
        .set({ templateId: null })
        .where(eq(serviceTypesTable.templateId, id));
      // Yangilarini birlаshtir
      for (const stId of assignToServiceTypeIds) {
        await db.update(serviceTypesTable)
          .set({ templateId: id })
          .where(eq(serviceTypesTable.id, stId));
      }
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /api/order-templates/:id
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
