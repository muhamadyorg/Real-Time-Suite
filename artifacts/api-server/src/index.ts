import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { setSocketIO } from "./routes/orders";
import { verifyToken } from "./lib/auth";
import { initTelegramBot } from "./routes/telegram";
import { seedSudo } from "./lib/seed";

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

const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
  path: "/api/socket.io",
});

setSocketIO(io);

io.on("connection", (socket) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.storeId) {
      socket.join(`store:${payload.storeId}`);
    }
    if (payload?.role === "sudo") {
      socket.join("sudo");
    }
  }

  socket.on("join-store", (storeId: number) => {
    socket.join(`store:${storeId}`);
  });
});

// Seed SUDO account on startup
seedSudo().catch((err) => logger.error({ err }, "Seed error"));

// Init Telegram bot if token provided
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (telegramToken) {
  initTelegramBot(telegramToken);
}

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
