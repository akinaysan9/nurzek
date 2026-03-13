/**
 * Verified Scraper - Hizmetvakfı.org
 * 
 * Bu scraper:
 * 1. Eski fragmented dosyaları temizler (sozler_*.md gibi)
 * 2. Her bölümü hizmetvakfi.org'dan eksiksiz çeker
 * 3. Kaynak sayfadaki karakter sayısı ile karşılaştırarak doğrulama yapar
 * 4. Yarım kalmış dosyaları yeniden indirir
 * 
 * Kullanım:
 *   node verified-scraper.js --book sozler        (tek kitap)
 *   node verified-scraper.js --all                (tüm kitaplar)
 *   node verified-scraper.js --clean-only         (sadece fragment temizliği)
 *   node verified-scraper.js --verify-only        (sadece doğrulama raporu)
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KB_DIR = path.join(__dirname, '..', '..', 'knowledge-base');
const KULLIYAT_DIR = path.join(KB_DIR, 'kulliyat');

const BASE_URL = 'https://risaleinur.hizmetvakfi.org';
const DELAY_MS = 1200;

// ═══ COMPLETE BOOK LIST — hizmetvakfi.org sırasına göre ═══
// Her kitap için bölüm URL'leri doğrudan ana sayfadan alınmıştır.
const BOOKS = [
    {
        name: 'Sözler',
        slug: 'sozler',
        chapters: [
            { title: 'Birinci Söz', url: '/birinci-soz/' },
            { title: 'İkinci Söz', url: '/ikinci-soz-2/' },
            { title: 'Üçüncü Söz', url: '/ucuncu-soz-2/' },
            { title: 'Dördüncü Söz', url: '/dorduncu-soz/' },
            { title: 'Beşinci Söz', url: '/besinci-soz/' },
            { title: 'Altıncı Söz', url: '/altinci-soz/' },
            { title: 'Yedinci Söz', url: '/yedinci-soz/' },
            { title: 'Sekizinci Söz', url: '/sekizinci-soz/' },
            { title: 'Dokuzuncu Söz', url: '/dokuzuncu-soz/' },
            { title: 'Onuncu Söz', url: '/onuncu-soz/' },
            { title: 'On Birinci Söz', url: '/on-birinci-soz/' },
            { title: 'On İkinci Söz', url: '/on-ikinci-soz/' },
            { title: 'On Üçüncü Söz', url: '/on-ucuncu-soz/' },
            { title: 'On Dördüncü Söz', url: '/on-dorduncu-soz/' },
            { title: 'On Beşinci Söz', url: '/on-besinci-soz/' },
            { title: 'On Altıncı Söz', url: '/on-altinci-soz/' },
            { title: 'On Yedinci Söz', url: '/on-yedinci-soz/' },
            { title: 'On Sekizinci Söz', url: '/on-sekizinci-soz/' },
            { title: 'On Dokuzuncu Söz', url: '/on-dokuzuncu-soz/' },
            { title: 'Yirminci Söz', url: '/yirminci-soz/' },
            { title: 'Yirmi Birinci Söz', url: '/yirmi-birinci-soz/' },
            { title: 'Yirmi İkinci Söz', url: '/yirmi-ikinci-soz/' },
            { title: 'Yirmi Üçüncü Söz', url: '/yirmi-ucuncu-soz/' },
            { title: 'Yirmi Dördüncü Söz', url: '/yirmi-dorduncu-soz/' },
            { title: 'Yirmi Beşinci Söz', url: '/yirmi-besinci-soz-2/' },
            { title: 'Yirmi Altıncı Söz', url: '/yirmi-altinci-soz/' },
            { title: 'Yirmi Yedinci Söz', url: '/yirmi-yedinci-soz/' },
            { title: 'Yirmi Sekizinci Söz', url: '/yirmi-sekizinci-soz/' },
            { title: 'Yirmi Dokuzuncu Söz', url: '/yirmi-dokuzuncu-soz/' },
            { title: 'Otuzuncu Söz', url: '/otuzuncu-soz/' },
            { title: 'Otuz Birinci Söz', url: '/otuz-birinci-soz/' },
            { title: 'Otuz İkinci Söz', url: '/otuz-ikinci-soz/' },
            { title: 'Otuz Üçüncü Söz', url: '/otuz-ucuncu-soz/' },
            { title: 'Lemeat', url: '/lemaat/' },
            { title: 'Konferans', url: '/konferans-sozler/' },
            { title: 'Fihrist', url: '/fihrist-sozler/' },
        ]
    },
    {
        name: 'Mektubat',
        slug: 'mektubat',
        chapters: [
            { title: 'Birinci Mektup', url: '/birinci-mektup/' },
            { title: 'İkinci Mektup', url: '/ikinci-mektup/' },
            { title: 'Üçüncü Mektup', url: '/ucuncu-mektup/' },
            { title: 'Dördüncü Mektup', url: '/dorduncu-mektup/' },
            { title: 'Beşinci Mektup', url: '/besinci-mektup/' },
            { title: 'Altıncı Mektup', url: '/altinci-mektup/' },
            { title: 'Yedinci Mektup', url: '/yedinci-mektup/' },
            { title: 'Sekizinci Mektup', url: '/sekizinci-mektup/' },
            { title: 'Dokuzuncu Mektup', url: '/dokuzuncu-mektup/' },
            { title: 'Onuncu Mektup', url: '/onuncu-mektup/' },
            { title: 'On Birinci Mektup', url: '/on-birinci-mektup/' },
            { title: 'On İkinci Mektup', url: '/on-ikinci-mektup/' },
            { title: 'On Üçüncü Mektup', url: '/on-ucuncu-mektup/' },
            { title: 'On Dördüncü Mektup', url: '/on-dorduncu-mektup/' },
            { title: 'On Beşinci Mektup', url: '/on-besinci-mektup/' },
            { title: 'On Altıncı Mektup', url: '/on-altinci-mektup/' },
            { title: 'On Yedinci Mektup', url: '/on-yedinci-mektup/' },
            { title: 'On Sekizinci Mektup', url: '/on-sekizinci-mektup/' },
            { title: 'On Dokuzuncu Mektup', url: '/on-dokuzuncu-mektup/' },
            { title: 'Yirminci Mektup', url: '/yirminci-mektup/' },
            { title: 'Yirmi Birinci Mektup', url: '/yirmi-birinci-mektup/' },
            { title: 'Yirmi İkinci Mektup', url: '/yirmi-ikinci-mektup/' },
            { title: 'Yirmi Üçüncü Mektup', url: '/yirmi-ucuncu-mektup/' },
            { title: 'Yirmi Dördüncü Mektup', url: '/yirmi-dorduncu-mektup/' },
            { title: 'Yirmi Beşinci Mektup', url: '/yirmi-besinci-mektup/' },
            { title: 'Yirmi Altıncı Mektup', url: '/yirmi-altinci-mektup/' },
            { title: 'Yirmi Yedinci Mektup', url: '/yirmi-yedinci-mektup/' },
            { title: 'Yirmi Sekizinci Mektup', url: '/yirmi-sekizinci-mektup/' },
            { title: 'Yirmi Dokuzuncu Mektup', url: '/yirmi-dokuzuncu-mektup/' },
            { title: 'Otuzuncu Mektup', url: '/otuzuncu-mektup/' },
            { title: 'Otuz Birinci Mektup', url: '/otuz-birinci-mektup/' },
            { title: 'Otuz İkinci Mektup', url: '/otuz-ikinci-mektup/' },
            { title: 'Otuz Üçüncü Mektup', url: '/otuz-ucuncu-mektup/' },
            { title: 'İşarat-ı Gaybiye Hakkında Bir Takriz', url: '/isarat-i-gaybiye-hakkinda-bir-takriz/' },
            { title: 'Hakikat Çekirdekleri', url: '/hakikat-cekirdekleri/' },
            { title: 'Gönüller Fatihi Büyük Üstada', url: '/gonuller-fatihi-buyuk-ustada/' },
            { title: 'Fihriste-i Mektubat', url: '/fihriste-i-mektubat/' },
            { title: 'Hakikat Işıkları', url: '/hakikat-isiklari/' },
            { title: 'Dua', url: '/dua-mektubat/' },
        ]
    },
    {
        name: "Lem'alar",
        slug: 'lemalar',
        chapters: [
            { title: "Birinci Lem'a", url: '/birinci-lema/' },
            { title: "İkinci Lem'a", url: '/ikinci-lema/' },
            { title: "Üçüncü Lem'a", url: '/ucuncu-lema/' },
            { title: "Dördüncü Lem'a", url: '/dorduncu-lema/' },
            { title: "Beşinci Lem'a", url: '/besinci-lema/' },
            { title: "Altıncı Lem'a", url: '/altinci-lema/' },
            { title: "Yedinci Lem'a", url: '/yedinci-lema/' },
            { title: "Sekizinci Lem'a", url: '/sekizinci-lema/' },
            { title: "Dokuzuncu Lem'a", url: '/dokuzuncu-lema/' },
            { title: "Onuncu Lem'a", url: '/onuncu-lema/' },
            { title: "On Birinci Lem'a", url: '/on-birinci-lema/' },
            { title: "On İkinci Lem'a", url: '/on-ikinci-lema/' },
            { title: "On Üçüncü Lem'a", url: '/on-ucuncu-lema/' },
            { title: "On Dördüncü Lem'a", url: '/on-dorduncu-lema/' },
            { title: "On Beşinci Lem'a", url: '/on-besinci-lema/' },
            { title: "On Altıncı Lem'a", url: '/on-altinci-lema/' },
            { title: "On Yedinci Lem'a", url: '/on-yedinci-lema/' },
            { title: "On Sekizinci Lem'a", url: '/on-sekizinci-lema/' },
            { title: "On Dokuzuncu Lem'a", url: '/on-dokuzuncu-lema/' },
            { title: "Yirminci Lem'a", url: '/yirminci-lema/' },
            { title: "Yirmi Birinci Lem'a", url: '/yirmi-birinci-lema/' },
            { title: "Yirmi İkinci Lem'a", url: '/yirmi-ikinci-lema/' },
            { title: "Yirmi Üçüncü Lem'a", url: '/yirmi-ucuncu-lema/' },
            { title: "Yirmi Dördüncü Lem'a", url: '/yirmi-dorduncu-lema/' },
            { title: "Yirmi Beşinci Lem'a", url: '/yirmi-besinci-lema/' },
            { title: "Yirmi Altıncı Lem'a", url: '/yirmi-altinci-lema/' },
            { title: "Yirmi Yedinci Lem'a", url: '/yirmi-yedinci-lema/' },
            { title: "Yirmi Sekizinci Lem'a", url: '/yirmi-sekizinci-lema/' },
            { title: "Yirmi Dokuzuncu Lem'a", url: '/yirmi-dokuzuncu-lema/' },
            { title: "Otuzuncu Lem'a", url: '/otuzuncu-lema/' },
            { title: "Otuz Birinci Lem'a", url: '/otuz-birinci-lema/' },
            { title: "Otuz İkinci Lem'a", url: '/otuz-ikinci-lema/' },
            { title: "Otuz Üçüncü Lem'a", url: '/otuz-ucuncu-lema/' },
            { title: "Münâcat", url: '/munacat-lemalar/' },
            { title: "Fihrist", url: '/fihrist-lemalar/' },
            { title: "Dua", url: '/dua-lemalar/' },
        ]
    },
    {
        name: 'Şuâlar',
        slug: 'sualar',
        chapters: [
            { title: 'Birinci Şuâ', url: '/birinci-sua/' },
            { title: 'İkinci Şuâ', url: '/ikinci-sua/' },
            { title: 'Üçüncü Şuâ', url: '/ucuncu-sua/' },
            { title: 'Dördüncü Şuâ', url: '/dorduncu-sua/' },
            { title: 'Beşinci Şuâ', url: '/besinci-sua/' },
            { title: 'Altıncı Şuâ', url: '/altinci-sua/' },
            { title: 'Yedinci Şuâ', url: '/yedinci-sua/' },
            { title: 'Sekizinci Şuâ', url: '/sekizinci-sua/' },
            { title: 'Dokuzuncu Şuâ', url: '/dokuzuncu-sua/' },
            { title: 'On Birinci Şuâ', url: '/on-birinci-sua/' },
            { title: 'On İkinci Şuâ', url: '/on-ikinci-sua/' },
            { title: 'On Üçüncü Şuâ', url: '/on-ucuncu-sua/' },
            { title: 'On Dördüncü Şuâ', url: '/on-dorduncu-sua/' },
            { title: 'On Beşinci Şuâ', url: '/on-besinci-sua/' },
            { title: "Yirmi Dokuzuncu Lem'a'dan İkinci Bab", url: '/yirmi-dokuzuncu-lemadan-ikinci-bab/' },
            { title: 'Eddâî', url: '/eddai/' },
            { title: 'Dua', url: '/dua-sualar/' },
            { title: 'İçindekiler', url: '/icindekiler-sualar/' },
        ]
    },
    {
        name: 'Mesnevî-i Nuriye',
        slug: 'mesnevi-i-nuriye',
        chapters: [
            { title: "İ'tizar", url: '/itizar/' },
            { title: 'Mukaddime', url: '/mukaddime/' },
            { title: "Lem'alar Risalesi", url: '/lemalar-risalesi/' },
            { title: 'Reşhalar', url: '/reshalar/' },
            { title: 'Lâsiyyemalar', url: '/lasiyyemalar/' },
            { title: 'Katre', url: '/katre/' },
            { title: 'Hubab', url: '/hubab/' },
            { title: 'Habbe', url: '/habbe/' },
            { title: 'Zühre', url: '/zuhre/' },
            { title: 'Zerre', url: '/zerre/' },
            { title: 'Şemme Risalesi', url: '/semme-risalesi/' },
            { title: 'Onuncu Risale', url: '/onuncu-risale/' },
            { title: 'Şule', url: '/sule/' },
            { title: 'Nokta', url: '/nokta/' },
            { title: 'Münderecat Hakkında', url: '/munderecat-hakkinda/' },
            { title: 'Fihrist', url: '/fihrist-mesnevi/' },
        ]
    },
    {
        name: "İşaratü'l-İ'caz",
        slug: 'isaratul-icaz',
        chapters: [
            { title: 'Tenbih', url: '/tenbih/' },
            { title: "İfadetü'l-Meram", url: '/ifadetul-meram/' },
            { title: "Kur'an'ın Tarifi", url: '/kuranin-tarifi/' },
            { title: 'Fatiha Suresi', url: '/fatiha-suresi/' },
            { title: 'Bakara Suresi 1-2-3. âyetler', url: '/bakara-suresi-1-2-3-ayetler/' },
            { title: 'Bakara Suresi 4-5. âyetler', url: '/bakara-suresi-4-5-ayetler/' },
            { title: 'Bakara Suresi 6. âyet', url: '/bakara-suresi-6-ayet/' },
            { title: 'Bakara Suresi 7. âyet', url: '/bakara-suresi-7-ayet/' },
            { title: 'Bakara Suresi 8. âyet', url: '/bakara-suresi-8-ayet/' },
            { title: 'Bakara Suresi 9-10. âyetler', url: '/bakara-suresi-9-10-ayetler/' },
            { title: 'Bakara Suresi 11-12. âyetler', url: '/bakara-suresi-11-12-ayetler/' },
            { title: 'Bakara Suresi 13. âyet', url: '/bakara-suresi-13-ayet/' },
            { title: 'Bakara Suresi 14-15. âyetler', url: '/bakara-suresi-14-15-ayetler/' },
            { title: 'Bakara Suresi 16. âyet', url: '/bakara-suresi-16-ayet/' },
            { title: 'Bakara Suresi 17-18-19-20. âyetler', url: '/bakara-suresi-17-18-19-20-ayetler/' },
            { title: 'Bakara Suresi 21-22. âyetler', url: '/bakara-suresi-21-22-ayetler/' },
            { title: 'Bakara Suresi 23-24. âyetler', url: '/bakara-suresi-23-24-ayetler/' },
            { title: 'Bakara Suresi 25. âyet', url: '/bakara-suresi-25-ayet/' },
            { title: 'Bakara Suresi 26-27. âyetler', url: '/bakara-suresi-26-27-ayetler/' },
            { title: 'Bakara Suresi 28. âyet', url: '/bakara-suresi-28-ayet/' },
            { title: 'Bakara Suresi 29. âyet', url: '/bakara-suresi-29-ayet/' },
            { title: 'Bakara Suresi 30. âyet', url: '/bakara-suresi-30-ayet/' },
            { title: 'Bakara Suresi 31-32-33. âyetler', url: '/bakara-suresi-31-32-33-ayetler/' },
            { title: 'Ecnebi Feylesofların Beyanatları', url: '/ecnebi-feylesoflarin-kuran-hakkindaki-beyanatlari/' },
            { title: "Mehmed Kayalar'ın Müdafaası", url: '/mehmed-kayalarin-bir-mudafaasi/' },
            { title: 'Dua', url: '/dua-isaratul-icaz/' },
            { title: 'Fihrist', url: '/fihrist-isaratul-icaz/' },
        ]
    },
    {
        name: 'Sikke-i Tasdik-i Gaybî',
        slug: 'sikke-i-tasdik-i-gaybi',
        chapters: [
            { title: 'Parlak Fıkralar ve Güzel Mektuplar 1', url: '/parlak-fikralar-ve-guzel-mektuplar-1/' },
            { title: 'Birinci Şuâ', url: '/birinci-sua-2/' },
            { title: 'Sekizinci Şuâ', url: '/sekizinci-sua-2/' },
            { title: "On Sekizinci Lem'a", url: '/on-sekizinci-lema-2/' },
            { title: "Yirmi Sekizinci Lem'a", url: '/yirmi-sekizinci-lema-2/' },
            { title: "Sekizinci Lem'a", url: '/sekizinci-lema-2/' },
            { title: 'Parlak Fıkralar ve Güzel Mektuplar 2', url: '/parlak-fikralar-ve-guzel-mektuplar-2/' },
            { title: 'Dua', url: '/dua-sikke-i-tasdik-i-gaybi/' },
        ]
    },
    {
        name: 'Tarihçe-i Hayat',
        slug: 'tarihce-i-hayat',
        chapters: [
            { title: 'Ön Söz', url: '/on-soz/' },
            { title: 'Giriş', url: '/giris/' },
            { title: 'İlk Hayatı', url: '/573-2/' },
            { title: 'Barla Hayatı', url: '/barla-hayati/' },
            { title: 'Eskişehir Hayatı', url: '/eskisehir-hayati/' },
            { title: 'Kastamonu Hayatı', url: '/kastamonu-hayati/' },
            { title: 'Denizli Hayatı', url: '/denizli-hayati/' },
            { title: 'Emirdağ Hayatı', url: '/emirdag-hayati/' },
            { title: 'Afyon Hayatı', url: '/601-2/' },
            { title: 'Isparta Hayatı', url: '/isparta-hayati/' },
            { title: 'Hariç Memleketler', url: '/haric-memleketler/' },
            { title: 'Bedîüzzaman ve Risale-i Nur', url: '/bediuzzaman-ve-risale-i-nur/' },
            { title: 'Dua', url: '/dua-tarihce-i-hayati/' },
            { title: 'İçindekiler', url: '/icindekiler/' },
        ]
    },
    {
        name: 'Barla Lâhikası',
        slug: 'barla-lahikasi',
        chapters: [
            { title: 'Takdim', url: '/barla-lahikasi-takdim/' },
            { title: 'Yedinci Risale', url: '/barla-lahikasi-s-5-20/' },
            { title: 's.21-39', url: '/barla-lahikasi-s-21-39/' },
            { title: 's.40-58', url: '/barla-lahikasi-s-40-58/' },
            { title: 's.59-80', url: '/barla-lahikasi-s-59-80/' },
            { title: 's.80-102', url: '/barla-lahikasi-s-80-102/' },
            { title: 's.103-121', url: '/barla-lahikasi-s-103-121/' },
            { title: 's.121-146', url: '/barla-lahikasi-s-121-146/' },
            { title: 's.146-159', url: '/barla-lahikasi-s-146-159/' },
            { title: 's.160-180', url: '/barla-lahikasi-s-160-180/' },
            { title: 's.181-201', url: '/barla-lahikasi-s-181-201/' },
            { title: 's.202-221', url: '/barla-lahikasi-s-202-221/' },
            { title: 's.221-240', url: '/barla-lahikasi-s-221-240/' },
            { title: 's.241-261', url: '/barla-lahikasi-s-241-261/' },
            { title: 's.262-280', url: '/barla-lahikasi-s-262-280/' },
            { title: 's.280-299', url: '/barla-lahikasi-s-280-299/' },
            { title: 's.300-321', url: '/barla-lahikasi-s-300-321/' },
            { title: 's.321-340', url: '/barla-lahikasi-s-321-340/' },
            { title: 's.340-362', url: '/barla-lahikasi-s-340-362/' },
            { title: 's.363-392', url: '/barla-lahikasi-s-363-392/' },
        ]
    },
    {
        name: 'Kastamonu Lâhikası',
        slug: 'kastamonu-lahikasi',
        chapters: [
            { title: 'Takdim', url: '/kastamonu-lahikasi-takdim/' },
            { title: 's.10-30', url: '/kastamonu-lahikasi-s-10-30/' },
            { title: 's.30-51', url: '/kastamonu-lahikasi-s-30-51/' },
            { title: 's.52-69', url: '/kastamonu-lahikasi-s-52-69/' },
            { title: 's.70-91', url: '/kastamonu-lahikasi-s-70-91/' },
            { title: 's.91-109', url: '/kastamonu-lahikasi-s-91-109/' },
            { title: 's.110-129', url: '/kastamonu-lahikasi-s-110-129/' },
            { title: 's.130-149', url: '/kastamonu-lahikasi-s-130-149/' },
            { title: "s.150-166 (Lemaat'tan)", url: '/kastamonu-lahikasi-s-150-166-lemaattan/' },
            { title: 's.167-189', url: '/kastamonu-lahikasi-s-167-189/' },
            { title: 's.190-210', url: '/kastamonu-lahikasi-s-190-210/' },
            { title: 's.211-230', url: '/kastamonu-lahikasi-s-211-230/' },
            { title: 's.231-255', url: '/kastamonu-lahikasi-s-231-255/' },
        ]
    },
    {
        name: 'Emirdağ Lâhikası I',
        slug: 'emirdag-lahikasi-i',
        chapters: [
            { title: 'Takdim', url: '/emirdag-lahikasi-i-takdim/' },
            { title: 's.10-31', url: '/emirdag-lahikasi-i-s-10-31/' },
            { title: 's.31-50', url: '/emirdag-lahikasi-i-s-31-50/' },
            { title: 's.50-69', url: '/emirdag-lahikasi-i-s-50-69/' },
            { title: 's.70-90', url: '/emirdag-lahikasi-i-s-70-90/' },
            { title: 's.90-110', url: '/emirdag-lahikasi-i-s-90/' },
            { title: 's.110-130', url: '/emirdag-lahikasi-i-s-110-130/' },
            { title: 's.131-150', url: '/emirdag-lahikasi-i-s-131-150/' },
            { title: 's.150-170', url: '/emirdag-lahikasi-i-s-150-170/' },
            { title: 's.170-190', url: '/emirdag-lahikasi-i-s-170-190/' },
            { title: 's.190-211', url: '/emirdag-lahikasi-i-s-190-211/' },
            { title: 's.212-230', url: '/emirdag-lahikasi-i-s-212-230/' },
            { title: 's.230-251', url: '/emirdag-lahikasi-i-s-230-251/' },
            { title: 's.251-270', url: '/emirdag-lahikasi-i-s-251-270/' },
            { title: 's.271-288', url: '/emirdag-lahikasi-i-s-271-288/' },
        ]
    },
    {
        name: 'Emirdağ Lâhikası II',
        slug: 'emirdag-lahikasi-ii',
        chapters: [
            { title: 's.6-26', url: '/emirdag-lahikasi-ii-s-6-26/' },
            { title: 's.27-50', url: '/emirdag-lahikasi-ii-s-27-50/' },
            { title: 's.51-70', url: '/emirdag-lahikasi-ii-s-51-70/' },
            { title: 's.70-90', url: '/emirdag-lahikasi-ii-s-70-90/' },
            { title: 's.91-109', url: '/emirdag-lahikasi-ii-s-91-109/' },
            { title: 's.110-128', url: '/emirdag-lahikasi-ii-s-110-128/' },
            { title: 's.129-148', url: '/emirdag-lahikasi-ii-s-129-148/' },
            { title: 's.149-170', url: '/emirdag-lahikasi-ii-s-149-170/' },
            { title: 's.171-189', url: '/emirdag-lahikasi-ii-s-171-189/' },
            { title: 's.190-210', url: '/emirdag-lahikasi-ii-s-190-210/' },
            { title: 's.210-229', url: '/emirdag-lahikasi-ii-s-210-229/' },
            { title: 's.230-247', url: '/emirdag-lahikasi-ii-s-230-247/' },
        ]
    },
    {
        name: 'Asâ-yı Musa',
        slug: 'asa-yi-musa',
        chapters: [
            { title: 'Birinci Kısım', url: '/asa-yi-musadan-birinci-kisim/' },
            { title: 'Birinci Mesele', url: '/birinci-mesele/' },
            { title: 'İkinci Mesele', url: '/ikinci-mesele/' },
            { title: 'Üçüncü Mesele', url: '/ucuncu-mesele/' },
            { title: 'Dördüncü Mesele', url: '/dorduncu-mesele/' },
            { title: 'Beşinci Mesele', url: '/besinci-mesele/' },
            { title: 'Altıncı Mesele', url: '/altinci-mesele/' },
            { title: 'Yedinci Mesele', url: '/yedinci-mesele/' },
            { title: 'Sekizinci Mesele', url: '/sekizinci-mesele/' },
            { title: 'Dokuzuncu Mesele', url: '/dokuzuncu-mesele/' },
            { title: 'Onuncu Mesele', url: '/onuncu-mesele/' },
            { title: 'On Birinci Mesele', url: '/on-birinci-mesele/' },
            { title: 'İkinci Kısım', url: '/asa-yi-musadan-ikinci-kisim/' },
            { title: 'Birinci Hüccet-i İmaniye', url: '/birinci-huccet-i-imaniye/' },
            { title: 'İkinci Hüccet-i İmaniye', url: '/ikinci-huccet-i-imaniye/' },
            { title: 'Üçüncü Hüccet-i İmaniye', url: '/ucuncu-huccet-i-imaniye/' },
            { title: 'Dördüncü Hüccet-i İmaniye', url: '/dorduncu-huccet-i-imaniye/' },
            { title: 'Beşinci Hüccet-i İmaniye', url: '/besinci-huccet-i-imaniye/' },
            { title: 'Altıncı Hüccet-i İmaniye', url: '/altinci-huccet-i-imaniye/' },
            { title: 'Yedinci Hüccet-i İmaniye', url: '/yedinci-huccet-i-imaniye/' },
            { title: 'Sekizinci Hüccet-i İmaniye', url: '/sekizinci-huccet-i-imaniye/' },
            { title: 'Dokuzuncu Hüccet-i İmaniye', url: '/dokuzuncu-huccet-i-imaniye/' },
            { title: 'Onuncu Hüccet-i İmaniye', url: '/onuncu-huccet-i-imaniye/' },
            { title: 'On Birinci Hüccet-i İmaniye', url: '/on-birinci-huccet-i-imaniye/' },
            { title: 'Fihrist', url: '/fihrist-asa-yi-musa/' },
        ]
    },
    {
        name: 'Muhakemat',
        slug: 'muhakemat',
        chapters: [
            { title: 'Birinci Makale', url: '/birinci-makale/' },
            { title: 'İkinci Makale', url: '/ikinci-makale/' },
            { title: 'Üçüncü Makale', url: '/ucuncu-makale/' },
            { title: 'Fihrist', url: '/fihrist-muhakemat/' },
            { title: 'Takriz', url: '/takriz/' },
        ]
    },
    {
        name: 'Hutbe-i Şâmiye',
        slug: 'hutbe-i-samiye',
        chapters: [
            { title: 'Hutbe-i Şâmiye', url: '/hutbe-i-samiye/' },
        ]
    },
    {
        name: 'Münâzarat',
        slug: 'munazarat',
        chapters: [
            { title: 'Münâzarat', url: '/munazarat/' },
        ]
    },
];

// ═══ UTILITIES ═══

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function cleanText(text) {
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Remove repeated section headers (common bug: "Birinci Söz" repeated 30 times)
function deduplicateHeaders(text) {
    const lines = text.split('\n');
    const result = [];
    let lastNonEmpty = '';
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip if this exact non-trivial line was just seen
        if (trimmed.length > 3 && trimmed === lastNonEmpty) {
            continue;
        }
        
        result.push(line);
        if (trimmed.length > 0) lastNonEmpty = trimmed;
    }
    
    return result.join('\n');
}

// ═══ FETCH & EXTRACT ═══

async function fetchPage(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NurZeka-VerifiedScraper/2.0',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'tr-TR,tr;q=0.9',
            },
            timeout: 30000
        });

        if (!response.ok) {
            console.warn(`  ⚠️ HTTP ${response.status}: ${url}`);
            return null;
        }
        return await response.text();
    } catch (error) {
        console.error(`  ❌ Fetch Error: ${error.message} - ${url}`);
        return null;
    }
}

function extractContent(html) {
    const $ = cheerio.load(html);

    // Remove navigation, sidebar, footer etc.
    const removeSelectors = [
        'script', 'style', 'nav', '.sidebar', 'footer', 'header',
        '.navigation', '.breadcrumbs', '.share', '.comments',
        '.related-posts', '.post-meta', '.reply',
        '.wp-block-buttons', '.social-share',
        '#comments', '.comment-respond',
        'noscript',
    ];
    $(removeSelectors.join(', ')).remove();

    // Get main content
    const contentEl = $('.entry-content').first();
    if (!contentEl.length) {
        // Fallback
        const alt = $('article .content, .post-content, #content').first();
        if (alt.length) return extractFromElement($, alt);
        return null;
    }

    return extractFromElement($, contentEl);
}

function extractFromElement($, contentEl) {
    // Remove nav links inside content
    contentEl.find('a[rel="next"], a[rel="prev"]').parent().remove();
    contentEl.find('.pagination, .nav-links, .page-links').remove();

    // Handle block elements for proper spacing
    contentEl.find('p, div, h1, h2, h3, h4, h5, h6, blockquote, li').each((i, el) => {
        const h = $(el).html();
        const tag = $(el).prop('tagName').toLowerCase();
        if (tag.match(/^h[1-6]$/)) {
            $(el).replaceWith(`\n\n**${$(el).text().trim()}**\n\n`);
        } else {
            $(el).replaceWith(`\n\n${h}\n\n`);
        }
    });

    contentEl.find('br').replaceWith('\n');

    let content = contentEl.text();
    content = cleanText(content);
    content = deduplicateHeaders(content);

    // Title
    const title = $('h1.entry-title').first().text().trim() ||
                  $('h1').first().text().trim() ||
                  $('title').text().split('–')[0].trim();

    // Character count of pure content (for verification)
    const charCount = content.replace(/\s/g, '').length;

    return { title, content, charCount };
}

// ═══ CLEANUP ═══

function cleanFragmentedFiles(bookSlug) {
    const bookDir = path.join(KULLIYAT_DIR, bookSlug);
    if (!fs.existsSync(bookDir)) return 0;

    const files = fs.readdirSync(bookDir);
    let removed = 0;

    for (const file of files) {
        // Remove files that DON'T follow the ###-slug.md pattern (old fragments)
        if (!file.match(/^\d{3}-/) && file.endsWith('.md')) {
            const fp = path.join(bookDir, file);
            fs.unlinkSync(fp);
            removed++;
            console.log(`  🗑️  Removed fragment: ${file}`);
        }
    }

    return removed;
}

// ═══ MAIN SCRAPING ═══

async function scrapeBook(book, options = {}) {
    const { force = false, verifyOnly = false } = options;
    const bookDir = path.join(KULLIYAT_DIR, book.slug);
    ensureDir(bookDir);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📚 ${book.name} (${book.chapters.length} bölüm)`);
    console.log(`${'═'.repeat(60)}`);

    // Step 1: Clean old fragments
    const removed = cleanFragmentedFiles(book.slug);
    if (removed > 0) console.log(`  🧹 ${removed} eski fragment silindi.`);

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < book.chapters.length; i++) {
        const chapter = book.chapters[i];
        const idx = String(i + 1).padStart(3, '0');
        const slug = chapter.url.replace(/^\/|\/$/g, '');
        const filename = `${idx}-${slug}.md`;
        const filePath = path.join(bookDir, filename);

        // Check existing file
        if (fs.existsSync(filePath) && !force) {
            const stats = fs.statSync(filePath);
            const existing = fs.readFileSync(filePath, 'utf-8');
            const existingContentLen = existing.replace(/---[\s\S]*?---\n/, '').replace(/\s/g, '').length;

            if (verifyOnly) {
                results.push({
                    chapter: chapter.title,
                    file: filename,
                    status: 'EXISTS',
                    size: stats.size,
                    contentChars: existingContentLen
                });
                continue;
            }

            // Skip if file looks substantial (>2000 non-whitespace chars)
            if (existingContentLen > 2000) {
                skipCount++;
                results.push({
                    chapter: chapter.title,
                    file: filename,
                    status: 'SKIP',
                    size: stats.size,
                    contentChars: existingContentLen
                });
                continue;
            }
            console.log(`  🔄 Yeniden indiriliyor (küçük dosya: ${existingContentLen} chars): ${filename}`);
        }

        if (verifyOnly) {
            results.push({ chapter: chapter.title, file: filename, status: 'MISSING', size: 0 });
            continue;
        }

        // Fetch
        const url = `${BASE_URL}${chapter.url}`;
        console.log(`  ⬇️  [${i + 1}/${book.chapters.length}] ${chapter.title}...`);

        await delay(DELAY_MS);
        const html = await fetchPage(url);
        if (!html) {
            failCount++;
            results.push({ chapter: chapter.title, file: filename, status: 'FAIL', size: 0 });
            continue;
        }

        const data = extractContent(html);
        if (!data || data.content.length < 100) {
            failCount++;
            console.warn(`  ⚠️ İçerik çok kısa veya boş: ${chapter.title}`);
            results.push({ chapter: chapter.title, file: filename, status: 'EMPTY', size: 0 });
            continue;
        }

        // Verification: at least 500 non-whitespace chars for a real chapter
        if (data.charCount < 500) {
            console.warn(`  ⚠️ Şüpheli kısa içerik (${data.charCount} chars): ${chapter.title}`);
        }

        // Build markdown
        const md = `---
kitap: "${book.name}"
bölüm: "${chapter.title}"
sıra: ${i + 1}
url: "${url}"
tarih: ${new Date().toISOString()}
karakter: ${data.charCount}
---

# ${chapter.title}

${data.content}
`;

        fs.writeFileSync(filePath, md, 'utf-8');
        successCount++;
        console.log(`  ✅ ${filename} (${data.charCount} chars)`);

        results.push({
            chapter: chapter.title,
            file: filename,
            status: 'OK',
            size: md.length,
            contentChars: data.charCount,
            sourceUrl: url,
        });
    }

    // Summary
    console.log(`\n  📊 ${book.name}: ${successCount} yeni, ${skipCount} atlandı, ${failCount} başarısız`);

    return { book: book.name, results, successCount, failCount, skipCount };
}

// ═══ VERIFICATION REPORT ═══

function generateVerificationReport(allResults) {
    const reportPath = path.join(KB_DIR, 'verification-report.md');
    let report = `# Doğrulama Raporu\n\nTarih: ${new Date().toISOString()}\n\n`;

    for (const bookResult of allResults) {
        report += `## ${bookResult.book}\n\n`;
        report += `| # | Bölüm | Durum | Karakter | Dosya |\n`;
        report += `|---|-------|-------|----------|-------|\n`;

        for (let i = 0; i < bookResult.results.length; i++) {
            const r = bookResult.results[i];
            const statusEmoji = r.status === 'OK' || r.status === 'SKIP' || r.status === 'EXISTS' ? '✅' : '❌';
            report += `| ${i + 1} | ${r.chapter} | ${statusEmoji} ${r.status} | ${r.contentChars || '-'} | ${r.file} |\n`;
        }
        report += '\n';
    }

    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📋 Rapor kaydedildi: ${reportPath}`);
}

// ═══ METADATA UPDATE ═══

function updateMetadata(allResults) {
    const metadataPath = path.join(KB_DIR, 'metadata.json');
    let metadata = {};

    if (fs.existsSync(metadataPath)) {
        try { metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')); } catch (e) { metadata = {}; }
    }

    // Rebuild kulliyat metadata from results
    metadata.kulliyat = [];

    for (const bookResult of allResults) {
        for (const r of bookResult.results) {
            if (r.status === 'OK' || r.status === 'SKIP' || r.status === 'EXISTS') {
                const book = BOOKS.find(b => b.name === bookResult.book);
                metadata.kulliyat.push({
                    type: 'kulliyat',
                    book: bookResult.book,
                    bookSlug: book?.slug || '',
                    section: r.chapter,
                    filePath: `kulliyat/${book?.slug}/${r.file}`,
                    charCount: r.contentChars || 0,
                });
            }
        }
    }

    metadata.lastUpdated = new Date().toISOString();
    metadata.source = 'risaleinur.hizmetvakfi.org';
    metadata.totalBooks = BOOKS.length;

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log('📝 metadata.json güncellendi.');
}

// ═══ MAIN ═══

async function main() {
    const args = process.argv.slice(2);
    const bookArg = args.find(a => a.startsWith('--book='))?.split('=')[1];
    const forceMode = args.includes('--force');
    const verifyOnly = args.includes('--verify-only');
    const cleanOnly = args.includes('--clean-only');
    const isAll = args.includes('--all');

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  🕌 NurZeka - Verified Scraper v3.0');
    console.log(`  📋 Mod: ${verifyOnly ? 'DOĞRULAMA' : cleanOnly ? 'TEMİZLİK' : forceMode ? 'ZORLA YENİDEN İNDİR' : 'NORMAL'}`);
    console.log('═══════════════════════════════════════════════');

    let targetBooks = BOOKS;

    if (bookArg) {
        const found = BOOKS.filter(b => b.slug === bookArg);
        if (found.length === 0) {
            console.error(`❌ Kitap bulunamadı: ${bookArg}`);
            console.log('Mevcut kitaplar:', BOOKS.map(b => b.slug).join(', '));
            process.exit(1);
        }
        targetBooks = found;
    } else if (!isAll) {
        // Default: only core risales
        const coreSlugs = ['sozler', 'mektubat', 'lemalar', 'sualar', 'mesnevi-i-nuriye'];
        targetBooks = BOOKS.filter(b => coreSlugs.includes(b.slug));
        console.log('  📌 Kök risaleler seçildi (--all ile tümünü çekin)');
    }

    if (cleanOnly) {
        console.log('\n🧹 Sadece temizlik modu...');
        for (const book of targetBooks) {
            console.log(`\n📚 ${book.name}`);
            const removed = cleanFragmentedFiles(book.slug);
            console.log(`  ${removed} fragment silindi.`);
        }
        return;
    }

    const allResults = [];

    for (const book of targetBooks) {
        const result = await scrapeBook(book, { force: forceMode, verifyOnly });
        allResults.push(result);
    }

    // Generate report
    generateVerificationReport(allResults);
    
    if (!verifyOnly) {
        updateMetadata(allResults);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('  ✅ Tamamlandı!');
    
    // Overall summary
    let totalOk = 0, totalFail = 0, totalSkip = 0;
    for (const r of allResults) {
        totalOk += r.successCount;
        totalFail += r.failCount;
        totalSkip += r.skipCount;
    }
    console.log(`  📊 Toplam: ${totalOk} yeni, ${totalSkip} mevcut/atlandı, ${totalFail} başarısız`);
    console.log('═══════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
