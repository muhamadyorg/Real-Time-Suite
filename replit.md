# Buyurtma Boshqaruv Tizimi (Order Management System)

## Overview

Multi-store real-time order management system with Telegram bot integration. PWA-enabled for mobile use.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Socket.IO
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Real-time**: Socket.IO
- **Telegram**: node-telegram-bot-api

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server + Socket.IO
│   └── order-system/       # React PWA frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
```

## User Roles

1. **SUDO** (hidden) - login: SUDO, password: Muhamadyorgalshib - full access, manages everything
2. **Superadmin** - manages one store (accounts, service types, clients)
3. **Admin** - creates orders for their store
4. **Worker** - accepts and processes orders via PIN code
5. **Viewer** - read-only view of orders

## Authentication Flow

1. Store login page: username + password → store session
2. PIN keypad (phone-style): 6-digit PIN → worker/role session
3. 15-second inactivity auto-logout on PIN and worker pages

## Order System

- Orders have 5-digit IDs: #00001, #00002...
- Statuses: new → accepted → ready
- Real-time updates via Socket.IO
- Telegram notifications to clients on accept/ready

## Telegram Bot

- Token stored as TELEGRAM_BOT_TOKEN env var
- Multi-step registration: /start → firstName → lastName → phone → pending approval
- Admin approves/rejects via web panel
- Bot notifies clients on order acceptance and readiness

## SUDO Account

Created automatically on first startup.
- Login: SUDO / Muhamadyorgalshib
- Can change own password via sudo panel

## API Paths

- `/api` - REST API
- `/socket.io` - WebSocket (Socket.IO)
- `/` - React frontend (PWA)
