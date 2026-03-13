// Ottoman Turkish Dictionary Service
// Risale-i Nur'da sık geçen Osmanlıca/Arapça/Farsça terimler sözlüğü

const OTTOMAN_DICTIONARY = {
    // --- İman ve Akaid ---
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

    // --- Allah'ın İsimleri ve Sıfatları ---
    "esma-i hüsna": "Allah'ın güzel isimleri",
    "esma": "İsimler",
    "sıfat-ı ilahiye": "Allah'ın sıfatları",
    "tecelli": "Yansıma, görünme, Allah'ın isimlerinin yansıması",
    "tajalli": "Tecelli, yansıma",
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

    // --- Kur'an ve Vahiy ---
    "Kur'an-ı Kerim": "Allah'ın son ilahi kitabı",
    "Kur'an-ı Hakim": "Hikmetli Kur'an",
    "ayet": "Kur'an'ın en küçük birimi, delil, işaret",
    "sure": "Kur'an'ın bölümleri",
    "vahiy": "Allah'ın peygamberine bildirdiği ilahi mesaj",
    "tefsir": "Kur'an'ın açıklaması, yorumu",
    "i'caz": "Mucizelik, aciz bırakma (Kur'an'ın mucize oluşu)",
    "belagat": "Güzel ve etkili söz söyleme sanatı",
    "fesahat": "Sözün akıcı ve düzgün olması",
    "nazm": "Diziliş, düzen (Kur'an'ın kelime dizilişi)",

    // --- İnsan ve Nefis ---
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
    "latiyet": "İnce duygu, manevi his",
    "latife": "İnce duygu, zarif söz",

    // --- İbadet ve Amel ---
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
    "salat": "Namaz",
    "savm": "Oruç",
    "zekat": "Zekât, malın belirli kısmını fakirlere verme",
    "hac": "Hac ibadeti",

    // --- Risale-i Nur Terimleri ---
    "risale": "Küçük kitap, mektup",
    "külliyat": "Tüm eserler",
    "lem'a": "Parıltı (Lem'alar kitabı)",
    "şua": "Işın, ışık hüzmesi (Şualar kitabı)",
    "söz": "Kelam, söz (Sözler kitabı)",
    "mektub": "Mektup (Mektubat kitabı)",
    "lahika": "Ek, ilave (Lahika mektupları)",
    "nur": "Işık, aydınlık",
    "hizmet-i imaniye": "İman hizmeti",
    "hizmet-i Kur'aniye": "Kur'an hizmeti",
    "müdavele-i efkar": "Fikir alışverişi, müzakere",
    "meşveret": "İstişare, danışma",
    "uhuvvet": "Kardeşlik",
    "tesanüd": "Dayanışma",

    // --- Felsefe ve Kavramlar ---
    "kainat": "Evren, tüm yaratılmış âlem",
    "alem": "Dünya, evren, boyut",
    "mevcudat": "Var olan her şey, varlıklar",
    "mahlukat": "Yaratılmışlar",
    "tabiat": "Doğa",
    "hilkat": "Yaratılış",
    "hakikat": "Gerçek, gerçeklik",
    "marifet": "Bilgi, bilme",
    "ilim": "Bilim, bilgi",
    "irfan": "Derin bilgi, sezgisel anlayış",
    "burhan": "Kesin delil, kanıt",
    "hüccet": "Delil, kanıt",
    "misal": "Örnek, benzetme",
    "temsil": "Benzetme, sembol, alegori",
    "mecaz": "Gerçek anlamı dışında kullanılan söz",
    "mana": "Anlam, iç yüz",
    "sırr": "Gizli hakikat, derin mana",
    "hikmet-i İlahiye": "Allah'ın hikmeti, yaratılıştaki gaye",
    "insan-ı kamil": "Olgun insan, ideal insan",
    "fani": "Geçici, yok olacak",
    "baki": "Kalıcı, ebedi",
    "zeval": "Yok olma, son bulma",
    "fenâ": "Geçicilik, yok oluş",
    "beka": "Kalıcılık, sonsuzluk",
    "saadet": "Mutluluk",
    "şekavet": "Bedbahtlık, mutsuzluk",

    // --- Diğer Sık Kullanılanlar ---
    "evet": "Evet (vurgulama, tasdik)",
    "elhasıl": "Sonuç olarak, kısacası",
    "binaenaleyh": "Bundan dolayı, bu sebeple",
    "madem": "Mademki, çünkü",
    "demek": "Yani, öyleyse",
    "halbuki": "Oysa, ama",
    "zira": "Çünkü, zira",
    "hatta": "Hatta, üstelik",
    "acaba": "Acaba, merak edilen şey",
    "mesela": "Örneğin",
    "yani": "Yani, demek ki",
    "hem": "Ve, ayrıca",
    "elbette": "Kesinlikle, şüphesiz",
    "muhakkak": "Kesinlikle, şüphesiz",
    "katiyen": "Kesinlikle, asla",

    // --- Edebiyat ve İfade ---
    "Said Nursi": "Bediüzzaman Said Nursi, Risale-i Nur müellifi (1878-1960)",
    "Bediüzzaman": "Zamanın harikası (Said Nursi'nin lakabı)",
    "Üstad": "Hoca, öğretici (Said Nursi için kullanılır)",
    "müellif": "Yazar, eser sahibi",
    "talebe": "Öğrenci (Nur talebeleri)",
    "mütercim": "Tercüme eden, çevirmen",
    "müfessir": "Tefsir eden, Kur'an yorumcusu",
    "muhaddis": "Hadis alimi",
    "mutasavvıf": "Tasavvuf ehli, sufi",
    "müceddid": "Yenileyici, dini yenileyen alim",
    "alim": "Bilgin, ilim sahibi",
    "arif": "İrfan sahibi, bilen",
    "abid": "Çok ibadet eden",
    "zahid": "Dünyadan el çeken, züht ehli"
};

// Search dictionary
export function searchDictionary(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [term, meaning] of Object.entries(OTTOMAN_DICTIONARY)) {
        if (term.toLowerCase().includes(lowerQuery) || meaning.toLowerCase().includes(lowerQuery)) {
            results.push({ term, meaning });
        }
    }

    return results;
}

// Get meaning of a specific word
export function getMeaning(word) {
    const lowerWord = word.toLowerCase().trim();

    // Direct match
    if (OTTOMAN_DICTIONARY[lowerWord]) {
        return { term: lowerWord, meaning: OTTOMAN_DICTIONARY[lowerWord] };
    }

    // Partial match
    for (const [term, meaning] of Object.entries(OTTOMAN_DICTIONARY)) {
        if (term.toLowerCase() === lowerWord) {
            return { term, meaning };
        }
    }

    return null;
}

// Get all words that appear in a text
export function findOttomanWords(text) {
    const found = [];
    const lowerText = text.toLowerCase();

    for (const [term, meaning] of Object.entries(OTTOMAN_DICTIONARY)) {
        if (lowerText.includes(term.toLowerCase())) {
            // Find position
            const pos = lowerText.indexOf(term.toLowerCase());
            found.push({ term, meaning, position: pos });
        }
    }

    // Sort by position
    found.sort((a, b) => a.position - b.position);
    return found;
}

// Get full dictionary
export function getDictionary() {
    return OTTOMAN_DICTIONARY;
}

export default { searchDictionary, getMeaning, findOttomanWords, getDictionary };
