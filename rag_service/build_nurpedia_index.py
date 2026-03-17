#!/usr/bin/env python3
import argparse
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict


BASE_URL = 'https://nurpedia.org'
MEFHUM_CATEGORY_URL = f'{BASE_URL}/wiki/Kategori:Mefhum'
DEFAULT_OUTPUT = pathlib.Path(__file__).with_name('nurpedia_index.json')
DEFAULT_CACHE_DIR = pathlib.Path(__file__).with_name('data') / 'nurpedia_mefhum'
REQUEST_HEADERS = {
    'User-Agent': 'NurZekaBot/1.0 (+local research index builder)'
}
BOOK_MAP = {
    'soz': 'Sözler',
    'mektup': 'Mektubat',
    'lema': "Lem'alar",
    'sua': 'Şualar',
    'mesnevi': 'Mesnevi-i Nuriye',
    'muhakemat': 'Muhakemat',
    'munazarat': 'Münazarat',
    'tarihce-i-hayat': 'Tarihçe-i Hayat',
    'isaratul-icaz': "İşaratü'l-İ'caz",
    'asa-yi-musa': 'Asâ-yı Musa',
    'barla-lahikasi': 'Barla Lahikası',
    'kastamonu-lahikasi': 'Kastamonu Lahikası',
    'emirdag-lahikasi': 'Emirdağ Lahikası',
}


def slugify(text: str) -> str:
    value = str(text or '').lower()
    value = value.replace('ğ', 'g').replace('ü', 'u').replace('ş', 's')
    value = value.replace('ı', 'i').replace('ö', 'o').replace('ç', 'c')
    value = value.replace('â', 'a').replace('î', 'i').replace('û', 'u')
    value = re.sub(r'[^a-z0-9\s-]', '', value)
    value = re.sub(r'\s+', '-', value.strip())
    return re.sub(r'-{2,}', '-', value).strip('-')


def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def concept_key(text: str) -> str:
    return slugify(normalize_text(text).replace("'", ' '))


def fetch_text(url: str, sleep_seconds: float = 0.0) -> str:
    request = urllib.request.Request(url, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read().decode('utf-8', errors='ignore')
    if sleep_seconds:
        time.sleep(sleep_seconds)
    return payload


def ensure_parent(path: pathlib.Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def extract_concept_paths(category_html: str) -> list[str]:
    matches = re.findall(r'href="(/wiki/[^"#:]+)"', category_html)
    concept_paths = []
    seen = set()
    for path in matches:
        decoded = urllib.parse.unquote(path)
        title = decoded.replace('/wiki/', '', 1)
        if any(title.startswith(prefix) for prefix in ('Kategori:', 'Özel:', 'Risale:', 'Kuran:', 'Nurpedia:', 'Template:', 'Yardım:')):
            continue
        if title in {'Ana_Sayfa'}:
            continue
        if title not in seen:
            seen.add(title)
            concept_paths.append(path)
    return concept_paths


def fetch_raw_page(title: str, cache_dir: pathlib.Path, sleep_seconds: float = 0.2) -> str:
    cache_path = cache_dir / f'{slugify(title)}.wiki'
    if cache_path.exists():
        return cache_path.read_text(encoding='utf-8', errors='ignore')

    query = urllib.parse.urlencode({'title': title, 'action': 'raw'})
    raw_url = f'{BASE_URL}/index.php?{query}'
    raw_text = fetch_text(raw_url, sleep_seconds=sleep_seconds)
    ensure_parent(cache_path)
    cache_path.write_text(raw_text, encoding='utf-8')
    return raw_text


def parse_risale_reference(raw_title: str) -> tuple[str, str]:
    title = normalize_text(raw_title).replace('Risale:', '')
    slug = slugify(title)

    numbered = re.match(r'(?P<number>\d+)\.?-(?P<kind>soz|mektup|lema|sua)$', slug)
    if numbered:
        number = numbered.group('number')
        kind = numbered.group('kind')
        book = BOOK_MAP[kind]
        if kind == 'soz':
            section = f'{number}. Söz'
        elif kind == 'mektup':
            section = f'{number}. Mektup'
        elif kind == 'lema':
            section = f"{number}. Lem'a"
        else:
            section = f'{number}. Şua'
        return book, section

    for prefix, book in BOOK_MAP.items():
        if slug.startswith(prefix):
            return book, title

    lem_link = re.match(r'(?P<number>\d+)\.\s*lem', title, flags=re.IGNORECASE)
    if lem_link:
        return "Lem'alar", f"{lem_link.group('number')}. Lem'a"

    return title, title


def extract_section(raw_text: str, section_name: str) -> str:
    escaped = re.escape(section_name)
    pattern = rf'==+\s*{escaped}\s*==+(?P<body>[\s\S]*?)(?:\n==[^=]|\Z)'
    match = re.search(pattern, raw_text, flags=re.IGNORECASE)
    return match.group('body') if match else ''


def extract_links(raw_text: str) -> list[tuple[str, str]]:
    links = []
    for match in re.finditer(r'\[\[(?P<title>[^\]|#]+)(?:#[^\]|]+)?(?:\|(?P<label>[^\]]+))?\]\]', raw_text):
        title = normalize_text(match.group('title'))
        label = normalize_text(match.group('label') or title)
        links.append((title, label))
    return links


def build_index(limit: int | None, sleep_seconds: float, cache_dir: pathlib.Path) -> dict:
    category_html = fetch_text(MEFHUM_CATEGORY_URL, sleep_seconds=0.0)
    ensure_parent(cache_dir / 'dummy')
    (cache_dir / 'kategori_mefhum.html').write_text(category_html, encoding='utf-8')

    concept_paths = extract_concept_paths(category_html)
    if limit:
        concept_paths = concept_paths[:limit]

    concepts = {}
    alias_to_concepts = defaultdict(set)

    for path in concept_paths:
        title = urllib.parse.unquote(path.replace('/wiki/', '', 1))
        raw_text = fetch_raw_page(title, cache_dir=cache_dir, sleep_seconds=sleep_seconds)
        display = normalize_text(title.replace('_', ' '))
        key = concept_key(display)
        if not key:
            continue

        section_body = extract_section(raw_text, "Risale-i Nur'da Nerede ve Nasıl Bahsedildiği")
        related_body = extract_section(raw_text, 'İlgili Maddeler')
        category_body = extract_section(raw_text, 'Kaynakça')

        reference_counter = Counter()
        for link_title, _ in extract_links(section_body or raw_text):
            if not link_title.startswith('Risale:'):
                continue
            book, section = parse_risale_reference(link_title)
            reference_counter[(book, section)] += 1

        ranked_references = []
        for (book, section), count in reference_counter.most_common(10):
            ranked_references.append({
                'book': book,
                'section': section,
                'count': count,
                'score': float(count * 6),
            })

        related_labels = []
        related_concepts = []
        for link_title, label in extract_links(related_body):
            if ':' in link_title and not link_title.startswith('Risale:'):
                continue
            cleaned_label = normalize_text(label.replace('_', ' '))
            related_key = concept_key(cleaned_label)
            if cleaned_label and cleaned_label not in related_labels:
                related_labels.append(cleaned_label)
            if related_key and related_key != key and related_key not in related_concepts:
                related_concepts.append(related_key)

        aliases = [display.lower()]

        concepts[key] = {
            'display': display,
            'aliases': aliases,
            'related_labels': related_labels,
            'related_concepts': related_concepts,
            'ranked_references': ranked_references,
            'category_hint': 'Mefhum',
        }

        for alias in aliases:
            alias_to_concepts[alias].add(key)

    return {
        'meta': {
            'source': 'Nurpedia Mefhum',
            'category_url': MEFHUM_CATEGORY_URL,
            'concept_count': len(concepts),
            'fetched_count': len(concept_paths),
        },
        'alias_to_concepts': {alias: sorted(values) for alias, values in sorted(alias_to_concepts.items()) if values},
        'concepts': concepts,
    }


def main():
    parser = argparse.ArgumentParser(description='Build Nurpedia concept index from Kategori:Mefhum.')
    parser.add_argument('--output', default=str(DEFAULT_OUTPUT), help='Output JSON path')
    parser.add_argument('--cache-dir', default=str(DEFAULT_CACHE_DIR), help='Cache directory for downloaded wiki text')
    parser.add_argument('--limit', type=int, default=0, help='Optional max concept page count')
    parser.add_argument('--sleep', type=float, default=0.2, help='Delay between Nurpedia requests in seconds')
    args = parser.parse_args()

    output_path = pathlib.Path(args.output)
    cache_dir = pathlib.Path(args.cache_dir)
    payload = build_index(limit=args.limit or None, sleep_seconds=args.sleep, cache_dir=cache_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f'Nurpedia index written: {output_path}')
    print(f"Concept count: {payload['meta']['concept_count']}")
    print(f"Fetched count: {payload['meta']['fetched_count']}")


if __name__ == '__main__':
    main()