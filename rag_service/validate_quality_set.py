import argparse
import json
import sys
from pathlib import Path

import app


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


DEFAULT_SET_PATH = Path(__file__).with_name('quality_set.json')


def load_quality_set(path: Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        payload = json.load(f)
    if not isinstance(payload, dict) or 'cases' not in payload:
        raise ValueError('quality_set.json format is invalid')
    return payload


def chunk_slug_list(chunks: list) -> list:
    slugs = []
    for chunk in chunks:
        slug = app.get_chunk_canonical_slug(chunk)
        if slug and slug not in slugs:
            slugs.append(slug)
    return slugs


def evaluate_case(case: dict) -> dict:
    question = str(case.get('question') or '').strip()
    result = {
        'id': case.get('id') or 'unknown',
        'question': question,
        'passed': True,
        'errors': [],
        'observed': {},
    }

    if not question:
        result['passed'] = False
        result['errors'].append('question is empty')
        return result

    ordered_chunks, relevant, stage = app.retrieve_relevant_chunks(question)
    ordered_chunks = app.dedupe_chunks(ordered_chunks or [])

    selected_main = [chunk for chunk in ordered_chunks if str(chunk.get('_channel') or 'main') != 'bridge']
    selected_bridge = [chunk for chunk in ordered_chunks if str(chunk.get('_channel') or '') == 'bridge']

    main_slugs = chunk_slug_list(selected_main)
    bridge_slugs = chunk_slug_list(selected_bridge)
    all_slugs = chunk_slug_list(ordered_chunks)

    profile = app.get_query_anchor_profile(question)
    primary_slug = str(profile.get('primary_slug') or '')

    expected_primary = str(case.get('expected_primary_slug') or '').strip()
    if expected_primary and primary_slug != expected_primary:
        result['passed'] = False
        result['errors'].append(f'primary_slug expected={expected_primary} observed={primary_slug or "<empty>"}')

    must_main = [str(s) for s in case.get('must_include_main_slugs', []) if str(s).strip()]
    for required in must_main:
        if required not in main_slugs:
            result['passed'] = False
            result['errors'].append(f'missing main slug: {required}')

    must_any = [str(s) for s in case.get('must_include_any_slugs', []) if str(s).strip()]
    if must_any and not any(required in all_slugs for required in must_any):
        result['passed'] = False
        result['errors'].append(f'missing any slug from: {must_any}')

    min_main = int(case.get('min_main', 0) or 0)
    if len(selected_main) < min_main:
        result['passed'] = False
        result['errors'].append(f'main chunk count too low: {len(selected_main)} < {min_main}')

    min_bridge = int(case.get('min_bridge', 0) or 0)
    if len(selected_bridge) < min_bridge:
        result['passed'] = False
        result['errors'].append(f'bridge chunk count too low: {len(selected_bridge)} < {min_bridge}')

    if bool(case.get('require_bridge_or_secondary', False)):
        secondary_signal = len(bridge_slugs) > 0 or len(set(all_slugs)) > 1
        if not secondary_signal:
            result['passed'] = False
            result['errors'].append('no bridge and no secondary source signal')

    result['observed'] = {
        'stage': stage,
        'relevant': bool(relevant),
        'primary_slug': primary_slug,
        'main_count': len(selected_main),
        'bridge_count': len(selected_bridge),
        'main_slugs': main_slugs,
        'bridge_slugs': bridge_slugs,
    }
    return result


def run_validation(set_path: Path, max_cases: int = 0) -> int:
    payload = load_quality_set(set_path)
    cases = payload.get('cases', [])
    if max_cases > 0:
        cases = cases[:max_cases]

    print('=== QUALITY SET VALIDATION START ===')
    print(f'set={set_path.name} total_cases={len(cases)}')

    app.startup_event()

    reports = []
    for index, case in enumerate(cases, start=1):
        report = evaluate_case(case)
        reports.append(report)

        status = 'PASS' if report['passed'] else 'FAIL'
        print('\n' + '-' * 80)
        print(f'[{index:02d}] {status} | {report["id"]}')
        print(f'Q: {report["question"]}')
        observed = report['observed']
        if observed:
            print(
                f'   stage={observed.get("stage")} relevant={observed.get("relevant")} '
                f'main={observed.get("main_count")} bridge={observed.get("bridge_count")} '
                f'primary={observed.get("primary_slug") or "<empty>"}'
            )
            print(f'   main_slugs={observed.get("main_slugs", [])[:4]}')
            print(f'   bridge_slugs={observed.get("bridge_slugs", [])[:4]}')

        if report['errors']:
            for err in report['errors']:
                print(f'   error: {err}')

    total = len(reports)
    failed = sum(1 for item in reports if not item['passed'])
    passed = total - failed
    score = (passed / total * 100.0) if total else 0.0

    print('\n' + '=' * 80)
    print(f'SUMMARY: passed={passed} failed={failed} total={total} score={score:.1f}%')
    print('=== QUALITY SET VALIDATION END ===')

    return 1 if failed > 0 else 0


def main():
    parser = argparse.ArgumentParser(description='Run retrieval quality set validation for Faz3/GraphRAG.')
    parser.add_argument('--set', dest='set_path', default=str(DEFAULT_SET_PATH), help='Path to quality set JSON file')
    parser.add_argument('--max-cases', type=int, default=0, help='Optional max case count to run')
    args = parser.parse_args()

    exit_code = run_validation(Path(args.set_path), max_cases=args.max_cases)
    raise SystemExit(exit_code)


if __name__ == '__main__':
    main()