import glob
import json
import os
import re
from collections import defaultdict


ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
KULLIYAT_DIR = os.path.join(ROOT_DIR, "knowledge-base", "kulliyat")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "citation_graph.json")


WORD_RE = r"[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]+"
NUMBER_PHRASE_RE = rf"(?:{WORD_RE}(?:\s+{WORD_RE}){{0,4}})"
TYPE_RE = r"(?:Söz|Soz|Mektup|Lem'?a|Lema|Şuâ|Şua|Sua|Mesele|Makam|Nükte|Nukte)"
SUFFIX_RE = r"(?:['’](?:de|da|te|ta|den|dan|nin|nın|nun|nün|ye|ya|yi|yı|yu|yü))?"

# Examples captured: Onuncu Söz'de, Yirmi Dördüncü Mektup'ta, Üçüncü Lem'a
CITATION_RE = re.compile(
    rf"\b(?P<number>{NUMBER_PHRASE_RE})\s+(?P<kind>{TYPE_RE})\b{SUFFIX_RE}",
    flags=re.IGNORECASE,
)

FRONTMATTER_RE = re.compile(r"^---\s*\n([\s\S]*?)\n---\s*", flags=re.MULTILINE)
BOLUM_RE = re.compile(r"^\s*bölüm\s*:\s*\"?([^\"\n]+)\"?\s*$", flags=re.IGNORECASE | re.MULTILINE)


def normalize_text(value: str) -> str:
    value = (value or "").strip()
    value = re.sub(r"\s+", " ", value)
    return value


def normalize_kind(kind: str) -> str:
    k = normalize_text(kind).lower()
    mapping = {
        "soz": "Söz",
        "söz": "Söz",
        "mektup": "Mektup",
        "lema": "Lem'a",
        "lem'a": "Lem'a",
        "şua": "Şuâ",
        "şuâ": "Şuâ",
        "sua": "Şuâ",
        "mesele": "Mesele",
        "makam": "Makam",
        "nukte": "Nükte",
        "nükte": "Nükte",
    }
    return mapping.get(k, kind)


def derive_section_from_filename(file_path: str) -> str:
    name = os.path.basename(file_path).replace(".md", "")
    name = re.sub(r"^\d+[-_]", "", name)
    parts = [p for p in name.replace("_", "-").split("-") if p]
    return " ".join(parts).title() if parts else "Belirtilmemiş"


def get_source_section(content: str, file_path: str) -> str:
    fm_match = FRONTMATTER_RE.match(content)
    if fm_match:
        bolum_match = BOLUM_RE.search(fm_match.group(1))
        if bolum_match:
            return normalize_text(bolum_match.group(1))
    return derive_section_from_filename(file_path)


def extract_targets(content: str) -> list[str]:
    targets = []
    seen = set()
    for match in CITATION_RE.finditer(content):
        number = normalize_text(match.group("number"))
        kind = normalize_kind(match.group("kind"))
        target = f"{number} {kind}"
        key = target.casefold()
        if key not in seen:
            seen.add(key)
            targets.append(target)
    return targets


def build_graph() -> dict:
    md_files = glob.glob(os.path.join(KULLIYAT_DIR, "**", "*.md"), recursive=True)
    edges = []
    outgoing = defaultdict(list)
    incoming = defaultdict(list)

    for md_file in md_files:
        with open(md_file, "r", encoding="utf-8") as f:
            content = f.read()

        source = get_source_section(content, md_file)
        targets = extract_targets(content)

        for target in targets:
            edges.append({"kaynak": source, "hedef": target})
            outgoing[source].append(target)
            incoming[target].append(source)

    by_section = {}
    all_sections = set(outgoing.keys()) | set(incoming.keys())
    for section in sorted(all_sections, key=str.casefold):
        by_section[section] = {
            "verdigii_atiflar": sorted(set(outgoing.get(section, [])), key=str.casefold),
            "bu_bolume_atif_yapanlar": sorted(set(incoming.get(section, [])), key=str.casefold),
        }

    return {
        "toplam_dosya": len(md_files),
        "toplam_kenar": len(edges),
        "edges": edges,
        "by_section": by_section,
    }


def main() -> None:
    graph = build_graph()
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    print(f"citation_graph.json generated: {OUTPUT_PATH}")
    print(f"files={graph['toplam_dosya']} edges={graph['toplam_kenar']}")


if __name__ == "__main__":
    main()
