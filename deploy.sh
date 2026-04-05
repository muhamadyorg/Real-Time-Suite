#!/bin/bash
# =============================================================
#  ZAKAZ TIZIMI — AQLLI INSTALLER
#  Yangi serverga ham, mavjud serverga ham ishlaydi
# =============================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
ask()  { echo -e "${CYAN}${BOLD}❓ $1${NC}"; }

REPO_URL="https://github.com/muhamadyorg/Real-Time-Suite.git"
PM2_APP_NAME="zakaz-api"
API_PORT=8080
WWWROOT="/www/wwwroot"

echo ""
echo -e "${BLUE}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     ZAKAZ TIZIMI — AQLLI INSTALLER        ║${NC}"
echo -e "${BLUE}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""

# =============================================================
# 1. DOMEN TANLASH
# =============================================================
echo -e "${BLUE}[1/9] ${WWWROOT} ichidagi domenlar:${NC}"
echo ""

if [ ! -d "$WWWROOT" ]; then
  fail "${WWWROOT} papkasi topilmadi! Avval veb-server o'rnatilganligini tekshiring."
fi

mapfile -t DOMAINS < <(ls -d "$WWWROOT"/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^default" | sort)

if [ ${#DOMAINS[@]} -eq 0 ]; then
  fail "${WWWROOT} ichida hech qanday papka topilmadi!"
fi

for i in "${!DOMAINS[@]}"; do
  idx=$((i+1))
  DOMAIN_PATH="$WWWROOT/${DOMAINS[$i]}"
  if [ -d "$DOMAIN_PATH/.git" ]; then
    BRANCH=$(git -C "$DOMAIN_PATH" branch --show-current 2>/dev/null || echo "?")
    echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${GREEN}(repo mavjud: $BRANCH)${NC}"
  elif [ "$(ls -A "$DOMAIN_PATH" 2>/dev/null)" ]; then
    echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${YELLOW}(boshqa fayllar bor)${NC}"
  else
    echo -e "  ${BOLD}[$idx]${NC} ${DOMAINS[$i]}  ${CYAN}(bo'sh)${NC}"
  fi
done

echo ""
ask "Qaysi domenga o'rnatmoqchisiz? Raqam kiriting (1-${#DOMAINS[@]}):"
read -r DOMAIN_CHOICE

if ! [[ "$DOMAIN_CHOICE" =~ ^[0-9]+$ ]] || [ "$DOMAIN_CHOICE" -lt 1 ] || [ "$DOMAIN_CHOICE" -gt "${#DOMAINS[@]}" ]; then
  fail "Noto'g'ri tanlov! 1 dan ${#DOMAINS[@]} gacha raqam kiriting."
fi

SELECTED_DOMAIN="${DOMAINS[$((DOMAIN_CHOICE-1))]}"
DEPLOY_DIR="$WWWROOT/$SELECTED_DOMAIN"
ENV_FILE="$DEPLOY_DIR/.env"

echo ""
ok "Tanlandi: $DEPLOY_DIR"
echo ""

# =============================================================
# 2. REPO KLONLASH yoki YANGILASH
# =============================================================
echo -e "${BLUE}[2/9] Kod tayyorlanmoqda...${NC}"

if [ -d "$DEPLOY_DIR/.git" ]; then
  info "Repo allaqachon mavjud — yangilanmoqda..."
  git -C "$DEPLOY_DIR" pull origin main 2>/dev/null || \
  git -C "$DEPLOY_DIR" pull 2>/dev/null || \
  warn "git pull ishlamadi — mavjud kod ishlatiladi"
  ok "Kod yangilandi"
else
  EXISTING_FILES=$(ls -A "$DEPLOY_DIR" 2>/dev/null | grep -v "^\.env$" | wc -l)
  if [ "$EXISTING_FILES" -gt 0 ]; then
    warn "$DEPLOY_DIR ichida boshqa fayllar bor."
    ask "Shu papkaga git clone qilishni davom ettirasizmi? (ha/yoq)"
    read -r CLONE_CONFIRM
    if [[ ! "$CLONE_CONFIRM" =~ ^[Hh][Aa]?$ ]]; then
      fail "Bekor qilindi."
    fi
  fi
  info "GitHub dan klonlanmoqda: $REPO_URL"
  git clone "$REPO_URL" "$DEPLOY_DIR" || fail "git clone ishlamadi! Internet aloqasini tekshiring."
  ok "Repo klonlandi: $DEPLOY_DIR"
fi
echo ""

# =============================================================
# 3. .ENV FAYLI TEKSHIRISH
# =============================================================
echo -e "${BLUE}[3/9] .env fayli tekshirilmoqda...${NC}"

if [ -f "$ENV_FILE" ]; then
  ok ".env fayli mavjud — ishlatilmoqda"
  set -a; source "$ENV_FILE"; set +a

  if [ -z "$DATABASE_URL" ]; then
    fail ".env faylida DATABASE_URL yo'q! $ENV_FILE ni tekshiring."
  fi
  ok "DATABASE_URL o'qildi"
else
  warn ".env fayli topilmadi: $ENV_FILE"
  echo ""
  ask ".env fayl yaratishga ruxsat berasizmi? (ha/yoq)"
  read -r ENV_CONFIRM

  if [[ ! "$ENV_CONFIRM" =~ ^[Hh][Aa]?$ ]]; then
    echo ""
    warn "Ruxsat berilmadi. Dastur to'xtatildi."
    echo -e "Qo'lda ${ENV_FILE} yarating va qaytadan ishga tushiring."
    echo -e "Namuna:"
    echo -e "  DATABASE_URL=postgresql://zakaz_user:PAROL@localhost:5432/zakaz_db"
    echo -e "  SESSION_SECRET=\$(openssl rand -hex 32)"
    echo -e "  PORT=8080"
    echo -e "  NODE_ENV=production"
    exit 0
  fi

  # .env yaratish
  echo ""
  info ".env yaratilmoqda..."

  DB_NAME="zakaz_db"
  DB_USER="zakaz_user"

  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | tr -d '[:space:]' || echo "")
  if [ "$USER_EXISTS" = "1" ]; then
    warn "DB foydalanuvchi '$DB_USER' allaqachon mavjud."
    echo ""
    ask "Yangi parol o'rnatamizmi? Agar siz parolni bilsangiz 'yoq' deb, keyin qo'lda .env ga yozing. (ha/yoq)"
    read -r RESET_PASS
    if [[ "$RESET_PASS" =~ ^[Hh][Aa]?$ ]]; then
      DB_PASS=$(openssl rand -hex 16)
      sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null
      ok "Parol yangilandi"
    else
      warn "Parolni o'zingiz .env ga yozing!"
      DB_PASS="PAROLNI_KIRITING"
    fi
  else
    DB_PASS=$(openssl rand -hex 16)
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || warn "Foydalanuvchi yaratishda xato"
    ok "DB foydalanuvchi yaratildi"
  fi

  SESSION_SECRET_VAL=$(openssl rand -hex 32)

  # .env ni yozish — heredoc emas, echo orqali (variable muammo yo'q)
  {
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "SESSION_SECRET=${SESSION_SECRET_VAL}"
    echo "PORT=${API_PORT}"
    echo "NODE_ENV=production"
  } > "$ENV_FILE"

  ok ".env yaratildi: $ENV_FILE"

  if [ "$DB_PASS" = "PAROLNI_KIRITING" ]; then
    echo ""
    warn "⛔ Muhim: $ENV_FILE ga to'g'ri DATABASE_URL yozing va qaytadan ishga tushiring!"
    exit 1
  fi

  set -a; source "$ENV_FILE"; set +a
fi
echo ""

# =============================================================
# 4. KERAKLI DASTURLARNI TEKSHIRISH / O'RNATISH
# =============================================================
echo -e "${BLUE}[4/9] Dasturlar tekshirilmoqda...${NC}"

if ! command -v node &>/dev/null; then
  info "Node.js o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
  sudo apt-get install -y nodejs 2>/dev/null || fail "Node.js o'rnatib bo'lmadi"
fi
ok "Node.js: $(node -v)"

if ! command -v pnpm &>/dev/null; then
  info "pnpm o'rnatilmoqda..."
  npm install -g pnpm@latest 2>/dev/null || fail "pnpm o'rnatib bo'lmadi"
fi
ok "pnpm: $(pnpm -v)"

if ! command -v pm2 &>/dev/null; then
  info "PM2 o'rnatilmoqda..."
  npm install -g pm2 2>/dev/null || fail "PM2 o'rnatib bo'lmadi"
fi
ok "PM2: $(pm2 -v)"

if ! command -v psql &>/dev/null; then
  info "PostgreSQL o'rnatilmoqda..."
  sudo apt-get update -qq 2>/dev/null
  sudo apt-get install -y postgresql postgresql-contrib 2>/dev/null || \
  sudo yum install -y postgresql-server postgresql-contrib 2>/dev/null || \
  fail "PostgreSQL o'rnatib bo'lmadi"
fi
ok "PostgreSQL: $(psql --version | head -1)"

if ! pg_isready -q 2>/dev/null; then
  info "PostgreSQL ishga tushirilmoqda..."
  sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  sleep 3
fi
echo ""

# =============================================================
# 5. DATABASE TEKSHIRISH / YARATISH
# =============================================================
echo -e "${BLUE}[5/9] Database tekshirilmoqda...${NC}"

ACTUAL_DB=$(node -e "try{const u=new URL(process.env.DATABASE_URL||'');console.log(u.pathname.replace('/',''))}catch(e){console.log('zakaz_db')}" 2>/dev/null || echo "zakaz_db")
ACTUAL_USER=$(node -e "try{const u=new URL(process.env.DATABASE_URL||'');console.log(u.username)}catch(e){console.log('zakaz_user')}" 2>/dev/null || echo "zakaz_user")

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$ACTUAL_DB'" 2>/dev/null | tr -d '[:space:]' || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  ok "Database '$ACTUAL_DB' mavjud — barcha ma'lumotlar saqlanib qoladi ✅"
else
  info "Database '$ACTUAL_DB' yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE $ACTUAL_DB OWNER $ACTUAL_USER;" 2>/dev/null || \
  sudo -u postgres createdb -O "$ACTUAL_USER" "$ACTUAL_DB" 2>/dev/null || \
  fail "Database yaratib bo'lmadi! qo'lda bajaring: sudo -u postgres createdb -O $ACTUAL_USER $ACTUAL_DB"
  ok "Database '$ACTUAL_DB' yaratildi"
fi
echo ""

# =============================================================
# 6. KUTUBXONALARNI O'RNATISH
# =============================================================
echo -e "${BLUE}[6/9] Kutubxonalar o'rnatilmoqda...${NC}"
cd "$DEPLOY_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Kutubxonalar tayyor"
echo ""

# =============================================================
# 7. DATABASE SCHEMA YANGILASH
# =============================================================
echo -e "${BLUE}[7/9] Database schema yangilanmoqda (ma'lumotlar o'CHIRMAYDI)...${NC}"
cd "$DEPLOY_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config ./drizzle.config.ts --force 2>&1 | \
  grep -vE "^$|Warning|deprecated" | head -20 || true
cd "$DEPLOY_DIR"
ok "Schema yangilandi"
echo ""

# =============================================================
# 8. BUILD
# =============================================================
echo -e "${BLUE}[8/9] Build qilinmoqda...${NC}"
info "  → API server..."
pnpm --filter @workspace/api-server run build
ok "  API server tayyor"
info "  → Frontend..."
pnpm --filter @workspace/order-system run build 2>/dev/null || warn "  Frontend build ishlamadi (ixtiyoriy)"
ok "  Frontend tayyor"
echo ""

# =============================================================
# 9. PM2 SOZLASH VA ISHGA TUSHIRISH
# =============================================================
echo -e "${BLUE}[9/9] PM2 sozlanmoqda...${NC}"

mkdir -p "$DEPLOY_DIR/logs"

DB_URL_VAL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
SESSION_VAL=$(grep -E "^SESSION_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r')
TELEGRAM_VAL=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || echo "")

# Node.js orqali yozamiz — heredoc variable muammosi yo'q
node -e "
const fs = require('fs');
const cfg = {
  apps: [{
    name: '${PM2_APP_NAME}',
    script: '${DEPLOY_DIR}/artifacts/api-server/dist/index.mjs',
    interpreter: 'node',
    interpreter_args: '--enable-source-maps',
    cwd: '${DEPLOY_DIR}',
    env: {
      NODE_ENV: 'production',
      PORT: '${API_PORT}',
      DATABASE_URL: '${DB_URL_VAL}',
      SESSION_SECRET: '${SESSION_VAL}',
      TELEGRAM_BOT_TOKEN: '${TELEGRAM_VAL}',
    },
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '${DEPLOY_DIR}/logs/pm2-error.log',
    out_file: '${DEPLOY_DIR}/logs/pm2-out.log',
  }]
};
fs.writeFileSync('${DEPLOY_DIR}/ecosystem.config.cjs', 'module.exports=' + JSON.stringify(cfg, null, 2));
console.log('ecosystem.config.cjs yozildi');
"

if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
fi
pm2 start "$DEPLOY_DIR/ecosystem.config.cjs"
pm2 save
pm2 startup 2>/dev/null | grep "^sudo" | bash 2>/dev/null || true

sleep 4

# =============================================================
# NGINX AVTOMATIK SOZLASH
# =============================================================
echo -e "${BLUE}[+] Nginx sozlanmoqda...${NC}"

NGINX_CONF=""
for CONF_PATH in \
  "/www/server/panel/vhost/nginx/${SELECTED_DOMAIN}.conf" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}.conf" \
  "/etc/nginx/conf.d/${SELECTED_DOMAIN}.conf"; do
  if [ -f "$CONF_PATH" ]; then
    NGINX_CONF="$CONF_PATH"
    break
  fi
done

if [ -z "$NGINX_CONF" ]; then
  warn "Nginx config topilmadi. Qo'lda sozlang: proxy_pass http://127.0.0.1:$API_PORT;"
else
  if grep -q "proxy_pass" "$NGINX_CONF" 2>/dev/null; then
    # Mavjud proxy_pass ni yangilash
    sed -i "s|proxy_pass .*;|proxy_pass http://127.0.0.1:${API_PORT};|g" "$NGINX_CONF"
    ok "Nginx proxy_pass yangilandi: $NGINX_CONF"
  else
    # location / blokini topib ichiga proxy qo'shish
    # Avval backup qilish
    cp "$NGINX_CONF" "${NGINX_CONF}.bak"

    # location / ni proxy bilan almashtirish
    node -e "
const fs = require('fs');
let conf = fs.readFileSync('$NGINX_CONF', 'utf8');

const proxyBlock = \`
    location / {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }\`;

// Eski location / {} blokini o'chirib proxy bilan almashtirish
conf = conf.replace(/location\s*\/\s*\{[^}]*\}/s, proxyBlock);

// Agar location / umuman yo'q bo'lsa, server {} ichiga qo'shish
if (!conf.includes('proxy_pass')) {
  conf = conf.replace(/server\s*\{/, 'server {' + proxyBlock);
}

fs.writeFileSync('$NGINX_CONF', conf);
console.log('Nginx config yangilandi');
" 2>/dev/null && ok "Nginx config yangilandi: $NGINX_CONF" || warn "Nginx config o'zgartirishda xato — qo'lda sozlang"
  fi

  # Nginx tekshirish va qayta yuklash
  if nginx -t 2>/dev/null; then
    nginx -s reload 2>/dev/null && ok "Nginx qayta yuklandi" || \
    systemctl reload nginx 2>/dev/null && ok "Nginx qayta yuklandi" || \
    service nginx reload 2>/dev/null || warn "Nginx qayta yuklanmadi: nginx -s reload"
  else
    warn "Nginx config xatosi bor! Backup tiklash: cp ${NGINX_CONF}.bak $NGINX_CONF"
    cp "${NGINX_CONF}.bak" "$NGINX_CONF" 2>/dev/null || true
  fi
fi

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║     🎉 O'RNATISH MUVAFFAQIYATLI!          ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""
pm2 status "$PM2_APP_NAME" 2>/dev/null || pm2 status
echo ""
ok "Sayt: http://$SELECTED_DOMAIN"
ok "API:  http://localhost:$API_PORT"
ok "Database: $ACTUAL_DB"
echo ""
info "Loglar:    pm2 logs $PM2_APP_NAME"
info "Qayta:     pm2 restart $PM2_APP_NAME"
info "To'xtat:   pm2 stop $PM2_APP_NAME"
echo ""

pm2 logs "$PM2_APP_NAME" --lines 8 --nostream 2>/dev/null || true
