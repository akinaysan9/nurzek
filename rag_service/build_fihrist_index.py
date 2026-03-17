#!/usr/bin/env python3
import argparse
import html
import json
import pathlib
import re
from collections import Counter, defaultdict


DEFAULT_SOURCE_NAME = "Fihrist (Envar Neşriyat, Baskı: 2006)"
SUPPORTED_EXTENSIONS = {'.html', '.htm', '.txt', '.md'}
BOOK_ALIASES = {
    'soz': 'Sözler',
    'sozler': 'Sözler',
    'mektub': 'Mektubat',
    'mektubat': 'Mektubat',
    'lema': "Lem'alar",
    'lemalar': "Lem'alar",
    'sua': 'Şualar',
    'sualar': 'Şualar',
    'mesnevi': 'Mesnevi-i Nuriye',
    'mesnevi-i nuriye': 'Mesnevi-i Nuriye',
    'isaratul icaz': "İşaratü'l-İ'caz",
    'isaratul-i-caz': "İşaratü'l-İ'caz",
    'muhakemat': 'Muhakemat',
    'munazarat': 'Münazarat',
    'hutbe-i samiye': 'Hutbe-i Şamiye',
    'tarihce': 'Tarihçe-i Hayat',
    'barla l': 'Barla Lahikası',
    'kastamonu l': 'Kastamonu Lahikası',
    'emirdag l': 'Emirdağ Lahikası',
    'asa-yi musa': 'Asâ-yı Musa',
}

NUMBERED_SECTION_RE = re.compile(
    r"(?P<number>\d{1,2}(?:/\d{1,2})?)\.?\s*(?P<book>Söz|Sözler|Mektub|Mektubat|Lem['’]?a|Lem['’]?alar|Şua|Şualar)",
    re.IGNORECASE,
)
NAMED_BOOK_RE = re.compile(
    r"(?P<book>Mesnev[îi]|İşarat-?ül İ['’]?caz|Muhakemat|Münazarat|Hutbe-i Şamiye|Tarihçe(?:-i)? Hayat|Barla\s*L\.?|Kastamonu\s*L\.?|Emirdağ\s*L\.?|Asa-yi Musa|Asâ-yı Musa)",
    re.IGNORECASE,
)


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
    cleaned = normalize_text(text).strip('* ')
    return slugify(cleaned.replace("'", ' '))


def html_to_text(raw_text: str) -> str:
    text = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', raw_text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</(p|div|li|h1|h2|h3|h4|article|section)>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    text = text.replace('\r', '\n')
    return text


def read_source_text(path: pathlib.Path) -> str:
    raw = path.read_text(encoding='utf-8', errors='ignore')
    if path.suffix.lower() in {'.html', '.htm'}:
        return html_to_text(raw)
    return raw


def iter_source_files(input_path: pathlib.Path):
    if input_path.is_file():
        if input_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield input_path
        return

    for path in sorted(input_path.rglob('*')):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield path


def normalize_reference_book(book_token: str) -> str:
    token = slugify(book_token).replace('-', ' ')
    return BOOK_ALIASES.get(token, normalize_text(book_token))


def normalize_numbered_section(number: str, book_token: str) -> tuple[str, str]:
    base_book = normalize_reference_book(book_token)
    normalized_book_token = normalize_text(book_token).lower()
    if 'soz' in slugify(normalized_book_token):
        section = f"{number}. Söz"
    elif 'mektub' in slugify(normalized_book_token):
        section = f"{number}. Mektub"
    elif 'lem' in slugify(normalized_book_token):
        section = f"{number}. Lem'a"
    else:
        section = f"{number}. Şua"
    return base_book, section


def parse_cross_references(line: str) -> list[str]:
    refs = []
    for item in re.findall(r'\(([^)]+)\)', line):
        cleaned = normalize_text(item)
        if cleaned and 'sıra no' not in cleaned.lower() and cleaned.lower() not in {'a.s', 'a.s.m', 'c.c'}:
            refs.append(cleaned)
    return refs


def parse_references(line: str) -> list[dict]:
    references = []

    for match in NUMBERED_SECTION_RE.finditer(line):
        book, section = normalize_numbered_section(match.group('number'), match.group('book'))
        references.append({
            'book': book,
            'section': section,
            'raw': normalize_text(match.group(0)),
        })

    for match in NAMED_BOOK_RE.finditer(line):
        raw_book = normalize_text(match.group('book'))
        references.append({
            'book': normalize_reference_book(raw_book),
            'section': normalize_reference_book(raw_book),
            'raw': raw_book,
        })

    deduped = []
    seen = set()
    for ref in references:
        key = (ref['book'], ref['section'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(ref)
    return deduped


def is_concept_heading(line: str) -> bool:
    stripped = normalize_text(line).strip('* ')
    if not stripped or len(stripped) > 90:
        return False
    if re.search(r'\d', stripped):
        return False

    letters = [char for char in stripped if char.isalpha()]
    if len(letters) < 2:
        return False

    uppercase_letters = sum(1 for char in letters if char.isupper())
    return (uppercase_letters / len(letters)) >= 0.6


def split_lines(text: str) -> list[str]:
    lines = []
    for raw_line in text.split('\n'):
        line = normalize_text(raw_line)
        if not line:
            continue
        if line in {'A', 'B', 'C - Ç', 'D', 'E', 'F', 'G', 'H', 'I - İ', 'K', 'L', 'M', 'N', 'O - Ö', 'P', 'R', 'S - Ş', 'T', 'U - Ü', 'V', 'Y', 'Z'}:
            continue
        lines.append(line)
    return lines


def build_index(input_path: pathlib.Path, source_name: str) -> dict:
    concepts = {}
    alias_to_concepts = defaultdict(set)
    current_key = None
    current_topic = ''

    for source_file in iter_source_files(input_path):
        for line in split_lines(read_source_text(source_file)):
            if is_concept_heading(line):
                display = normalize_text(line).strip('* ')
                current_key = concept_key(display)
                current_topic = ''
                if not current_key:
                    continue
                concepts.setdefault(current_key, {
                    'display': display,
                    'aliases': [display.lower()],
                    'cross_references': [],
                    'topics': [],
                    'references': [],
                })
                alias_to_concepts[display.lower()].add(current_key)
                continue

            if not current_key:
                continue

            if line.startswith('('):
                for cross_ref in parse_cross_references(line):
                    cross_ref_key = concept_key(cross_ref)
                    concepts[current_key]['cross_references'].append(cross_ref)
                    alias_to_concepts[cross_ref.lower()].add(cross_ref_key or current_key)
                continue

            if re.match(r'^\d+(?:/\d+)?\s*[-–]', line):
                current_topic = line
                concepts[current_key]['topics'].append({
                    'label': line,
                    'references': [],
                })
                continue

            references = parse_references(line)
            if not references:
                continue

            topic_list = concepts[current_key]['topics']
            if current_topic and topic_list:
                topic_list[-1]['references'].extend(references)
            for ref in references:
                concepts[current_key]['references'].append({
                    'book': ref['book'],
                    'section': ref['section'],
                    'raw': ref['raw'],
                    'topic': current_topic,
                })

    finalized = {}
    for key, concept in concepts.items():
        reference_counter = Counter((ref['book'], ref['section']) for ref in concept['references'])
        ranked_references = []
        for (book, section), count in reference_counter.most_common(8):
            score = float(count * 6)
            if section == book:
                score -= 2.0
            ranked_references.append({
                'book': book,
                'section': section,
                'count': count,
                'score': score,
            })

        cross_refs = []
        for cross_ref in concept['cross_references']:
            normalized_cross_ref = normalize_text(cross_ref)
            if normalized_cross_ref and normalized_cross_ref not in cross_refs:
                cross_refs.append(normalized_cross_ref)

        related_concepts = []
        for cross_ref in cross_refs:
            related_key = concept_key(cross_ref)
            if related_key and related_key in concepts and related_key != key and related_key not in related_concepts:
                related_concepts.append(related_key)

        aliases = []
        for alias in concept['aliases'] + cross_refs:
            normalized_alias = normalize_text(alias).lower()
            if normalized_alias and normalized_alias not in aliases:
                aliases.append(normalized_alias)

        finalized[key] = {
            'display': concept['display'],
            'aliases': aliases,
            'cross_references': cross_refs,
            'related_concepts': related_concepts,
            'ranked_references': ranked_references,
            'topics': concept['topics'],
        }

        for alias in aliases:
            alias_to_concepts[alias].add(key)

    return {
        'meta': {
            'source': source_name,
            'input_path': str(input_path),
            'concept_count': len(finalized),
        },
        'alias_to_concepts': {alias: sorted(values) for alias, values in sorted(alias_to_concepts.items()) if values},
        'concepts': finalized,
    }


def main():
    parser = argparse.ArgumentParser(description='Build fihrist index JSON from local HTML/TXT exports.')
    parser.add_argument('--input', required=True, help='Fihrist export directory or file path')
    parser.add_argument('--output', default=str(pathlib.Path(__file__).with_name('fihrist_index.json')), help='Output JSON path')
    parser.add_argument('--source-name', default=DEFAULT_SOURCE_NAME, help='Human-readable source label')
    args = parser.parse_args()

    input_path = pathlib.Path(args.input)
    if not input_path.exists():
        raise SystemExit(f'Input path not found: {input_path}')

    payload = build_index(input_path, args.source_name)
    output_path = pathlib.Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f"Fihrist index written: {output_path}")
    print(f"Concept count: {payload['meta']['concept_count']}")


if __name__ == '__main__':
    main()