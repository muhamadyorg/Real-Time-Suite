import { Router } from "express";
import { verifyToken } from "../lib/auth";
import { getBackupSettings, updateBackupSettings, triggerBackupNow } from "../autoBackup";

const router = Router();

function isSudo(req: any): boolean {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return false;
  const payload = verifyToken(auth);
  return payload?.role === "sudo";
}

// GET /api/auto-backup/settings
router.get("/settings", (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  res.json(getBackupSettings());
});

// POST /api/auto-backup/settings
router.post("/settings", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const { botToken, chatId, intervalSeconds, enabled } = req.body;
    const updates: any = {};
    if (botToken !== undefined) updates.botToken = String(botToken);
    if (chatId !== undefined) updates.chatId = String(chatId);
    if (intervalSeconds !== undefined) updates.intervalSeconds = Math.max(10, Number(intervalSeconds));
    if (enabled !== undefined) updates.enabled = Boolean(enabled);
    const result = await updateBackupSettings(updates);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auto-backup/now  — darhol yuborish
router.post("/now", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    await triggerBackupNow();
    res.json({ success: true, settings: getBackupSettings() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
