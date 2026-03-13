#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  🕌 NurZeka - Tam Otomatik Kurulum Scripti
#  Dosyaları FTP'ye atın, bu scripti bir kez çalıştırın, hepsi tamam!
# ═══════════════════════════════════════════════════════════════

set -e

PROJE_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJE_DIR/backend"

echo ""
echo "═══════════════════════════════════════"
echo "  🕌 NurZeka Otomatik Kurulum"
echo "═══════════════════════════════════════"
echo ""

# ── 1. Node.js Kontrolü ──
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js bulunamadı. Otomatik kurulum deneniyor..."
    if command -v apt &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo "❌ Node.js otomatik kurulamadı. Lütfen aaPanel > App Store > Node.js Manager ile kurun."
        exit 1
    fi
fi
echo "✅ Node.js: $(node -v)"

# ── 2. .env Dosyası (Önceden Yapılandırılmış) ──
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "⚙️  .env dosyası oluşturuluyor..."
    cat <<'EOF' > "$BACKEND_DIR/.env"
# NurZeka - Risale-i Nur AI Platform
# API Keys
DEEPSEEK_API_KEY=sk-20fdf00ebb374e22b4c9efd53fe0ff4d
DEEPSEEK_BASE_URL=https://api.deepseek.com
GEMINI_API_KEY=

# Server
PORT=3001
JWT_SECRET=nurzeka-secret-key-2026

# Database
DB_PATH=./db/nurzeka.db
EOF
    echo "✅ .env dosyası oluşturuldu."
else
    echo "✅ .env dosyası zaten mevcut."
fi

# ── 3. Bağımlılıkları Kur ──
echo "📦 Bağımlılıklar kuruluyor..."
cd "$BACKEND_DIR"
npm install --production 2>&1 | tail -3
echo "✅ Bağımlılıklar kuruldu."

# ── 4. pm2 ile Sunucuyu Başlat (Kalıcı) ──
if ! command -v pm2 &> /dev/null; then
    echo "📦 pm2 kuruluyor (otomatik yeniden başlatma için)..."
    npm install -g pm2
fi

# Eski instance varsa durdur
pm2 delete nurzeka 2>/dev/null || true

# Başlat
echo "🚀 Sunucu başlatılıyor..."
pm2 start server.js --name "nurzeka" --cwd "$BACKEND_DIR"

# Sistem açılışında otomatik başlat
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ KURULUM TAMAMLANDI!"
echo "═══════════════════════════════════════"
echo ""
echo "  🌐 Site Adresi: http://localhost:3001"
echo "  📊 Durum:       pm2 status"
echo "  📋 Loglar:      pm2 logs nurzeka"
echo "  🔄 Yeniden:     pm2 restart nurzeka"
echo ""
echo "  Cloudflare Tunnel'da localhost:3001"
echo "  adresini yönlendirmeniz yeterli."
echo ""
echo "═══════════════════════════════════════"
