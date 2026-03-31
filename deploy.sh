#!/bin/bash
set -e

echo "=== Yangi kodni olish ==="
git pull https://github.com/muhamadyorg/Real-Time-Suite.git main

echo "=== API server build ==="
pnpm --filter @workspace/api-server run build

echo "=== Frontend build ==="
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/order-system run build

echo "=== PM2 restart ==="
pm2 restart api-server

echo "=== Tayyor! ==="
pm2 status
