import fs from "fs/promises";
import path from "path";
import { pool } from "@workspace/db";
import TelegramBot from "node-telegram-bot-api";

const TABLES_ORDERED = [
  "stores", "order_templates", "service_types", "accounts",
  "admin_allowed_service_types", "clients", "products", "orders",
  "account_permissions", "store_permission_modes", "client_accounts", "client_transactions",
];
const TABLES_REVERSE = [...TABLES_ORDERED].reverse();

const SEQUENCE_RESET_SQL = `DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tname, a.attname AS cname
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I), 1))',
      r.tname, r.cname, r.cname, r.tname
    );
  END LOOP;
END $$;`;

const SETTINGS_FILE = path.join(process.cwd(), "auto-backup-settings.json");

export interface BackupSettings {
  botToken: string;
  chatId: string;
  intervalSeconds: number;
  enabled: boolean;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
}

let settings: BackupSettings = {
  botToken: "",
  chatId: "",
  intervalSeconds: 3600,
  enabled: false,
  lastBackupAt: null,
  nextBackupAt: null,
};

let timer: ReturnType<typeof setTimeout> | null = null;

async function saveSettings() {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("[AutoBackup] settings save failed:", e);
  }
}

function tashkentNow() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function makeFilename() {
  const t = tashkentNow();
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}-${pad(t.getUTCHours())}-${pad(t.getUTCMinutes())}-${pad(t.getUTCSeconds())}.sql`;
}

async function generateSql(): Promise<string> {
  const t = tashkentNow();
  const dateLabel = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth()+1)}.${t.getUTCFullYear()}`;
  const timeLabel = `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())} (Toshkent)`;

  let out = `-- Buyurtma tizimi DB backup\n`;
  out += `-- Sana: ${dateLabel} ${timeLabel}\n`;
  out += `-- Auto-backup\n\n`;

  out += `-- ===== Eski ma'lumotlarni tozalash =====\n`;
  for (const table of TABLES_REVERSE) {
    out += `DELETE FROM "${table}";\n`;
  }
  out += `\n`;

  let totalRows = 0;
  for (const table of TABLES_ORDERED) {
    const rowsRes = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
    out += `-- ===== ${table} (${rowsRes.rows.length} ta) =====\n`;
    totalRows += rowsRes.rows.length;
    for (const row of rowsRes.rows) {
      const cols = Object.keys(row).map(c => `"${c}"`).join(", ");
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return v.toString();
        if (typeof v === "boolean") return v ? "true" : "false";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === "object" || Array.isArray(v)) {
          const str = JSON.stringify(v).replace(/\\/g, "\\\\").replace(/'/g, "''");
          return `'${str}'`;
        }
        return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
      }).join(", ");
      out += `INSERT INTO "${table}" (${cols}) VALUES (${vals});\n`;
    }
    out += `\n`;
  }

  out += `-- ===== Sequence reset =====\n`;
  out += SEQUENCE_RESET_SQL + "\n";
  out += `-- Total rows: ${totalRows}\n`;
  return out;
}

async function sendSqlToTelegram(sql: string, filename: string) {
  const { botToken, chatId } = settings;
  if (!botToken || !chatId) throw new Error("Bot token yoki chat id yo'q");
  const bot = new TelegramBot(botToken);
  const buf = Buffer.from(sql, "utf-8");
  await bot.sendDocument(chatId, buf, { caption: `🗄 <b>Auto Backup</b>\n📄 <code>${filename}</code>` , parse_mode: "HTML" }, { filename, contentType: "application/sql" });
}

async function runBackup() {
  try {
    console.log("[AutoBackup] Backup boshlandi...");
    const sql = await generateSql();
    const filename = makeFilename();
    await sendSqlToTelegram(sql, filename);
    settings.lastBackupAt = new Date().toISOString();
    await saveSettings();
    console.log(`[AutoBackup] Yuborildi: ${filename}`);
  } catch (e) {
    console.error("[AutoBackup] Xato:", e);
  }
  scheduleNext();
}

function scheduleNext() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!settings.enabled || !settings.botToken || !settings.chatId || settings.intervalSeconds <= 0) {
    settings.nextBackupAt = null;
    return;
  }
  const ms = settings.intervalSeconds * 1000;
  settings.nextBackupAt = new Date(Date.now() + ms).toISOString();
  timer = setTimeout(runBackup, ms);
}

export async function loadBackupSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    const loaded = JSON.parse(data);
    settings = { ...settings, ...loaded, nextBackupAt: null };
    if (settings.enabled && settings.botToken && settings.chatId && settings.intervalSeconds > 0) {
      scheduleNext();
      console.log(`[AutoBackup] Yoqilgan: har ${settings.intervalSeconds}s da Telegram ga yuboriladi`);
    }
  } catch {
    console.log("[AutoBackup] Settings topilmadi, standart sozlamalar ishlatiladi");
  }
}

export function getBackupSettings(): BackupSettings {
  return { ...settings };
}

export async function updateBackupSettings(updates: Partial<BackupSettings>): Promise<BackupSettings> {
  settings = { ...settings, ...updates };
  await saveSettings();
  scheduleNext();
  return { ...settings };
}

export async function triggerBackupNow(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  const sql = await generateSql();
  const filename = makeFilename();
  await sendSqlToTelegram(sql, filename);
  settings.lastBackupAt = new Date().toISOString();
  await saveSettings();
  scheduleNext();
}
