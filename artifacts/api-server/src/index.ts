import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { setSocketIO } from "./routes/orders";
import { setSettingsSocketIO } from "./routes/settings";
import { verifyToken } from "./lib/auth";
import { initTelegramBot, initStoreBots, checkAllBots } from "./routes/telegram";
import { seedSudo } from "./lib/seed";
import { db, storesTable, ordersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

// Fix lockPins per service type for existing "new" orders on startup
async function fixLockPinsByServiceType() {
  try {
    const newOrders = await db.query.ordersTable.findMany({
      where: eq(ordersTable.status, "new"),
      orderBy: [asc(ordersTable.createdAt)],
    });
    const seenTypes = new Set<string>();
    for (const order of newOrders) {
      const key = `${order.storeId}-${order.serviceTypeId}`;
      if (!seenTypes.has(key)) {
        seenTypes.add(key);
        // This is the oldest of its service type — should have no lockPin
        if (order.lockPin) {
          await db.update(ordersTable).set({ lockPin: null }).where(eq(ordersTable.id, order.id));
          logger.info({ orderId: order.orderId, serviceTypeId: order.serviceTypeId }, "Fixed: oldest order unlocked per service type");
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "fixLockPinsByServiceType error (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
httpServer.setMaxListeners(0);

const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
  path: "/api/socket.io",
});

setSocketIO(io);
setSettingsSocketIO(io);

io.on("connection", async (socket) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.storeId) {
      socket.join(`store:${payload.storeId}`);
    }
    if (payload?.role === "sudo") {
      socket.join("sudo");
      try {
        const stores = await db.select({ id: storesTable.id }).from(storesTable);
        stores.forEach((s) => socket.join(`store:${s.id}`));
      } catch (e) {
        logger.error({ err: e }, "sudo room join failed");
      }
    }
  }

  socket.on("join-store", (storeId: number) => {
    if (storeId > 0) socket.join(`store:${storeId}`);
  });
});

// Seed SUDO account on startup
seedSudo().catch((err) => logger.error({ err }, "Seed error"));

// Fix lockPins per service type for existing orders
fixLockPinsByServiceType().catch((err) => logger.warn({ err }, "lockPin fix error"));

// Init store bots first, then global bot (to detect token conflicts)
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
initStoreBots()
  .then(() => {
    if (telegramToken) {
      initTelegramBot(telegramToken);
    }
  })
  .catch((err) => {
    logger.error({ err }, "Store bots init error");
    if (telegramToken) {
      initTelegramBot(telegramToken);
    }
  });

// Check all bots on startup and every 5 minutes
setTimeout(() => checkAllBots().catch(() => {}), 8000);
setInterval(() => checkAllBots().catch(() => {}), 5 * 60 * 1000);

function startServer(listenPort: number) {
  httpServer.listen(listenPort, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port: listenPort }, "Server listening");
  });
}

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    const fallback = port + 1;
    logger.warn({ port, fallback }, "Port in use, trying fallback");
    httpServer.close();
    startServer(fallback);
  } else {
    logger.error({ err }, "Server error");
    process.exit(1);
  }
});

startServer(port);
