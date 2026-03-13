#!/bin/bash
# NurZeka Mobile Fix Deploy Script
# Bu scripti aaPanel terminaline yapıştırıp çalıştırın, ancak ÖNCE dosyaları yüklemeniz gerekir.

echo "🚀 NurZeka Mobil Düzeltme Başlıyor..."

# Hedef klasörler
SRC_DIR="/www/wwwroot/nurzek/frontend/src"
ROOT_DIR="/www/wwwroot/nurzek/frontend"

# 1. Dosyaların yüklendiğini varsayıyoruz (Manual Upload)
# Kullanıcı bu 3 dosyayı (index.html, main.js, extra.css) sunucuya atmalı.

echo "⚠️  Lütfen şu dosyaları sunucuya yüklediğinizden emin olun:"
echo "   - frontend/index.html -> $ROOT_DIR/index.html"
echo "   - frontend/src/main.js -> $SRC_DIR/main.js"
echo "   - frontend/src/extra.css -> $SRC_DIR/extra.css"
echo "   - frontend/src/ui-overrides.css -> $SRC_DIR/ui-overrides.css"
echo ""
read -p "Dosyaları yüklediniz mi? (e/h): " confirm

if [ "$confirm" != "e" ]; then
    echo "❌ Lütfen önce dosyaları File Manager ile yükleyin."
    exit 1
fi

# 2. Dosya izinlerini düzelt
echo "🔧 İzinler düzenleniyor..."
chmod 644 "$ROOT_DIR/index.html"
chmod 644 "$SRC_DIR/main.js"
chmod 644 "$SRC_DIR/extra.css"
chmod 644 "$SRC_DIR/ui-overrides.css"

# 3. Cache Buster (Tarayıcı önbelleğini temizlemek için versiyon artır)
# index.html içindeki versiyonları güncelleyeceğiz
echo "🔄 Cache versiyonları güncelleniyor..."
# main.js?v=X -> main.js?v=$(date +%s)
sed -i "s/main.js?v=[0-9]*/main.js?v=$(date +%s)/g" "$ROOT_DIR/index.html"
# extra.css?v=X -> extra.css?v=$(date +%s)
sed -i "s/extra.css?v=[0-9]*/extra.css?v=$(date +%s)/g" "$ROOT_DIR/index.html"
# ui-overrides.css?v=X -> ui-overrides.css?v=$(date +%s)
sed -i "s/ui-overrides.css?v=[0-9]*/ui-overrides.css?v=$(date +%s)/g" "$ROOT_DIR/index.html"


# 4. Sunucuyu Yeniden Başlat (PM2)
if command -v pm2 &> /dev/null; then
    echo "🔄 PM2 Yeniden başlatılıyor..."
    pm2 restart nurzeka
else
    echo "ℹ️ PM2 bulunamadı, elle restart gerekebilir."
fi

echo ""
echo "✅ Kurulum Tamamlandı!"
echo "📱 Telefondan girerken sayfayı yenilemeyi unutmayın!"
