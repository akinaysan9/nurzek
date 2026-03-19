#!/usr/bin/env python3
"""
concept_families.json dosyasına Risale-i Nur bilgisiyle
aliases, antonyms ve kok_risale düzeltmelerini ekler.
Sadece bir kere çalıştırılır.
"""

import json
from pathlib import Path

CF_PATH = Path(__file__).parent / "concept_families.json"

# ---------------------------------------------------------------------------
# Elle doldurulan kavram ailesi zenginleştirmeleri
# ---------------------------------------------------------------------------
ENRICHMENTS = {

    # ── ENE & BENLİK AİLESİ ──────────────────────────────────────────────
    "ene": {
        "aliases": [
            "enaniyet", "enaniyetin", "enaniyete", "enaniyetten",
            "benlik", "benlikleri", "benliğin",
            "ene-i külliye", "ene-i cüziye",
            "egoizm", "ego",
        ],
        "antonyms": [
            "fenafillah", "fena", "mahviyet", "tevazu",
            "terk-i enaniyet", "nahnü",
        ],
        "related": [
            "zerre", "mahiyet", "hakikat", "ene risalesi",
            "emanet", "ayna", "misal",
        ],
        "kok_risale": "sozler/otuzuncu-soz",
    },
    "enaniyet": {
        "aliases": ["enaniyet", "enaniyeti", "enaniyet-i cüziye"],
        "antonyms": ["mahviyet", "tevazu", "fenafillah", "terk-i enaniyet"],
        "related": ["ene", "benlik", "kibir", "şeytan", "nefs"],
        "kok_risale": "sozler/otuzuncu-soz",
    },
    "benlik": {
        "aliases": ["benliğin", "benlikleri", "benliğe"],
        "antonyms": ["mahviyet", "tevazu", "fenafillah"],
        "related": ["ene", "enaniyet", "nefs", "egoizm"],
        "kok_risale": "sozler/otuzuncu-soz",
    },

    # ── İMAN AİLESİ ──────────────────────────────────────────────────────
    "iman": {
        "aliases": [
            "imanın", "imanî", "imanla", "imana", "imanı",
            "iman-ı tahkikî", "iman-ı hakikî", "iman-ı kâmil",
            "inanç", "akide",
        ],
        "antonyms": ["küfür", "inkâr", "şirk", "nifak", "dalâlet"],
        "related": [
            "yakîn", "marifet", "basîret", "hakikat",
            "iman risalesi", "tahkikî iman",
        ],
        "kok_risale": "sozler/onuncu-soz",
    },
    "yakîn": {
        "aliases": ["yakinin", "yâkîn", "kat'iyet", "kesin inanç"],
        "antonyms": ["şüphe", "tereddüt", "vesvese"],
        "related": ["iman", "marifet", "keşif", "müşahede"],
        "kok_risale": "lemalar/on-birinci-lema",
    },
    "marifet": {
        "aliases": ["marifetullah", "marifeti", "marifetle", "irfan"],
        "antonyms": ["cehalet", "gaflet", "inkâr"],
        "related": ["iman", "yakîn", "tefekkür", "hikmet", "muhabbet"],
        "kok_risale": "sozler/otuz-ikinci-soz",
    },

    # ── TEVHİD AİLESİ ────────────────────────────────────────────────────
    "tevhid": {
        "aliases": [
            "tevhidin", "tevhide", "tevhidi",
            "vahdaniyet", "birlik", "tawhid",
            "La ilahe illallah", "kelime-i tevhid",
        ],
        "antonyms": ["şirk", "küfür", "tabiat", "sebepler"],
        "related": ["vahidiyet", "ehadiyet", "vahdet", "uluhiyet"],
        "kok_risale": "sozler/yirmi-ikinci-soz",
    },
    "vahidiyet": {
        "aliases": ["vahidiyetin", "vahdaniyet", "ism-i Vahid"],
        "antonyms": ["kesret", "şirk", "taaddüd"],
        "related": ["ehadiyet", "tevhid", "celal", "kâinat", "küll"],
        "kok_risale": "sozler/otuzuncu-soz",
    },
    "ehadiyet": {
        "aliases": ["ehadiyetin", "ism-i Ehad", "Ahad"],
        "antonyms": ["kesret", "taaddüd"],
        "related": ["vahidiyet", "cemal", "tevhid", "cüz", "fert"],
        "kok_risale": "sozler/otuzuncu-soz",
    },
    "vahdet": {
        "aliases": ["vahdetin", "vahdeti", "birlik", "yekparelik"],
        "antonyms": ["kesret", "ikilik", "çokluk", "şirk"],
        "related": ["tevhid", "vahidiyet", "ehadiyet"],
        "kok_risale": "sozler/yirmi-ikinci-soz",
    },

    # ── İHLAS AİLESİ ─────────────────────────────────────────────────────
    "ihlas": {
        "aliases": [
            "ihlası", "ihlasın", "ihlasla", "ihlasse",
            "ihlâs", "ihlâsın",
            "samimiyet", "hulus",
        ],
        "antonyms": [
            "riya", "sum'a", "gösteriş", "enaniyet",
            "nefis hesabı", "dünya menfaati",
        ],
        "related": [
            "niyet", "rıza-yı ilahi", "ubudiyet",
            "kardeşlik", "tesanüt", "ihlas risalesi",
        ],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── TEVEKKÜL & TESLİM AİLESİ ─────────────────────────────────────────
    "tevekkül": {
        "aliases": [
            "tevekkülün", "tevekkülde", "tevekkülü",
            "tevekkelde", "Allah'a dayanma", "tevekkülname",
        ],
        "antonyms": [
            "tenbellik", "acz karşısında ümitsizlik",
            "kendi gücüne güvenme", "esbabperestlik",
        ],
        "related": ["tefviz", "teslim", "rıza", "kanaat", "sabır"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "tefviz": {
        "aliases": ["tefvizi", "tefvizin", "havale etmek", "Allah'a bırakmak"],
        "antonyms": ["esbabperestlik", "kendi hesabına çalışma"],
        "related": ["tevekkül", "teslim", "rıza", "kanaat"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "teslim": {
        "aliases": ["teslimiyet", "teslimiyetin", "boyun eğme", "itaat"],
        "antonyms": ["isyan", "itiraz", "nefs-i emmare"],
        "related": ["tevekkül", "rıza", "sabır", "tefviz"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "rıza": {
        "aliases": ["rızayı", "rızasını", "rıza-yı ilahi", "hoşnutluk"],
        "antonyms": ["şikâyet", "isyan", "hoşnutsuzluk"],
        "related": ["tevekkül", "sabır", "teslim", "şükür"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "sabır": {
        "aliases": ["sabrın", "sabrı", "sabredip", "tahammül", "metanet"],
        "antonyms": ["sabırsızlık", "isyan", "feryat", "şikâyet"],
        "related": ["şükür", "rıza", "tevekkül", "musibetlere karşı"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── ŞÜKÜR & TEFEKKÜR ─────────────────────────────────────────────────
    "şükür": {
        "aliases": [
            "şükrün", "şükrü", "şükürle", "hamd",
            "minnettarlık", "nankörlük karşıtı",
        ],
        "antonyms": ["nankörlük", "küfran-ı nimet", "şikâyet"],
        "related": ["hamd", "tefekkür", "nimet", "ihlas", "ubudiyet"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "hamd": {
        "aliases": ["hamdin", "hamde", "hamdi", "elhamdülillah", "sena"],
        "antonyms": ["nankörlük", "şikâyet"],
        "related": ["şükür", "tefekkür", "ubudiyet"],
        "kok_risale": "sozler/birinci-soz",
    },
    "tefekkür": {
        "aliases": [
            "tefekkürün", "tefekkürde", "tefekkürü",
            "düşünme", "teemmül", "tedebbür", "derin düşünce",
        ],
        "antonyms": ["gaflet", "sefahet", "yüzeysellik"],
        "related": ["marifet", "hikmet", "müşahede", "nazm", "ibret"],
        "kok_risale": "sozler/otuzuncu-soz",
    },

    # ── KADER AİLESİ ─────────────────────────────────────────────────────
    "kader": {
        "aliases": [
            "kaderin", "kadere", "kaderle", "kader-i ilahi",
            "takdir", "alın yazısı", "mukadderat",
        ],
        "antonyms": ["tesadüf", "irade-i cüziye inkârı"],
        "related": ["kazâ", "meşiet", "irade", "tevekkül", "rıza"],
        "kok_risale": "sozler/yirmi-altinci-soz",
    },
    "kazâ": {
        "aliases": ["kazanın", "kaza-yı ilahi", "hüküm"],
        "antonyms": ["tesadüf"],
        "related": ["kader", "meşiet", "irade"],
        "kok_risale": "sozler/yirmi-altinci-soz",
    },

    # ── HAYAT & ZERRE ─────────────────────────────────────────────────────
    "hayat": {
        "aliases": [
            "hayatın", "hayata", "hayatı", "hayatla",
            "can", "dirilik", "heyat",
        ],
        "antonyms": ["mevt", "ölüm", "cansızlık", "cemat"],
        "related": [
            "zerre", "kâinat", "Hay ismi", "kayyumiyet",
            "ruh", "hayat risalesi",
        ],
        "kok_risale": "lemalar/otuzuncu-lema",
    },
    "zerre": {
        "aliases": [
            "zerrenin", "zerreye", "zerreler", "atom",
            "cevher-i ferd", "unsur",
        ],
        "antonyms": ["küll", "kâinat bütünü"],
        "related": [
            "ene", "hayat", "kayyumiyet", "Sırr-ı Kayyumiyet",
            "ene ve zerre", "30. Söz",
        ],
        "kok_risale": "sozler/otuzuncu-soz",
    },

    # ── CELAL & CEMAL ────────────────────────────────────────────────────
    "celal": {
        "aliases": [
            "celalin", "celale", "celalî", "celal-i ilahi",
            "azamet", "heybetli tecelli", "jalal",
        ],
        "antonyms": ["cemal", "lütuf", "yumuşaklık"],
        "related": ["cemal", "vahidiyet", "kudret", "azamet", "gazap"],
        "kok_risale": "lemalar/otuzuncu-lema",
    },
    "cemal": {
        "aliases": [
            "cemalin", "cemale", "cemalî", "cemal-i ilahi",
            "güzellik", "lütuf tecellisi", "jamal",
        ],
        "antonyms": ["celal", "gazap", "azamet"],
        "related": ["celal", "ehadiyet", "rahmet", "lütuf", "muhabbet"],
        "kok_risale": "lemalar/otuzuncu-lema",
    },

    # ── HAKIKAT ───────────────────────────────────────────────────────────
    "hakikat": {
        "aliases": [
            "hakikatin", "hakikate", "hakikati", "hakikatle",
            "gerçek", "öz", "asıl",
        ],
        "antonyms": ["mecaz", "vehim", "dalâlet", "batıl", "hurafe"],
        "related": [
            "marifet", "iman", "tefekkür", "hikmet",
            "hakikat-ı hal", "Kur'an hakikatleri",
        ],
        "kok_risale": "sozler/yirmi-ikinci-soz",
    },

    # ── RAHMET ───────────────────────────────────────────────────────────
    "rahmet": {
        "aliases": [
            "rahmetin", "rahmete", "rahmeti", "rahmetle",
            "rahim", "merhamet", "şefkat-i ilahi",
        ],
        "antonyms": ["gazap", "kahır", "azap"],
        "related": ["şefkat", "cemal", "nimet", "rızık", "hikmet"],
        "kok_risale": "sozler/onuncu-soz",
    },
    "şefkat": {
        "aliases": [
            "şefkatin", "şefkate", "şefkati",
            "merhamet", "acıma", "sevgi",
        ],
        "antonyms": ["sertlik", "merhametsizlik", "celal"],
        "related": ["rahmet", "cemal", "muhabbet", "ihlas"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── UBUDİYET & İBADET ────────────────────────────────────────────────
    "ubudiyet": {
        "aliases": [
            "ubudiyetin", "ubudiyete", "kulluğun", "kulluk",
            "abd", "ibadet", "ubudet",
        ],
        "antonyms": ["kibir", "enaniyet", "isyan", "tekebbür"],
        "related": ["ibadet", "ihlas", "namaz", "dua", "zikir"],
        "kok_risale": "sozler/yirmi-uc-uncu-soz",
    },
    "ibadet": {
        "aliases": [
            "ibadetin", "ibadete", "ibadeti", "ibadetler",
            "kulluk", "ubudiyet",
        ],
        "antonyms": ["isyan", "gaflet", "sefahet"],
        "related": ["namaz", "oruç", "dua", "zikir", "ubudiyet"],
        "kok_risale": "sozler/yirmi-uc-uncu-soz",
    },

    # ── KALP & RUH ───────────────────────────────────────────────────────
    "kalp": {
        "aliases": [
            "kalbin", "kalbe", "kalbi", "kalple",
            "gönül", "yürek", "fuad",
        ],
        "antonyms": ["nefs", "şeytan", "kör kalp", "kasavet"],
        "related": ["ruh", "iman", "ihlas", "zikir", "muhabbet"],
        "kok_risale": "lemalar/on-birinci-lema",
    },
    "ruh": {
        "aliases": [
            "ruhun", "ruha", "ruhu", "ruhla",
            "can", "nefes-i rahmani",
        ],
        "antonyms": ["ceset", "madde", "cemat"],
        "related": ["kalp", "hayat", "beka", "âhiret", "letaif"],
        "kok_risale": "sozler/yirmi-dokuzuncu-soz",
    },

    # ── NEFS & ŞEYTAN ────────────────────────────────────────────────────
    "nefs": {
        "aliases": [
            "nefsin", "nefse", "nefsi", "nefs-i emmare",
            "nefs-i levvame", "nefs-i mutmainne", "ego",
        ],
        "antonyms": ["ruh", "kalp", "ubudiyet", "ihlas"],
        "related": ["şeytan", "enaniyet", "heva", "cihad-ı ekber"],
        "kok_risale": "lemalar/on-birinci-lema",
    },
    "şeytan": {
        "aliases": [
            "şeytanın", "şeytana", "şeytanı", "iblis",
            "vesveseci", "şeytanî",
        ],
        "antonyms": ["melek", "rahmet", "hidayet"],
        "related": ["nefs", "vesvese", "günah", "dalâlet"],
        "kok_risale": "lemalar/on-uc-uncu-lema",
    },

    # ── ÂLEM & KÂİNAT ───────────────────────────────────────────────────
    "kâinat": {
        "aliases": [
            "kâinatın", "kâinata", "kâinatı", "evren",
            "âfak", "varlık bütünü", "kozmos",
        ],
        "antonyms": ["yokluk", "adem", "hiçlik"],
        "related": ["âlem", "hilkat", "hayat", "hikmet", "tevhid"],
        "kok_risale": "sozler/otuzuncu-soz",
    },
    "âlem": {
        "aliases": [
            "âlemin", "âleme", "âlemi", "dünya",
            "varlık", "mülk", "şu kâinat",
        ],
        "antonyms": ["adem", "yokluk"],
        "related": ["kâinat", "hilkat", "beka", "âhiret"],
        "kok_risale": "sozler/onuncu-soz",
    },

    # ── ÂHİRET & BEKA ────────────────────────────────────────────────────
    "âhiret": {
        "aliases": [
            "âhiretin", "âhirete", "öte dünya",
            "dar-ı beka", "mahşer", "ebedî hayat",
        ],
        "antonyms": ["dünya", "fani hayat", "dünyaperestlik"],
        "related": ["beka", "ebediyet", "iman", "mizan", "şefaat"],
        "kok_risale": "sozler/onuncu-soz",
    },
    "beka": {
        "aliases": [
            "bekanın", "bekaya", "bekası", "ebedîlik",
            "ölümsüzlük", "kalıcılık",
        ],
        "antonyms": ["fena", "zeval", "fanîlik", "ölüm"],
        "related": ["âhiret", "ebediyet", "ruh", "iman"],
        "kok_risale": "sozler/onuncu-soz",
    },
    "fena": {
        "aliases": [
            "fenanın", "fenaya", "yok oluş", "fenafillah",
            "geçicilik", "fanîlik",
        ],
        "antonyms": ["beka", "ebediyet", "kalıcılık"],
        "related": ["beka", "âhiret", "mahviyet", "tevazu"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── HİKMET ───────────────────────────────────────────────────────────
    "hikmet": {
        "aliases": [
            "hikmetin", "hikmete", "hikmeti", "hikmetle",
            "ilahi gaye", "maslahat", "özlü bilgelik",
        ],
        "antonyms": ["abes", "anlamsızlık", "tesadüf", "hikmetsizlik"],
        "related": ["hakikat", "kudret", "kâinat", "ilim", "tefekkür"],
        "kok_risale": "sozler/onuncu-soz",
    },

    # ── TECELLÎ ───────────────────────────────────────────────────────────
    "tecelli": {
        "aliases": [
            "tecellinin", "tecelliye", "tecellisi",
            "tecelliyat", "zuhur", "görünme",
        ],
        "antonyms": ["gizlilik", "hicab", "perde"],
        "related": ["celal", "cemal", "vahidiyet", "ehadiyet", "isimler"],
        "kok_risale": "lemalar/otuzuncu-lema",
    },

    # ── TESANÜT & TEAVÜN ─────────────────────────────────────────────────
    "tesanüt": {
        "aliases": [
            "tesanütün", "tesanüde", "dayanışma",
            "birlik", "kavuşma", "kenetlenme",
        ],
        "antonyms": ["tefrika", "ayrılık", "rekabet", "haset"],
        "related": ["teavün", "uhuvvet", "ihlas", "kardeşlik"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },
    "teavün": {
        "aliases": [
            "teavünün", "teavüne", "yardımlaşma",
            "karşılıklı yardım",
        ],
        "antonyms": ["cidal", "rekabet", "bencillik", "hodgâmlık"],
        "related": ["tesanüt", "uhuvvet", "ihlas", "kardeşlik"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },
    "uhuvvet": {
        "aliases": [
            "uhuvvetin", "uhuvvete", "kardeşlik",
            "imanî kardeşlik", "kardeşane",
        ],
        "antonyms": ["husumet", "kin", "tefrika", "ayrılık"],
        "related": ["tesanüt", "teavün", "ihlas", "muhabbet"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── İHLAS'ın kardeşi: NİYET ──────────────────────────────────────────
    "niyet": {
        "aliases": ["niyetin", "niyete", "niyetini", "niyet-i hâlise"],
        "antonyms": ["riya", "gösteriş", "menfaat peşinde koşma"],
        "related": ["ihlas", "ubudiyet", "rıza-yı ilahi"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── DUA ──────────────────────────────────────────────────────────────
    "dua": {
        "aliases": [
            "duanın", "duaya", "duası", "niyaz",
            "münâcât", "yakarış",
        ],
        "antonyms": ["gaflet", "istiğna", "gurur"],
        "related": ["niyaz", "ubudiyet", "ibadet", "rahmet", "acz"],
        "kok_risale": "sozler/yirmi-uc-uncu-soz",
    },

    # ── NÜBÜVVET ─────────────────────────────────────────────────────────
    "nübüvvet": {
        "aliases": [
            "nübüvvetin", "nübüvvete", "peygamberlik",
            "risalet", "risalet-i Muhammedî",
        ],
        "antonyms": ["inkâr", "yalanlama", "cahiliye"],
        "related": ["risalet", "mucize", "Kur'an", "vahiy", "sünnet"],
        "kok_risale": "sozler/on-dokuzuncu-soz",
    },
    "risalet": {
        "aliases": [
            "risaletin", "risalete", "elçilik",
            "peygamberlik", "nübüvvet",
        ],
        "antonyms": ["inkâr", "tekzip"],
        "related": ["nübüvvet", "mucize", "sünnet", "Kur'an"],
        "kok_risale": "mektubat/on-dokuzuncu-mektup",
    },

    # ── ZİKİR & MÜŞAHEDE ─────────────────────────────────────────────────
    "zikir": {
        "aliases": [
            "zikrin", "zikre", "zikri", "Allah'ı anma",
            "tesbih", "kelime-i tevhid",
        ],
        "antonyms": ["gaflet", "nisyan", "unutma"],
        "related": ["tefekkür", "dua", "ubudiyet", "kalp"],
        "kok_risale": "lemalar/on-birinci-lema",
    },
    "müşahede": {
        "aliases": [
            "müşahedenin", "müşahede etmek",
            "seyretmek", "görmek", "kalben görmek",
        ],
        "antonyms": ["gaflet", "kör olmak"],
        "related": ["keşif", "ilham", "tefekkür", "marifet"],
        "kok_risale": "lemalar/on-birinci-lema",
    },
    "keşif": {
        "aliases": [
            "keşfin", "keşfe", "keşfi", "keşfiyat",
            "manevi keşif", "ilham",
        ],
        "antonyms": ["gaflet", "cehalet"],
        "related": ["ilham", "müşahede", "marifet", "velayet"],
        "kok_risale": "lemalar/on-birinci-lema",
    },

    # ── KUDRET & İRADE ───────────────────────────────────────────────────
    "kudret": {
        "aliases": [
            "kudretin", "kudrete", "kudreti", "kudretle",
            "kuvvet", "güç", "tasarruf",
        ],
        "antonyms": ["acz", "acizlik", "güçsüzlük"],
        "related": ["irade", "ilim", "hikmet", "iradetullah"],
        "kok_risale": "sozler/yirmi-ikinci-soz",
    },
    "irade": {
        "aliases": [
            "iradenin", "iradeye", "iradesi", "irade-i ilahi",
            "dilek", "istek", "meşiet",
        ],
        "antonyms": ["cebrîlik", "mecburiyet", "tesadüf"],
        "related": ["kudret", "kader", "meşiet", "irade-i cüziye"],
        "kok_risale": "sozler/yirmi-altinci-soz",
    },

    # ── HİDAYET ──────────────────────────────────────────────────────────
    "hidayet": {
        "aliases": [
            "hidayetin", "hidayete", "hidayeti",
            "doğru yol", "irşad", "rehberlik",
        ],
        "antonyms": ["dalâlet", "sapkınlık", "küfür", "şeytan yolu"],
        "related": ["iman", "Kur'an", "nübüvvet", "istikamet"],
        "kok_risale": "sozler/yirmi-dorduncu-soz",
    },
    "istikamet": {
        "aliases": [
            "istikametin", "istikamete", "doğruluk",
            "dürüstlük", "sebat", "istikrarlı olma",
        ],
        "antonyms": ["sapkınlık", "inhiraf", "dalâlet"],
        "related": ["hidayet", "ihlas", "sünnet", "takva"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── KANAAT & ZÜHD ────────────────────────────────────────────────────
    "kanaat": {
        "aliases": [
            "kanaatin", "kanaate", "kanaati",
            "yetinme", "az ile yetinme", "iktifa",
        ],
        "antonyms": ["hırs", "tamah", "istiğna yoksunluğu"],
        "related": ["istiğna", "zühd", "sabır", "tevekkül"],
        "kok_risale": "lemalar/yirmi-sekizinci-lema",
    },
    "istiğna": {
        "aliases": [
            "istiğnanın", "istiğnaya", "tok gözlülük",
            "muhtaç olmamak", "izzet",
        ],
        "antonyms": ["tamah", "hırs", "el açma", "dünya sevgisi"],
        "related": ["kanaat", "zühd", "izzet", "ihlas"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },
    "zühd": {
        "aliases": [
            "zühdin", "zühde", "zühdü", "dünyaya karşı ilgisizlik",
            "vera", "perhizkârlık",
        ],
        "antonyms": ["dünyaperestlik", "hırs", "rağbet"],
        "related": ["kanaat", "istiğna", "takva", "ihlas"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── TAKVA ────────────────────────────────────────────────────────────
    "takva": {
        "aliases": [
            "takvanın", "takvaya", "takvası",
            "günahtan sakınma", "vera", "huşu",
        ],
        "antonyms": ["günah", "fısk", "isyan", "cüret"],
        "related": ["ihlas", "istikamet", "zühd", "ibadet"],
        "kok_risale": "lemalar/yirmi-birinci-lema",
    },

    # ── MUCIZE & REMIZ ────────────────────────────────────────────────────
    "mucize": {
        "aliases": [
            "mucizin", "mucizeye", "mucizesi", "mucizat",
            "harikulade", "bürhan",
        ],
        "antonyms": ["sıradan", "olağan", "tesadüf"],
        "related": ["nübüvvet", "Kur'an", "belagat", "risalet"],
        "kok_risale": "mektubat/on-dokuzuncu-mektup",
    },
    "remiz": {
        "aliases": [
            "remzin", "remze", "remzi", "işaret",
            "ima", "kinaye", "sembol",
        ],
        "antonyms": ["açık ifade", "sarahat"],
        "related": ["belagat", "mucize", "Kur'an", "nazm"],
        "kok_risale": "isaratul-icaz/fatiha-suresi",
    },
}

# ---------------------------------------------------------------------------
# Uygula
# ---------------------------------------------------------------------------

def main():
    data = json.loads(CF_PATH.read_text(encoding="utf-8"))

    updated = 0
    not_found = []

    for concept, enrichment in ENRICHMENTS.items():
        if concept not in data:
            not_found.append(concept)
            continue

        entry = data[concept]
        for field, value in enrichment.items():
            entry[field] = value

        # _note güncelle
        entry["_note"] = "enriched — aliases ve antonyms elle dolduruldu"
        updated += 1

    CF_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Güncellendi : {updated} kavram")
    if not_found:
        print(f"Bulunamadı : {not_found}")
    print(f"Dosya       : {CF_PATH}")


if __name__ == "__main__":
    main()
