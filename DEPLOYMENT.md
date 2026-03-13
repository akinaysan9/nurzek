# NurZeka Deployment Guide (Kurulum Kılavuzu)

Bu proje modern bir **Node.js** uygulamasıdır. Klasik PHP/HTML sitelerinden farklı çalışır. Sunucuya sadece dosyaları yüklemek (FTP ile atıp bırakmak) yetmez, uygulamanın **çalıştırılması** gerekir.

## 1. Hosting Gereksinimleri
Projenin çalışması için sunucuda şunlar olmalıdır:
- **Node.js:** v18 veya üzeri (Pek çok güncel hosting panelinde "Setup Node.js App" seçeneği ile açılabilir).
- **RAM:** En az 512MB (Önerilen: 1GB).
- **Disk:** SQLite veritabanı ve Külliyat metinleri için kalıcı disk (Persistent Storage).

## 2. Neden Sadece Dosya Yüklemek Yetmez?
- **Backend (Arka Plan):** `server.js` dosyası sürekli çalışmalıdır. Bu dosya API isteklerini karşılar, arama yapar ve AI servisine bağlanır.
- **Veritabanı:** `risale-nur.db` ve `knowledge-base` klasörü sunucuda yazılabilir olmalıdır.
- **AI İşlemi:** Yapay zeka yerel bilgisayarınızda değil, API üzerinden (DeepSeek) çalıştığı için sunucuyu yormaz. Bu büyük avantajdır.

## 3. Kurulum Yöntemleri

### A. Standart Hosting (cPanel/Plesk)
Eğer hosting paketinizde **Node.js Desteği** varsa:
1.  Hosting panelinden "Node.js Uygulaması Oluştur" deyin.
2.  Dosyaları `httpdocs` veya belirtilen klasöre yükleyin.
3.  `backend/package.json` dosyasını seçip `npm install` komutunu panelden çalıştırın.
4.  `.env` dosyasını oluşturup içine API anahtarınızı ekleyin (`DEEPSEEK_API_KEY=...`).
5.  Uygulamayı başlatın.

### B. Sanal Sunucu (VPS - DigitalOcean, Hetzner vb.) - **ÖNERİLEN**
En sorunsuz yöntemdir.
1.  Sunucuya SSH ile bağlanın.
2.  Node.js kurun.
3.  Projeyi `git` ile veya zip ile yükleyin.
4.  `npm install` ile paketleri kurun.
5.  `pm2` gibi bir araçla uygulamayı sürekli açık tutun:
    ```bash
    npm install -g pm2
    pm2 start backend/server.js --name "nurzeka"
    ```

### D. aaPanel / CasaOS (Kendi Sunucunuz) - **SİZİN İÇİN EN UYGUNU**
Elinizdeki bilgisayar (i7, 8GB RAM) bu proje için **fazlasıyla yeterli ve mükemmel**.

**aaPanel Kurulum Adımları:**
1.  **Node.js Manager Kurun:** aaPanel "App Store" içinde "Node.js Version Manager" bulun ve kurun.
2.  **Dosya Yükleme:**
    - Projenin `backend` ve `frontend` klasörlerini bir ZIP yapın.
    - aaPanel "Files" kısmından `/www/wwwroot/nurzeka` gibi bir klasöre yükleyip ZIP'i açın.
3.  **Proje Oluşturma (Website > Node Project):**
    - **Project directory:** `/www/wwwroot/nurzeka/backend` (Backend klasörünü seçin!)
    - **Startup file:** `server.js`
    - **Run port:** `3001` (veya istediğiniz port)
    - **Node Version:** v18 veya v20 seçin.
4.  **Bağımlılıklar (Modules):**
    - Proje ayarlarından "Project modules" (veya "Package") kısmına gelip "Install" butonuna basın (`npm install` yapar).
    - Eğer panelden yapamazsanız terminalden proje klasörüne gidip `npm install` yazın.
5.  **Environment (.env):**
    - Dosya yöneticisinden `backend` içine `.env` dosyasını yükleyin veya oluşturun. İçine API anahtarınızı koyun.
6.  **Başlatma:** Projeyi "Start" veya "Restart" yapın. Artık `http://sunucu-ip-adresiniz:3001` adresinden çalışacaktır.
7.  **Domain Bağlama (İsteğe Bağlı):**
    - "Domain" kısmına alan adınızı yazın.
    - aaPanel otomatik olarak "Reverse Proxy" ayarlarını yapar, böylece port yazmadan (80/443) girebilirsiniz.

**CasaOS Kurulum Adımları:**
CasaOS daha çok Docker odaklıdır.
1.  **Files** uygulamasından dosyaları bir klasöre yükleyin (örn: `AppData/nurzeka`).
2.  Terminalden o klasöre gidip `npm install` ve `node server.js` çalıştırabilirsiniz.
3.  Veya basit bir `Dockerfile` oluşturup "Custom App" olarak ekleyebilirsiniz.
    - Ancak **aaPanel** Node.js projeleri için daha pratik araçlara sahiptir, onu kullanmanızı öneririm.

## 4. Önemli Notlar
- **Frontend (Önyüz):** `frontend` klasöründeki dosyalar statiktir. Ancak bu dosyalar `backend` üzerinden sunulduğu için ayrı bir işlem yapmanıza gerek yoktur. Tek bir port (örneğin 3000) üzerinden hem site hem API çalışır.
- **Maliyet:** AI işlemleri sunucuda değil, DeepSeek API üzerinden yapıldığı için sunucu maliyetiniz düşük olur. Sadece API kullanım ücreti (token başına) ödersiniz.

## Özet
"Dosyaları atsam çalışır mı?" sorusunun cevabı: **Eğer sunucunuzda Node.js kurulu ve aktifse EVET. Değilse (sadece PHP/HTML ise) HAYIR.**
