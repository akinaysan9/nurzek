# Risale-i Nur AI (NurZeka) – Sunucuya Deploy Rehberi

Bu rehber projeyi kendi sunucunuza (VPS, bulut sunucu vb.) nasıl deploy edeceğinizi adım adım anlatır.

---

## Deploy ZIP ile tek komut kurulum (önerilen)

1. **ZIP oluştur (Windows’ta, proje klasöründe):**
   ```powershell
   .\build-deploy-zip.ps1
   ```
   Script sadece gerekli dosyaları (backend kaynak, frontend, rag_service, knowledge-base, deploy.sh; node_modules ve .env hariç) içeren **nurzeka_deploy.zip** oluşturur.

2. **nurzeka_deploy.zip** dosyasını sunucuya yükleyin (SCP, SFTP veya panel).

3. **Sunucuda Node.js kurulu olsun** (yoksa aşağıdaki “Sunucu Gereksinimleri”ne bakın).

4. **Sunucuda tek komut:**
   ```bash
   unzip -o nurzeka_deploy.zip && cd risale-nur-ai && chmod +x deploy.sh && ./deploy.sh
   ```
   Zip açılır, kurulum (npm install, PM2 vb.) çalışır.

5. Kurulum biter; uygulama çalışır. JWT_SECRET otomatik atanır. Google giriş veya DeepSeek kullanacaksanız `backend/.env` düzenleyip `pm2 restart nurzeka` yapın. Zip içinde **KURULUM.txt** da vardır.

---

## Otomatik deploy (dosyayı zipsiz yükleyip tek komut)

1. **Projeyi sunucuya yükle**  
   ZIP açarak, SCP/SFTP ile veya Git ile proje klasörünü sunucuya koy (örn. `/var/www/risale-nur-ai`).

2. **Sunucuda Node.js kurulu olsun** (yoksa aşağıdaki “Sunucu Gereksinimleri” bölümüne bak).

3. **Tek komutla kurulum:**
   ```bash
   cd /var/www/risale-nur-ai   # projenin olduğu klasör
   chmod +x deploy.sh
   ./deploy.sh
   ```
   Script: backend bağımlılıklarını yükler, `.env` yoksa `.env.example`'dan oluşturur, PM2 ile uygulamayı başlatır. Varsa Python RAG servisini de kurup başlatır.

4. **İlk kurulumda** `backend/.env` dosyasını açıp `JWT_SECRET` (ve isteğe bağlı `GOOGLE_CLIENT_ID`, `DEEPSEEK_API_KEY`) değerlerini düzenle. Sonra:
   ```bash
   pm2 restart nurzeka
   ```

Aynı `./deploy.sh` komutunu projeyi güncelledikten sonra tekrar çalıştırarak **güncelleme** de yapabilirsin; bağımlılıklar güncellenir ve servisler yeniden başlar.

---

## Genel Bakış

- **Backend:** Node.js (Express), varsayılan port **3001**
- **Frontend:** `frontend/` klasöründe statik dosyalar; backend bunları sunar
- **İsteğe bağlı:** Python `rag_service` (port **8000**) – kavram haritası, konuşmalar vb. için

Sunucuda en azından **Node.js backend** çalıştırmanız yeterli; Python servisi olmadan da uygulama çalışır (ilgili özellikler hata mesajı verir).

---

## 1. Sunucu Gereksinimleri

- **İşletim sistemi:** Ubuntu 22.04 LTS (veya benzeri Linux)
- **Node.js:** 18.x veya 20.x (LTS)
- **RAM:** En az 1 GB (Python servisi ile 2 GB+ önerilir)
- **Disk:** Proje + `knowledge-base` + veritabanı için yeterli alan

---

## 2. Sunucuda Node.js Kurulumu

```bash
# Node.js 20.x (LTS) kurulumu (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kontrol
node -v   # v20.x.x
npm -v
```

---

## 3. Projeyi Sunucuya Taşımak

### Seçenek A: Git ile (tercih edilen)

Sunucuda:

```bash
cd /var/www   # veya istediğiniz dizin
sudo git clone <repo-url> risale-nur-ai
cd risale-nur-ai
```

### Seçenek B: SCP/SFTP ile dosya kopyalama

Bilgisayarınızdan (PowerShell veya WinSCP):

```powershell
scp -r C:\Users\aysan\Desktop\risale-nur-ai kullanici@SUNUCU_IP:/var/www/risale-nur-ai
```

Sunucuda proje dizinine girin: `cd /var/www/risale-nur-ai`

---

## 4. Backend Kurulumu ve Ortam Değişkenleri

```bash
cd /var/www/risale-nur-ai/backend

# Bağımlılıkları yükle
npm install --production

# Ortam değişkenleri için .env dosyası
cp .env.example .env
nano .env   # veya vim .env
```

**.env** içeriği (değerleri kendinize göre doldurun):

```env
PORT=3001
JWT_SECRET=buraya-güçlü-rastgele-bir-anahtar-yazin
DB_PATH=./nurzeka.db

# Google ile giriş için (isteğe bağlı)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Metin sadeleştirme / analiz için (isteğe bağlı)
DEEPSEEK_API_KEY=sk-...
```

- `JWT_SECRET`: En az 32 karakter rastgele bir string (üretmek için: `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID`: Google Cloud Console’da OAuth 2.0 Client ID oluşturup buraya yazın
- `DEEPSEEK_API_KEY`: [DeepSeek](https://platform.deepseek.com/) API anahtarınız

Kaydedip çıkın (nano: Ctrl+O, Enter, Ctrl+X).

---

## 5. Uygulamayı Çalıştırmak

### Hızlı test (tek seferlik)

```bash
cd /var/www/risale-nur-ai/backend
npm start
```

Tarayıcıda: `http://SUNUCU_IP:3001`  
Çalışıyorsa doğru yapılandırılmışsınızdır. Durdurmak için Ctrl+C.

### Sürekli çalışması için: PM2

PM2, uygulamanın arka planda çalışmasını ve çökünce yeniden başlamasını sağlar.

```bash
# PM2 kurulumu
sudo npm install -g pm2

# Backend’i PM2 ile başlat
cd /var/www/risale-nur-ai/backend
pm2 start server.js --name nurzeka

# Durum
pm2 status
pm2 logs nurzeka

# Sunucu açıldığında otomatik başlasın
pm2 startup
pm2 save
```

---

## 6. (İsteğe Bağlı) Python RAG Servisi

Kavram haritası, konuşma geçmişi vb. özellikleri kullanacaksanız Python servisini de çalıştırın.

```bash
# Python 3.10+ ve venv
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

cd /var/www/risale-nur-ai/rag_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

`.env` (rag_service klasöründe veya ana projede, uygulama nereden okuyorsa):

```env
DEEPSEEK_API_KEY=sk-...
```

Başlatma:

```bash
# Manuel
uvicorn app:app --host 0.0.0.0 --port 8000

# PM2 ile (venv içinden çalıştırmak için)
cd /var/www/risale-nur-ai/rag_service
pm2 start "venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000" --name nurzeka-python
pm2 save
```

Backend zaten `localhost:8000` üzerinden bu servise istek atıyor; ekstra ayar gerekmez.

---

## 7. Nginx ile Reverse Proxy (Önerilen)

80/443 portlarında Nginx kullanıp tek bir adresle (örn. `https://nurzeka.example.com`) erişmek için:

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/nurzeka
```

Aşağıdaki bloku ekleyin (domain’i kendinize göre değiştirin):

```nginx
server {
    listen 80;
    server_name nurzeka.example.com;   # Kendi domain'iniz

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Siteyi etkinleştirip Nginx’i yenileyin:

```bash
sudo ln -s /etc/nginx/sites-available/nurzeka /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Artık `http://nurzeka.example.com` adresinden erişebilirsiniz.

---

## 8. HTTPS (SSL) – Let’s Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nurzeka.example.com
```

Sorguları cevaplayın; sertifika otomatik eklenir ve yenileme ayarlanır. Adres: `https://nurzeka.example.com`

---

## 9. Güvenlik Kontrol Listesi

- [ ] `.env` dosyası sunucuda sadece okunabilir: `chmod 600 backend/.env`
- [ ] `JWT_SECRET` güçlü ve benzersiz
- [ ] Firewall: sadece 22 (SSH), 80, 443 açık; 3001 ve 8000 sadece localhost’ta kalsın (Nginx proxy kullanıyorsanız zaten dışarı açık değildir)
- [ ] Google OAuth için Authorized redirect URI’ye production URL’inizi ekleyin (örn. `https://nurzeka.example.com`)

---

## 10. Güncelleme (Yeniden Deploy)

```bash
cd /var/www/risale-nur-ai
git pull   # Git kullanıyorsanız

cd backend
npm install --production
pm2 restart nurzeka

# Python kullanıyorsanız
cd ../rag_service
source venv/bin/activate
pip install -r requirements.txt
pm2 restart nurzeka-python
```

---

## Özet Komutlar (Tek Sunucu, Sadece Node)

```bash
# Sunucuda
cd /var/www/risale-nur-ai/backend
npm install --production
cp .env.example .env && nano .env
pm2 start server.js --name nurzeka
pm2 startup && pm2 save
```

Sonrasında Nginx + domain + SSL ile `https://domain.com` üzerinden yayına alabilirsiniz.

Takıldığınız adımı yazarsanız, o adımı birlikte netleştirebiliriz.
