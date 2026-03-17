#!/bin/bash
# NurZeka - Tek komutla kurulum / güncelleme
# Kullanım: Projeyi sunucuya yükledikten sonra: chmod +x deploy.sh && ./deploy.sh

set -e
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
RAG_DIR="$PROJECT_ROOT/rag_service"
PY_VENV_DIR="$PROJECT_ROOT/venv"

if [ ! -d "$PY_VENV_DIR" ]; then
    PY_VENV_DIR="$RAG_DIR/venv"
fi

echo "=============================================="
echo "  NurZeka - Otomatik Deploy"
echo "  Proje: $PROJECT_ROOT"
echo "=============================================="
echo ""

# Node.js kontrolü
if ! command -v node &>/dev/null; then
    echo "[HATA] Node.js bulunamadı. Önce Node.js 18+ kurun:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "[OK] Node.js: $NODE_VERSION"
echo ""

# Backend
echo ">>> Backend kuruluyor..."
cd "$BACKEND_DIR"
if [ ! -f "package.json" ]; then
    echo "[HATA] backend/package.json bulunamadı. Proje dizininde deploy.sh çalıştırdığınızdan emin olun."
    exit 1
fi

# .env yoksa .env.example'dan kopyala ve JWT_SECRET otomatik üret
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        if [ -n "$JWT_SECRET" ]; then
            if sed --version &>/dev/null; then
                sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
            else
                sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
            fi
            echo "[OK] .env olusturuldu, JWT_SECRET otomatik atandi."
        else
            echo "[BILGI] .env olusturuldu. JWT_SECRET icin backend/.env dosyasini duzenleyin."
        fi
    else
        echo "[UYARI] .env bulunamadi. PORT=3001 ve JWT_SECRET icin backend/.env dosyasini elle olusturun."
    fi
else
    echo "[OK] .env mevcut"
fi

npm install --production
echo "[OK] Backend bağımlılıkları yüklendi"
echo ""

# PM2
if ! command -v pm2 &>/dev/null; then
    echo ">>> PM2 kuruluyor (global)..."
    npm install -g pm2
fi
echo "[OK] PM2 hazır"
echo ""

# Backend'i PM2 ile başlat veya yeniden başlat
if pm2 describe nurzeka-backend &>/dev/null; then
    echo ">>> Backend yeniden başlatılıyor..."
    pm2 restart nurzeka-backend
else
    echo ">>> Backend ilk kez başlatılıyor..."
    cd "$BACKEND_DIR"
    pm2 start server.js --name nurzeka-backend
fi
echo "[OK] Backend (nurzeka-backend) çalışıyor"
echo ""

# İsteğe bağlı: Python RAG servisi
if [ -d "$RAG_DIR" ] && [ -f "$RAG_DIR/requirements.txt" ]; then
    echo ">>> Python RAG servisi kontrol ediliyor..."
    if command -v python3 &>/dev/null; then
        if [ ! -d "$PY_VENV_DIR" ]; then
            echo "    venv oluşturuluyor..."
            python3 -m venv "$PY_VENV_DIR"
        fi
        cd "$RAG_DIR"
        # Prefer a root-level venv when the project shares one across services.
        source "$PY_VENV_DIR/bin/activate"
        pip install -q -r requirements.txt
        if pm2 describe nurzeka-rag &>/dev/null; then
            pm2 restart nurzeka-rag
            PM2_RAG_NAME="nurzeka-rag"
        elif pm2 describe nurzeka-python &>/dev/null; then
            pm2 restart nurzeka-python
            PM2_RAG_NAME="nurzeka-python"
        else
            pm2 start "$PY_VENV_DIR/bin/uvicorn app:app --host 0.0.0.0 --port 8000" --name nurzeka-rag --cwd "$RAG_DIR"
            PM2_RAG_NAME="nurzeka-rag"
        fi
        echo "[OK] Python RAG servisi ($PM2_RAG_NAME) çalışıyor"
        deactivate 2>/dev/null || true
    else
        echo "[ATLA] python3 yok - RAG servisi başlatılmadı (isteğe bağlı)"
    fi
    echo ""
fi

# PM2 kaydet (sunucu yeniden başlayınca otomatik açılsın)
pm2 save 2>/dev/null || true
if ! pm2 startup 2>/dev/null | grep -q "already"; then
    echo ""
    echo "[BILGI] Sunucu açılışında otomatik başlatma için aşağıdaki komutu (sudo ile) çalıştırın:"
    pm2 startup 2>/dev/null || true
fi

# ── Postgres v2 / Outbox (isteğe bağlı — PG_DATABASE_URL gerektirir) ─────────
echo ""
echo ">>> Postgres v2 katmanı kontrol ediliyor..."
if grep -qE '^PG_DATABASE_URL=.+' "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "[OK] PG_DATABASE_URL ayarli — v2 endpoint'leri aktif olacak."

    # Check Postgres connectivity before running migration
    PG_URL=$(grep '^PG_DATABASE_URL=' "$BACKEND_DIR/.env" | cut -d= -f2-)
    if psql "$PG_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo ">>> Migration çalıştırılıyor (backup + rollback destekli)..."
        bash "$BACKEND_DIR/db/migrate.sh"
        echo "[OK] Migration tamamlandı."

        # Start outbox worker if not already running
        if pm2 describe nurzeka-outbox &>/dev/null; then
            pm2 restart nurzeka-outbox
        else
            cd "$BACKEND_DIR"
            pm2 start scripts/outbox_worker.js --name nurzeka-outbox \
                --max-memory-restart 100M --restart-delay 5000
        fi
        echo "[OK] Outbox worker (nurzeka-outbox) çalışıyor"
    else
        echo "[UYARI] Postgres'e bağlanılamadı. Migration ve outbox worker atlanıyor."
        echo "        PostgreSQL kurulu ve çalışıyor mu kontrol edin."
    fi
else
    echo "[BILGI] PG_DATABASE_URL ayarli degil."
    echo "        v2 endpoint'leri 503 dönecek (v1 SQLite etkilenmez)."
    echo "        Kurulum: backend/.env dosyasina PG_DATABASE_URL ekleyin."
fi

# Ecosystem config ile tüm process'leri yönetmek isterseniz:
# pm2 start /www/wwwroot/nurzek/ecosystem.config.cjs
# (nurzeka-backend + nurzeka-outbox'ı tek komutla başlatır)

echo ""
echo "=============================================="
echo "  Deploy tamamlandı."
echo "  Backend: http://localhost:3001"
echo "  Durum:  pm2 status"
echo "  Loglar: pm2 logs nurzeka-backend"
echo "  Outbox: pm2 logs nurzeka-outbox"
echo "=============================================="
echo ""
echo "Kurulum tamam. Uygulama calisiyor."
echo "Google giris veya DeepSeek API kullanacaksaniz backend/.env duzenleyip: pm2 restart nurzeka-backend"
echo ""

