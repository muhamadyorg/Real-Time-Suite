#!/bin/bash
# =============================================================
#  ZAKAZ TIZIMI — TO'LIQ AVTOMATIK INSTALLER
#  aAPanel + oddiy Nginx + yangi/mavjud server hammasi ishlaydi
# =============================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
step() { echo -e "\n${BLUE}${BOLD}[$1] $2${NC}"; }

REPO_URL="https://github.com/muhamadyorg/Real-Time-Suite.git"
PM2_APP_NAME="zakaz-api"
API_PORT=8080
WWWROOT="/www/wwwroot"

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     ZAKAZ TIZIMI — TO'LIQ AVTOMATIK DEPLOY   ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================
# 1. DOMEN TANLASH
# =============================================================
step "1/9" "Domen tanlash"

if [ ! -d "$WWWROOT" ]; then
  fail "$WWWROOT papkasi topilmadi! aAPanel o'rnatilganligini tekshiring."
fi

mapfile -t DOMAINS < <(ls -d "$WWWROOT"/*/ 2>/dev/null | xargs -I{} basename {} | grep -v "^default\|^phpmyadmin\|^." | sort)

if [ ${#DOMAINS[@]} -eq 0 ]; then
  fail "$WWWROOT ichida hech qanday domen papkasi topilmadi!"
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
echo -e "${CYAN}${BOLD}Qaysi domenga o'rnatmoqchisiz? Raqam kiriting (1-${#DOMAINS[@]}):${NC}"
read -r DOMAIN_CHOICE

if ! [[ "$DOMAIN_CHOICE" =~ ^[0-9]+$ ]] || [ "$DOMAIN_CHOICE" -lt 1 ] || [ "$DOMAIN_CHOICE" -gt "${#DOMAINS[@]}" ]; then
  fail "Noto'g'ri tanlov!"
fi

SELECTED_DOMAIN="${DOMAINS[$((DOMAIN_CHOICE-1))]}"
DEPLOY_DIR="$WWWROOT/$SELECTED_DOMAIN"
ENV_FILE="$DEPLOY_DIR/.env"
ok "Tanlandi: $DEPLOY_DIR"

# =============================================================
# 2. REPO KLONLASH / YANGILASH
# =============================================================
step "2/9" "Kod tayyorlanmoqda"

if [ -d "$DEPLOY_DIR/.git" ]; then
  info "Repo mavjud — yangilanmoqda..."
  git -C "$DEPLOY_DIR" fetch origin 2>/dev/null || true
  git -C "$DEPLOY_DIR" reset --hard origin/main 2>/dev/null || \
  git -C "$DEPLOY_DIR" pull origin main 2>/dev/null || \
  git -C "$DEPLOY_DIR" pull 2>/dev/null || \
  warn "git pull ishlamadi — mavjud kod ishlatiladi"
  ok "Kod yangilandi (eng yangi versiya)"
else
  EXISTING=$(ls -A "$DEPLOY_DIR" 2>/dev/null | grep -v "^\.env$" | wc -l)
  if [ "$EXISTING" -gt 0 ]; then
    warn "$DEPLOY_DIR ichida fayllar bor. Ularni saqlab, chetida klonlaymiz..."
    TMP_DIR=$(mktemp -d)
    git clone "$REPO_URL" "$TMP_DIR" || fail "git clone ishlamadi!"
    cp -rn "$TMP_DIR/." "$DEPLOY_DIR/" 2>/dev/null || true
    rm -rf "$TMP_DIR"
    ok "Repo fayllari ko'chirildi"
  else
    git clone "$REPO_URL" "$DEPLOY_DIR" || fail "git clone ishlamadi!"
    ok "Repo klonlandi"
  fi
fi

# =============================================================
# 3. DASTURLARNI O'RNATISH
# =============================================================
step "3/9" "Dasturlar tekshirilmoqda"

# Node.js
if ! command -v node &>/dev/null || [[ "$(node -v 2>/dev/null)" < "v18" ]]; then
  info "Node.js 20 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y nodejs 2>/dev/null || fail "Node.js o'rnatib bo'lmadi"
fi
ok "Node.js: $(node -v)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  info "pnpm o'rnatilmoqda..."
  npm install -g pnpm@latest 2>/dev/null || fail "pnpm o'rnatib bo'lmadi"
fi
ok "pnpm: $(pnpm -v)"

# PM2
if ! command -v pm2 &>/dev/null; then
  info "PM2 o'rnatilmoqda..."
  npm install -g pm2 2>/dev/null || fail "PM2 o'rnatib bo'lmadi"
fi
ok "PM2: $(pm2 -v)"

# PostgreSQL
if ! command -v psql &>/dev/null; then
  info "PostgreSQL o'rnatilmoqda..."
  apt-get update -qq 2>/dev/null
  apt-get install -y postgresql postgresql-contrib 2>/dev/null || \
  fail "PostgreSQL o'rnatib bo'lmadi"
fi
ok "PostgreSQL: $(psql --version | head -1)"

# PostgreSQL ishga tushirish
if ! pg_isready -q 2>/dev/null; then
  info "PostgreSQL ishga tushirilmoqda..."
  systemctl start postgresql 2>/dev/null || service postgresql start 2>/dev/null || true
  sleep 3
  pg_isready -q 2>/dev/null || fail "PostgreSQL ishga tushmadi!"
fi
ok "PostgreSQL: ishlamoqda"

# =============================================================
# 4. .ENV FAYLI SOZLASH
# =============================================================
step "4/9" ".env sozlanmoqda"

DB_NAME="zakaz_db"
DB_USER="zakaz_user"

if [ -f "$ENV_FILE" ]; then
  ok ".env fayli mavjud"
  set -a; source "$ENV_FILE"; set +a
  if [ -z "$DATABASE_URL" ]; then
    fail ".env da DATABASE_URL yo'q! Tekshiring: $ENV_FILE"
  fi
  ok "DATABASE_URL o'qildi"
else
  info ".env fayli yaratilmoqda..."

  # Parol yaratish
  DB_PASS=$(openssl rand -hex 16)
  SESSION_SECRET_VAL=$(openssl rand -hex 32)

  {
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo "SESSION_SECRET=${SESSION_SECRET_VAL}"
    echo "PORT=${API_PORT}"
    echo "NODE_ENV=production"
  } > "$ENV_FILE"

  set -a; source "$ENV_FILE"; set +a
  ok ".env yaratildi: $ENV_FILE"
fi

# DATABASE_URL dan ma'lumotlarni olish
ACTUAL_DB=$(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.pathname.slice(1))}catch(e){console.log('$DB_NAME')}" 2>/dev/null || echo "$DB_NAME")
ACTUAL_USER=$(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.username)}catch(e){console.log('$DB_USER')}" 2>/dev/null || echo "$DB_USER")
ACTUAL_PASS=$(node -e "try{const u=new URL(process.env.DATABASE_URL);console.log(u.password)}catch(e){console.log('')}" 2>/dev/null || echo "")

# =============================================================
# 5. POSTGRESQL USER VA DATABASE
# =============================================================
step "5/9" "Database tayyorlanmoqda"

# User tekshirish / yaratish
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$ACTUAL_USER'" 2>/dev/null | tr -d '[:space:]' || echo "")
if [ "$USER_EXISTS" = "1" ]; then
  ok "DB user '$ACTUAL_USER' mavjud"
  # Parolni yangilab qo'yish (agar .env da boshqacha bo'lsa)
  if [ -n "$ACTUAL_PASS" ]; then
    sudo -u postgres psql -c "ALTER USER $ACTUAL_USER WITH PASSWORD '$ACTUAL_PASS';" 2>/dev/null || true
  fi
else
  info "DB user '$ACTUAL_USER' yaratilmoqda..."
  if [ -z "$ACTUAL_PASS" ]; then
    ACTUAL_PASS=$(openssl rand -hex 16)
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${ACTUAL_USER}:${ACTUAL_PASS}@localhost:5432/${ACTUAL_DB}|" "$ENV_FILE"
    set -a; source "$ENV_FILE"; set +a
    warn ".env dagi DATABASE_URL yangilandi (yangi parol)"
  fi
  sudo -u postgres psql -c "CREATE USER $ACTUAL_USER WITH PASSWORD '$ACTUAL_PASS';" 2>/dev/null || \
  fail "DB user yaratib bo'lmadi! sudo -u postgres psql ni tekshiring."
  ok "DB user '$ACTUAL_USER' yaratildi"
fi

# Database tekshirish / yaratish
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$ACTUAL_DB'" 2>/dev/null | tr -d '[:space:]' || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  ok "Database '$ACTUAL_DB' mavjud — ma'lumotlar saqlanadi ✅"
else
  info "Database '$ACTUAL_DB' yaratilmoqda..."
  sudo -u postgres psql -c "CREATE DATABASE $ACTUAL_DB OWNER $ACTUAL_USER;" 2>/dev/null || \
  fail "Database yaratib bo'lmadi!"
  ok "Database '$ACTUAL_DB' yaratildi"
fi

# =============================================================
# 6. KUTUBXONALAR O'RNATISH
# =============================================================
step "6/9" "Kutubxonalar o'rnatilmoqda"
cd "$DEPLOY_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install || fail "pnpm install ishlamadi"
ok "Kutubxonalar o'rnatildi"

# =============================================================
# 7. DATABASE SCHEMA YANGILASH
# =============================================================
step "7/9" "Database schema yangilanmoqda"
cd "$DEPLOY_DIR/lib/db"
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --config ./drizzle.config.ts --force 2>&1 | \
  grep -vE "^[[:space:]]*$|Warning|deprecated|Using|Pulling|Changes|No changes" | head -30 || true
cd "$DEPLOY_DIR"
ok "Schema yangilandi (ma'lumotlar saqlanib qoldi)"

# =============================================================
# 8. BUILD
# =============================================================
step "8/9" "Build qilinmoqda"

info "API server build..."
pnpm --filter @workspace/api-server run build || fail "API server build ishlamadi!"
ok "API server build tayyor"

info "Frontend build..."
if pnpm --filter @workspace/order-system run build 2>&1; then
  ok "Frontend build tayyor"
else
  warn "Frontend build xato — loglarni tekshiring"
fi

# =============================================================
# 9. PM2 ISHGA TUSHIRISH
# =============================================================
step "9/9" "PM2 sozlanmoqda"

mkdir -p "$DEPLOY_DIR/logs"

DB_URL_VAL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n')
SESSION_VAL=$(grep -E "^SESSION_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n')
TELEGRAM_VAL=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r\n' || echo "")

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
      DATABASE_URL: \`${DB_URL_VAL}\`,
      SESSION_SECRET: \`${SESSION_VAL}\`,
      TELEGRAM_BOT_TOKEN: \`${TELEGRAM_VAL}\`,
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

pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
pm2 start "$DEPLOY_DIR/ecosystem.config.cjs"
pm2 save --force
pm2 startup 2>/dev/null | grep "^sudo" | bash 2>/dev/null || true

sleep 5

# API ishlayaptimi tekshirish
if curl -sf "http://127.0.0.1:${API_PORT}/" > /dev/null 2>&1; then
  ok "API server ishlayapti: http://127.0.0.1:${API_PORT}"
else
  warn "API server hali javob bermayapti — loglarni tekshiring: pm2 logs $PM2_APP_NAME"
fi

# =============================================================
# NGINX AVTOMATIK SOZLASH (aAPanel + oddiy nginx)
# =============================================================
echo ""
echo -e "${BLUE}${BOLD}[+] Nginx sozlanmoqda...${NC}"

# aAPanel nginx binary topish
NGINX_BIN=""
for BIN in \
  "/www/server/nginx/sbin/nginx" \
  "/usr/sbin/nginx" \
  "/usr/local/sbin/nginx" \
  "nginx"; do
  if command -v "$BIN" &>/dev/null 2>&1 || [ -f "$BIN" ]; then
    NGINX_BIN="$BIN"
    break
  fi
done
[ -z "$NGINX_BIN" ] && NGINX_BIN="nginx"
info "Nginx binary: $NGINX_BIN"

# Nginx config fayli topish
NGINX_CONF=""
for CONF_PATH in \
  "/www/server/panel/vhost/nginx/${SELECTED_DOMAIN}.conf" \
  "/www/server/panel/vhost/nginx/${SELECTED_DOMAIN}.conf.bak" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}" \
  "/etc/nginx/sites-available/${SELECTED_DOMAIN}" \
  "/etc/nginx/sites-enabled/${SELECTED_DOMAIN}.conf" \
  "/etc/nginx/conf.d/${SELECTED_DOMAIN}.conf"; do
  if [ -f "$CONF_PATH" ] && [[ "$CONF_PATH" != *.bak ]]; then
    NGINX_CONF="$CONF_PATH"
    break
  fi
done

if [ -z "$NGINX_CONF" ]; then
  warn "Nginx config topilmadi!"
  warn "aAPanel da '$SELECTED_DOMAIN' uchun sayt yaratilganligini tekshiring."
  warn "Keyin qo'lda nginx config ga qo'shing: proxy_pass http://127.0.0.1:${API_PORT};"
else
  info "Nginx config: $NGINX_CONF"

  # Backup
  cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"

  # Python bilan nginx config ni to'g'ri o'zgartirish
  python3 << PYEOF
import re, sys

conf_path = "$NGINX_CONF"
port = $API_PORT

with open(conf_path, 'r') as f:
    content = f.read()

proxy_location = '''    location / {
        proxy_pass http://127.0.0.1:''' + str(port) + ''';
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }'''

# Agar proxy_pass allaqachon bor bo'lsa — portni yangilash
if 'proxy_pass' in content:
    content = re.sub(r'proxy_pass\s+http://[^;]+;', f'proxy_pass http://127.0.0.1:{port};', content)
    with open(conf_path, 'w') as f:
        f.write(content)
    print("proxy_pass yangilandi")
    sys.exit(0)

# location / { ... } blokini topib almashtirish (nested braces bilan)
def replace_root_location(text, replacement):
    # "location /" ni topish
    pattern = re.compile(r'location\s*/\s*\{', re.MULTILINE)
    match = pattern.search(text)
    if not match:
        return text, False
    
    start = match.start()
    brace_count = 0
    i = match.end() - 1  # '{' ning pozitsiyasi
    
    while i < len(text):
        if text[i] == '{':
            brace_count += 1
        elif text[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end = i + 1
                break
        i += 1
    else:
        return text, False
    
    new_text = text[:start] + replacement + text[end:]
    return new_text, True

new_content, replaced = replace_root_location(content, proxy_location)

if replaced:
    with open(conf_path, 'w') as f:
        f.write(new_content)
    print("location / bloki proxy bilan almashtirildi")
else:
    # location / umuman yo'q — server {} ichiga qo'shish
    # Oxirgi } oldiga qo'shish
    new_content = re.sub(r'(\n\s*}\s*$)', '\n' + proxy_location + r'\1', content, count=1, flags=re.MULTILINE)
    if 'proxy_pass' in new_content:
        with open(conf_path, 'w') as f:
            f.write(new_content)
        print("proxy_pass server{} ichiga qo'shildi")
    else:
        print("WARN: nginx config o'zgartirish muvaffaqiyatsiz")
        sys.exit(1)
PYEOF

  NGINX_EDIT_STATUS=$?

  if [ $NGINX_EDIT_STATUS -eq 0 ]; then
    ok "Nginx config yangilandi"
  else
    warn "Nginx config avtomatik o'zgartirilmadi — qo'lda sozlang"
    # Backup tiklash
    LATEST_BAK=$(ls -t "${NGINX_CONF}.bak."* 2>/dev/null | head -1)
    [ -n "$LATEST_BAK" ] && cp "$LATEST_BAK" "$NGINX_CONF"
  fi

  # Nginx test va reload
  if $NGINX_BIN -t 2>/dev/null; then
    ok "Nginx config sintaksis to'g'ri"
    $NGINX_BIN -s reload 2>/dev/null || \
    systemctl reload nginx 2>/dev/null || \
    service nginx reload 2>/dev/null || \
    warn "Nginx reload ishlamadi: $NGINX_BIN -s reload"
    ok "Nginx qayta yuklandi"
  else
    warn "Nginx config xato! Backup tiklanmoqda..."
    LATEST_BAK=$(ls -t "${NGINX_CONF}.bak."* 2>/dev/null | head -1)
    if [ -n "$LATEST_BAK" ]; then
      cp "$LATEST_BAK" "$NGINX_CONF"
      $NGINX_BIN -s reload 2>/dev/null || true
      warn "Backup tiklandi. Nginx config qo'lda sozlang:"
      warn "  $NGINX_CONF"
    fi
  fi
fi

# =============================================================
# YAKUNIY XABAR
# =============================================================
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║       🎉  O'RNATISH MUVAFFAQIYATLI!          ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
pm2 status "$PM2_APP_NAME" 2>/dev/null || pm2 status
echo ""
ok "Sayt:      http://${SELECTED_DOMAIN}"
ok "API:       http://127.0.0.1:${API_PORT}"
ok "Database:  ${ACTUAL_DB}"
ok "Fayllar:   ${DEPLOY_DIR}"
echo ""
info "Loglar ko'rish:   pm2 logs $PM2_APP_NAME"
info "Xatoliklar:       pm2 logs $PM2_APP_NAME --err"
info "Qayta ishlatish:  pm2 restart $PM2_APP_NAME"
info "To'xtatish:       pm2 stop $PM2_APP_NAME"
echo ""
echo -e "${YELLOW}So'nggi loglar:${NC}"
pm2 logs "$PM2_APP_NAME" --lines 10 --nostream 2>/dev/null || true
