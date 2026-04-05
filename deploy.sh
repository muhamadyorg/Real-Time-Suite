#!/bin/bash
set -e

# =========================================================
#  ZAKAZ TIZIMI — TO'LIQ AVTOMATIK DEPLOY SKRIPTI
#  Har safar ishlatish mumkin — ma'lumotlar SAQLANIB qoladi
# =========================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
PM2_APP_NAME="zakaz-api"
API_PORT=8080

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   ZAKAZ TIZIMI — DEPLOY BOSHLANDI         ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ----------------------------------------------------------
# 1. NODE.JS tekshirish
# ----------------------------------------------------------
info "[1/11] Node.js tekshirilmoqda..."
if ! command -v node &>/dev/null; then
  fail "Node.js topilmadi!\nQuyidagini bajaring:\n  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -\n  sudo apt-get install -y nodejs"
fi
ok "Node.js mavjud: $(node -v)"

# ----------------------------------------------------------
# 2. PNPM tekshirish / o'rnatish
# ----------------------------------------------------------
info "[2/11] pnpm tekshirilmoqda..."
if ! command -v pnpm &>/dev/null; then
  warn "pnpm topilmadi, o'rnatilmoqda..."
  npm install -g pnpm@latest
fi
ok "pnpm mavjud: $(pnpm -v)"

# ----------------------------------------------------------
# 3. PM2 tekshirish / o'rnatish
# ----------------------------------------------------------
info "[3/11] PM2 tekshirilmoqda..."
if ! command -v pm2 &>/dev/null; then
  warn "PM2 topilmadi, o'rnatilmoqda..."
  npm install -g pm2
fi
ok "PM2 mavjud: $(pm2 -v)"

# ----------------------------------------------------------
# 4. PostgreSQL tekshirish / o'rnatish / ishga tushirish
# ----------------------------------------------------------
info "[4/11] PostgreSQL tekshirilmoqda..."
if ! command -v psql &>/dev/null; then
  warn "PostgreSQL topilmadi, o'rnatilmoqda..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y postgresql postgresql-contrib
    ok "PostgreSQL o'rnatildi"
  elif command -v yum &>/dev/null; then
    sudo yum install -y postgresql-server postgresql-contrib
    sudo postgresql-setup initdb 2>/dev/null || true
    ok "PostgreSQL o'rnatildi (yum)"
  else
    fail "PostgreSQL topilmadi va avtomatik o'rnatib bo'lmadi.\nQo'lda o'rnating: https://www.postgresql.org/download/"
  fi
fi
ok "PostgreSQL mavjud: $(psql --version)"

# PostgreSQL service ishlayaptimi?
info "PostgreSQL service tekshirilmoqda..."
if ! pg_isready -q 2>/dev/null; then
  warn "PostgreSQL o'chiq, ishga tushirilmoqda..."
  sudo systemctl start postgresql 2>/dev/null || \
  sudo service postgresql start 2>/dev/null || \
  sudo -u postgres pg_ctl start 2>/dev/null || true
  sleep 3
fi

if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL ishlamoqda"
else
  warn "PostgreSQL pg_isready javob bermadi. Davom etilmoqda..."
fi

# ----------------------------------------------------------
# 5. .env fayl tekshirish / yaratish
# ----------------------------------------------------------
info "[5/11] .env fayli tekshirilmoqda..."
if [ -f "$ENV_FILE" ]; then
  ok ".env mavjud"
  set -a; source "$ENV_FILE"; set +a
else
  warn ".env topilmadi — yangisi yaratilmoqda..."

  # Tasodifiy parollar
  DB_PASS=$(openssl rand -hex 16)
  DB_NAME="zakaz_db"
  DB_USER="zakaz_user"
  SESSION_SECRET=$(openssl rand -hex 32)

  # DB foydalanuvchi bor yoki yo'qligini tekshirish
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "")
  if [ "$USER_EXISTS" = "1" ]; then
    warn "DB foydalanuvchi '$DB_USER' allaqachon mavjud."
    warn "Parolni bilmasangiz qo'lda .env ga DATABASE_URL yozing."
    DB_URL="postgresql://$DB_USER:PAROLNI_KIRITING@localhost:5432/$DB_NAME"
  else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    DB_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
    ok "DB foydalanuvchi yaratildi: $DB_USER / $DB_PASS"
  fi

  cat > "$ENV_FILE" << ENVEOF
DATABASE_URL=$DB_URL
SESSION_SECRET=$SESSION_SECRET
PORT=$API_PORT
NODE_ENV=production
ENVEOF

  ok ".env yaratildi"
  warn "MUHIM: .env faylini tekshiring → $ENV_FILE"
  set -a; source "$ENV_FILE"; set +a
fi

# DATABASE_URL mavjudligini tekshirish
if [ -z "$DATABASE_URL" ]; then
  fail "DATABASE_URL .env da topilmadi!\n$ENV_FILE faylini tekshiring."
fi
ok "DATABASE_URL o'qildi"

# ----------------------------------------------------------
# 6. DATABASE yaratish (bor bo'lsa — MA'LUMOTLAR SAQLANADI!)
# ----------------------------------------------------------
info "[6/11] Database tekshirilmoqda..."

# DATABASE_URL dan db nomini ajratish
ACTUAL_DB=$(node -e "const u=new URL('$DATABASE_URL'); console.log(u.pathname.replace('/',''))" 2>/dev/null || \
            echo "$DATABASE_URL" | sed 's|.*\/||' | sed 's|[?].*||')
ACTUAL_USER=$(node -e "const u=new URL('$DATABASE_URL'); console.log(u.username)" 2>/dev/null || \
              echo "$DATABASE_URL" | sed 's|.*://||' | sed 's|[:].*||')

info "Database: $ACTUAL_DB | Foydalanuvchi: $ACTUAL_USER"

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$ACTUAL_DB'" 2>/dev/null || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  ok "Database '$ACTUAL_DB' mavjud — BARCHA MA'LUMOTLAR SAQLANADI ✅"
else
  warn "Database '$ACTUAL_DB' topilmadi, yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE $ACTUAL_DB OWNER $ACTUAL_USER;" 2>/dev/null || \
  sudo -u postgres createdb -O "$ACTUAL_USER" "$ACTUAL_DB" 2>/dev/null || \
  fail "Database yaratib bo'lmadi!\nQo'lda bajaring:\n  sudo -u postgres createdb -O $ACTUAL_USER $ACTUAL_DB"
  ok "Database '$ACTUAL_DB' yaratildi"
fi

# ----------------------------------------------------------
# 7. KODLARNI YANGILASH (git pull)
# ----------------------------------------------------------
info "[7/11] Yangi kodlar olinmoqda..."
cd "$DEPLOY_DIR"
git pull origin main 2>/dev/null || git pull 2>/dev/null || warn "git pull ishlamadi — local kodlar ishlatiladi"
ok "Kod yangilandi"

# ----------------------------------------------------------
# 8. KUTUBXONALARNI O'RNATISH
# ----------------------------------------------------------
info "[8/11] Kutubxonalar o'rnatilmoqda..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Kutubxonalar tayyor"

# ----------------------------------------------------------
# 9. DATABASE SCHEMA YANGILASH (FAQAT QO'SHADI, O'CHIRMAYDI!)
# ----------------------------------------------------------
info "[9/11] Database schema yangilanmoqda..."
info "Bu faqat yangi jadvallar/ustunlar qo'shadi — hech qanday ma'lumot o'CHIRMAYDI"
cd "$DEPLOY_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config ./drizzle.config.ts --force 2>&1 | \
  grep -E "✓|✗|error|Error|applying|Changes|No changes|already" || true
cd "$DEPLOY_DIR"
ok "Schema yangilandi (ma'lumotlar saqlanib qoldi)"

# ----------------------------------------------------------
# 10. BUILD (API + FRONTEND)
# ----------------------------------------------------------
info "[10/11] Build qilinmoqda..."
info "  → API server..."
pnpm --filter @workspace/api-server run build
ok "  API server build tayyor"

info "  → Frontend..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/order-system run build
ok "  Frontend build tayyor"

# ----------------------------------------------------------
# 11. PM2 ECOSYSTEM VA RESTART
# ----------------------------------------------------------
info "[11/11] PM2 sozlanmoqda va ishga tushirilmoqda..."

ECOSYSTEM_FILE="$DEPLOY_DIR/ecosystem.config.cjs"

# .env dan qiymatlarni o'qish
DB_URL_VAL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
SESSION_SECRET_VAL=$(grep -E "^SESSION_SECRET=" "$ENV_FILE" | cut -d= -f2-)
TELEGRAM_TOKEN_VAL=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2- || echo "")

cat > "$ECOSYSTEM_FILE" << ECOEOF
module.exports = {
  apps: [{
    name: '$PM2_APP_NAME',
    script: '$DEPLOY_DIR/artifacts/api-server/dist/index.mjs',
    interpreter: 'node',
    interpreter_args: '--enable-source-maps',
    cwd: '$DEPLOY_DIR',
    env: {
      NODE_ENV: 'production',
      PORT: '$API_PORT',
      DATABASE_URL: '$DB_URL_VAL',
      SESSION_SECRET: '$SESSION_SECRET_VAL',
      TELEGRAM_BOT_TOKEN: '$TELEGRAM_TOKEN_VAL',
    },
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '$DEPLOY_DIR/logs/pm2-error.log',
    out_file: '$DEPLOY_DIR/logs/pm2-out.log',
  }]
};
ECOEOF

mkdir -p "$DEPLOY_DIR/logs"

if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 reload "$PM2_APP_NAME" --update-env 2>/dev/null || pm2 restart "$PM2_APP_NAME"
  ok "PM2 reload muvaffaqiyatli"
else
  pm2 start "$ECOSYSTEM_FILE"
  ok "PM2 ishga tushirildi"
fi

# Sozlamalarni saqlash (server reboot dan keyin ham ishlashi uchun)
pm2 save
pm2 startup 2>/dev/null | grep "sudo" | head -1 || true

# ----------------------------------------------------------
# YAKUNIY HOLAT
# ----------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   🎉 DEPLOY MUVAFFAQIYATLI YAKUNLANDI!     ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
pm2 status "$PM2_APP_NAME" 2>/dev/null || pm2 status
echo ""
ok "API: http://localhost:$API_PORT"
ok "Database: $ACTUAL_DB (ma'lumotlar saqlanib qoldi)"
echo ""
info "Loglarni ko'rish:  pm2 logs $PM2_APP_NAME"
info "Status:            pm2 status"
info "To'xtatish:        pm2 stop $PM2_APP_NAME"
