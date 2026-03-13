// ═══ Osmanlıca / Arapça Kelime Sözlüğü ═══
// Okuma panelinde hover ile anlam gösteren tooltip sistemi.
//
// Üç katmanlı:
//   1. RISALE_KAVRAMLAR — Risale'ye özel kavramlar (en yüksek öncelik, elle yazıldı)
//   2. OTTOMAN_DICT_BASE — hardcoded 20 kelime, hep hazır
//   3. ottoman_dict.json — build_ottoman_dict.py çıktısı (varsa yüklenir)

// ── Katman 1: Risale'ye özgü kavramlar ────────────────────────────────────────
// Bunlar genel sözlük tanımı değil, Said Nursi'nin metinlerindeki ÖZEL anlam.
// Tooltip'te farklı stil alır (.ottoman-kavram).
const RISALE_KAVRAMLAR = {
    // ─── İman ve Akaid ─────────────────────────────────────────────────────
    "iman": "İnanmak, kalp ile tasdik etmek",
    "tevhid": "Allah'ın birliği, birlemek",
    "marifet": "Allah'ı tanıma, bilme",
    "marifetullah": "Allah'ı tanıma ilmi",
    "haşir": "Öldükten sonra tekrar dirilme",
    "ahiret": "Öte dünya, ölümden sonraki hayat",
    "kader": "Allah'ın ezeli ilmiyle her şeyi takdir etmesi",
    "nübüvvet": "Peygamberlik",
    "risalet": "Peygamberlik, elçilik",
    "melaiket": "Melekler",
    "mukadderat": "Kader ile belirlenen şeyler",
    "iman-ı tahkikî": "Taklit değil, delil ve müşahedeye dayanan sağlam iman",

    // ─── Allah'ın İsimleri ve Sıfatları ────────────────────────────────────
    "esma-i hüsna": "Allah'ın güzel isimlerinin kâinattaki tezahürleri",
    "esma": "İsimler",
    "sıfat-ı ilahiye": "Allah'ın sıfatları",
    "tecelli": "Yansıma, görünme, Allah'ın isimlerinin yansıması",
    "kudret": "Güç, kuvvet (Allah'ın kudreti)",
    "hikmet": "Gaye, maksat, Allah'ın eşyayı bir gayeye uygun yaratması",
    "irade": "Dileme, isteme (Allah'ın iradesi)",
    "ilm-i ilahi": "Allah'ın ilmi, bilgisi",
    "rahmet": "Merhamet, şefkat",
    "rububiyet": "Rablık, terbiye edicilik",
    "uluhiyet": "İlahlık, mabud olma",
    "vahidiyet": "Allah'ın birliğinin her şeyde görünmesi",
    "ehadiyet": "Allah'ın birliğinin her bir şeyde ayrı ayrı görünmesi",
    "cemal": "Güzellik (Allah'ın güzellik sıfatı)",
    "celal": "Büyüklük, haşmet (Allah'ın büyüklük sıfatı)",
    "kemal": "Mükemmellik, olgunluk",
    "sırr-ı ehadiyet": "Allah'ın ehadiyetinin her bir varlıkta ayrı ayrı tecelli etmesinin sırrı",
    "tecelli-i ehadiyet": "İlahi birliğin her bir varlıkta hususi olarak görünmesi",
    "ehadiyet mührü": "Her varlıktaki Allah'ın birliğine dair özel damga ve işaret",
    "rububiyet-i mutlaka": "Allah'ın her şeyi mutlak olarak terbiye etmesi ve idare etmesi",
    "hikmet-i ilahiye": "Allah'ın hikmeti, yaratılıştaki gaye",
    "ismi azam": "Allah'ın en büyük ismi; tüm isimlerini kuşatan ilahi unvan",
    "nur-u tevhid": "Allah'ın birliğinden doğan ve kâinatı aydınlatan manevi ışık",
    "envar-ı tevhid": "Tevhid nurlarının kâinata yayılmış tecellileri",
    "kemâl-i merhamet": "İlahi rahmetin en yüce ve eksiksiz tecellisi",
    "cilve-i rahmet": "Allah'ın rahmetinin varlıklarda görünen güzel yansıması",
    "bahr-i tevhid": "Tevhid hakikatinin sonsuz bir deniz gibi engin olması",

    // ─── Kur'an ve Vahiy ───────────────────────────────────────────────────
    "kur'an-ı kerim": "Allah'ın son ilahi kitabı",
    "kur'an-ı hakim": "Hikmetli Kur'an",
    "ayet": "Kur'an'ın en küçük birimi, delil, işaret",
    "sure": "Kur'an'ın bölümleri",
    "vahiy": "Allah'ın peygamberine bildirdiği ilahi mesaj",
    "tefsir": "Kur'an'ın açıklaması, yorumu",
    "i'caz": "Mucizelik, aciz bırakma (Kur'an'ın mucize oluşu)",
    "belagat": "Güzel ve etkili söz söyleme sanatı",
    "fesahat": "Sözün akıcı ve düzgün olması",
    "nazm": "Diziliş, düzen (Kur'an'ın kelime dizilişi)",

    // ─── İnsan ve Nefis ───────────────────────────────────────────────────
    "nefis": "İnsanın kendi benliği, ego",
    "nefs-i emmare": "Kötülüğü emreden nefis",
    "nefs-i levvame": "Kendini kınayan nefis",
    "nefs-i mutmainne": "Tatmin olmuş, huzurlu nefis",
    "akıl": "Düşünme, anlama yetisi",
    "kalb": "Gönül, manevi merkez",
    "ruh": "Can, hayat prensibi",
    "vicdan": "İç ses, doğruyu yanlıştan ayırt etme",
    "fıtrat": "Yaratılış, doğal yapı",
    "istidat": "Kabiliyet, yetenek",
    "latife": "İnce duygu, zarif söz",
    "insan-ı kamil": "Olgun insan, ideal insan",
    "a'lâ-yı illiyyîn": "Manevi mertebelerin en yücesi; cennetin en üst derecesi",
    "esfel-i safilîn": "Manevi düşüşün en alt noktası; nefsin en aşağı hali",

    // ─── İbadet ve Amel ───────────────────────────────────────────────────
    "ibadet": "Kulluk, Allah'a hizmet",
    "ubudiyet": "Kulluk, kölelik (Allah'a)",
    "taat": "İtaat, söz dinleme",
    "tesbih": "Allah'ı noksan sıfatlardan tenzih etme",
    "hamd": "Övmek, şükretmek",
    "şükür": "Nimetlere karşı minnettarlık",
    "dua": "Allah'a yalvarma, isteme",
    "tefekkür": "Derin düşünme, Allah'ın san'atını düşünme",
    "tevekkül": "Allah'a güvenme, dayanma",
    "zikir": "Allah'ı anma",
    "tövbe": "Günahlardan dönme, pişmanlık",
    "takva": "Allah'tan korkma, günahlardan sakınma",
    "ihlas": "Samimiyet, Allah rızasını gözetme",
    "ihsan": "İyilik yapma, güzel davranma",
    "küllî ubudiyet": "Tüm kâinatın Allah'a secde etmesi; yaratılışın topyekün kulluğu",

    // ─── Risale-i Nur Terimleri ────────────────────────────────────────────
    "risale": "Küçük kitap, mektup",
    "külliyat": "Tüm eserler",
    "lem'a": "Parıltı (Lem'alar kitabı)",
    "şua": "Işın, ışık hüzmesi (Şualar kitabı)",
    "mektub": "Mektup (Mektubat kitabı)",
    "lahika": "Ek, ilave (Lahika mektupları)",
    "nur": "Işık, aydınlık",
    "hizmet-i imaniye": "İnsanlara iman hakikatlerini ulaştırmak için yapılan manevi hizmet",
    "hizmet-i kur'aniye": "Kur'an hakikatlerini asra bildirme ve yaşatma çabası",
    "müdavele-i efkar": "Fikir alışverişi, müzakere",
    "meşveret": "İstişare, danışma",
    "uhuvvet": "Kardeşlik",
    "tesanüd": "Dayanışma",
    "bediüzzaman": "Zamanın harikası (Said Nursi'nin lakabı)",
    "üstad": "Hoca, öğretici (Said Nursi için kullanılır)",
    "müceddid": "Yenileyici, dini yenileyen alim",

    // ─── Felsefe ve Kavramlar ──────────────────────────────────────────────
    "kainat": "Evren, tüm yaratılmış âlem",
    "alem": "Dünya, evren, boyut",
    "mevcudat": "Var olan her şey, varlıklar",
    "mahlukat": "Yaratılmışlar",
    "tabiat": "Doğa",
    "hilkat": "Yaratılış",
    "hakikat": "Gerçek, gerçeklik",
    "ilim": "Bilim, bilgi",
    "irfan": "Derin bilgi, sezgisel anlayış",
    "burhan": "Kesin delil, kanıt",
    "hüccet": "Delil, kanıt",
    "misal": "Örnek, benzetme",
    "temsil": "Benzetme, sembol, alegori",
    "mecaz": "Gerçek anlamı dışında kullanılan söz",
    "mana": "Anlam, iç yüz",
    "sırr": "Gizli hakikat, derin mana",
    "fani": "Geçici, yok olacak",
    "baki": "Kalıcı, ebedi",
    "zeval": "Yok olma, son bulma",
    "fenâ": "Geçicilik, yok oluş",
    "beka": "Kalıcılık, sonsuzluk",
    "saadet": "Mutluluk",
    "şekavet": "Bedbahtlık, mutsuzluk",
    "hakikat-i uzmâ": "En büyük ve kapsamlı hakikat; tevhid hakikati",
    "mektup-u samed": "Kâinatın her varlığının Allah'ın Samediyetini gösteren manevi mektup olması",
    "kâinat kitabı": "Kâinatın, Allah'ın isimlerini okutan büyük bir kitap olarak görülmesi",
    "temsil-i hakikat": "Hakikatlerin akla yaklaştırılması için kullanılan benzetme ve örnek",
    "âb-ı hayat": "Hayat veren su; mecazen iman ve Kur'an'ın manevi kuvveti",
    "şehadet âlemi": "Gözle görülen, hissedilen maddi âlem",
    "gayb âlemi": "Duyularla idrak edilemeyen, iman ile kabul edilen görünmez âlem",

    // ─── Manevi yolculuk ───────────────────────────────────────────────────
    "fenâ fillah": "Benliğini Allah'ta eritme; tasavvufta en yüce makam",
    "bekâ billah": "Fenadan sonra Allah ile var olmaya devam etme hali",
    "sidretü'l-münteha": "Hz. Peygamber'in miracında ulaştığı son sınır; gayb ile şehadet âleminin kesişme noktası",
    "mirac-ı muhammedî": "Hz. Peygamber'in Allah'ın huzuruna yükseldiği ruhani ve cismanî yolculuk",

    // ─── Bağlaçlar ve ifadeler ─────────────────────────────────────────────
    "elhasıl": "Sonuç olarak, kısacası",
    "binaenaleyh": "Bundan dolayı, bu sebeple",
    "halbuki": "Oysa, ama",
    "zira": "Çünkü, zira",
    "muhakkak": "Kesinlikle, şüphesiz",
    "katiyen": "Kesinlikle, asla",

    // ─── Kişiler ───────────────────────────────────────────────────────────
    "müellif": "Yazar, eser sahibi",
    "müfessir": "Tefsir eden, Kur'an yorumcusu",
    "muhaddis": "Hadis alimi",
    "mutasavvıf": "Tasavvuf ehli, sufi",
    "alim": "Bilgin, ilim sahibi",
    "arif": "İrfan sahibi, bilen",
    "abid": "Çok ibadet eden",
    "zahid": "Dünyadan el çeken, züht ehli",
};


// ── Katman 2: Sabit hardcoded kelimeler ──────────────────────────────────────
const OTTOMAN_DICT_BASE = {
    'hodbin': 'Kendini beğenmiş, bencil, kibirli',
    'hüdabin': "Allah'ı gören, hakikati bulan",
    'süluk': 'Manevi yolculuk, seyr ü sefer',
    'müteessir': 'Etkilenen, üzülen, acı duyan',
    'hazin': 'Hüzünlü, kederli, acıklı',
    'meyusane': "Ümitsizce, çaresizce, ye'se düşmüş halde",
    'ecnebi': 'Yabancı, el, başka milletten olan',
    'tahribat': 'Tahribatlar, yıkımlar, hasar',
    'vaveyla': 'Feryat, bağırış, âh u figan',
    'matemhane': 'Yas evi, matem yeri, hüzün mekânı',
    'tevekkül': "Allah'a dayanıp güvenme, işi O'na bırakma",
    'istikamet': 'Doğruluk, dürüstlük, doğru yolda olma',
    'inayet': 'İlahi yardım, lütuf, ihsan',
    'münasebet': 'İlgi, alaka, bağlantı, ilişki',
    'hakikat': 'Gerçek, asıl, özün özü',
    'tefekkür': 'Derin düşünme, ibret alarak düşünme',
    'enaniyet': "Benlik duygusu, egoizm, ben'lik",
    'taziye': 'Baş sağlığı dileme, acıyı paylaşma',
    'istikbal': 'Gelecek, ilerde gelen zaman',
    'kader': "Allah'ın ezeli takdiri, ilahi plân",
};

// ── Aktif Map'ler (O(1) lookup) ────────────────────────────────────────────────
// INLINE = sadece hardcoded 160 kavram (metin içi span için, hızlı)
let KAVRAM_INLINE_MAP = new Map(
    Object.entries(RISALE_KAVRAMLAR).map(([k, v]) => [k.toLowerCase(), v])
);
// FULL = hardcoded + kavramlar.json (panel için, binlerce kavram)
let KAVRAM_FULL_MAP = new Map(
    Object.entries(RISALE_KAVRAMLAR).map(([k, v]) => [k.toLowerCase(), v])
);
// Geriye uyumluluk için KAVRAM_MAP = FULL
let KAVRAM_MAP = KAVRAM_FULL_MAP;
// Tekil kelimeler Map'i
let OTTOMAN_MAP = new Map(
    Object.entries(OTTOMAN_DICT_BASE).map(([k, v]) => [k.toLowerCase(), v])
);
let OTTOMAN_DICT = { ...OTTOMAN_DICT_BASE };

/**
 * ottoman_dict.json varsa yükle (cache ile).
 */
async function loadOttomanDictJSON() {
    try {
        const res = await fetch('src/ottoman_dict.json', { cache: 'default' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data === 'object' && data !== null) {
            OTTOMAN_DICT = Object.assign({}, data, OTTOMAN_DICT_BASE);
            OTTOMAN_MAP = new Map(
                Object.entries(OTTOMAN_DICT).map(([k, v]) => [k.toLowerCase(), v])
            );
            window.OTTOMAN_DICT = OTTOMAN_DICT;
            console.log(`📖 ottoman_dict.json yüklendi: ${OTTOMAN_MAP.size} kelime`);
        }
    } catch (_) { }
}

/**
 * kavramlar.json varsa yükle (build_kavramlar.py çıktısı).
 * Format: { "kavram": { "baglam": "...", "atiflar": [{kitap, bolum}] } }
 */
async function loadKavramlarJSON() {
    try {
        const res = await fetch('src/kavramlar.json', { cache: 'default' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data === 'object' && data !== null) {
            // JSON kavramları sadece FULL MAP'e ekle (panel için)
            // INLINE MAP'e eklemiyoruz (performans: binlerce regex çalıştırmaz)
            for (const [k, v] of Object.entries(data)) {
                const lower = k.toLowerCase();
                if (!KAVRAM_FULL_MAP.has(lower)) {
                    KAVRAM_FULL_MAP.set(lower, v);
                }
            }
            window.KAVRAM_MAP = KAVRAM_FULL_MAP;
            console.log(`📖 kavramlar.json yüklendi: toplam ${KAVRAM_FULL_MAP.size} kavram (inline: ${KAVRAM_INLINE_MAP.size})`);
            // Eğer okuyucu zaten bir bölüm gösteriyorsa, kavram panelini yenile
            const readerContent = document.getElementById('reader-content');
            if (readerContent && readerContent.textContent.length > 100 && typeof populateKavramPanel === 'function') {
                populateKavramPanel(readerContent);
            }
        }
    } catch (_) { }
}

loadOttomanDictJSON();
loadKavramlarJSON();

/**
 * Metin içindeki Osmanlıca kelimeleri span ile sarar.
 *
 * Aşama 1: Risale kavramları (çok kelimeli, tam eşleşme) — özel stil
 * Aşama 2: Tekil kelimeler (Map lookup, O(1)) — standart stil
 */
function applyOttomanSpans(container) {
    if (!container) return;

    // ── Aşama 1: Risale kavramları (sadece hardcoded ~160, performans) ────────
    const kavramlar = [...KAVRAM_INLINE_MAP.entries()].sort((a, b) => b[0].length - a[0].length);

    for (const [kavram, value] of kavramlar) {
        // value = string (hardcoded) veya { baglam, atiflar } (kavramlar.json)
        let tooltipText;
        if (typeof value === 'string') {
            tooltipText = value;
        } else if (value && value.baglam) {
            let t = value.baglam.slice(0, 200);
            if (value.atiflar && value.atiflar.length > 0) {
                const refs = value.atiflar.slice(0, 4)
                    .map(r => `📖 ${r.kitap} / ${r.bolum}`).join(' │ ');
                t += '\n' + refs;
            }
            tooltipText = t;
        } else {
            continue;
        }

        const escaped = kavram.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/'/g, "[''']")
            .replace(/\s+/g, '\\s+');
        const re = new RegExp(`(${escaped})`, 'gi');

        getTextNodesIn(container).forEach(node => {
            const text = node.textContent;
            if (!re.test(text)) return;
            re.lastIndex = 0;

            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                if (m.index > lastIndex)
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
                const span = document.createElement('span');
                span.className = 'ottoman-word ottoman-kavram';
                span.setAttribute('data-meaning', tooltipText);
                span.setAttribute('data-type', 'kavram');
                span.textContent = m[0];
                frag.appendChild(span);
                lastIndex = re.lastIndex;
            }
            if (lastIndex < text.length)
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            if (frag.childNodes.length > 1)
                node.parentNode.replaceChild(frag, node);
        });
    }

    // ── Aşama 2: Tekil kelimeler (Map lookup) ──────────────────────────────────
    if (OTTOMAN_MAP.size === 0) return;

    const TOKEN_RE = /[\wâîûÂÎÛıİğüşöçĞÜŞÖÇ'''-]+/g;

    getTextNodesIn(container).forEach(node => {
        const text = node.textContent;
        if (text.length < 3) return;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let matched = false;
        let m;

        TOKEN_RE.lastIndex = 0;
        while ((m = TOKEN_RE.exec(text)) !== null) {
            const token = m[0];
            const lower = token.toLowerCase().replace(/['''\u2018\u2019]/g, "'");
            const meaning = OTTOMAN_MAP.get(lower);
            if (!meaning) continue;

            matched = true;
            if (m.index > lastIndex)
                frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));

            const span = document.createElement('span');
            span.className = 'ottoman-word';
            span.setAttribute('data-meaning', meaning);
            span.textContent = token;
            frag.appendChild(span);
            lastIndex = TOKEN_RE.lastIndex;
        }

        if (!matched) return;
        if (lastIndex < text.length)
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode.replaceChild(frag, node);
    });
}

/** Bir konteynerdeki tüm yaprak metin düğümlerini döndürür */
function getTextNodesIn(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentNode;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName?.toUpperCase();
            if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(tag)) return NodeFilter.FILTER_REJECT;
            if (parent.classList?.contains('ottoman-word')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}

// Global erişim
window.OTTOMAN_DICT = OTTOMAN_DICT;
window.OTTOMAN_MAP = OTTOMAN_MAP;
window.KAVRAM_MAP = KAVRAM_MAP;
window.applyOttomanSpans = applyOttomanSpans;
window.loadOttomanDictJSON = loadOttomanDictJSON;
