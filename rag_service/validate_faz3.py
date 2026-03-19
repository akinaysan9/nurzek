import app
import sys


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def compose_chunks(question: str):
    ordered_chunks, relevant, stage = app.retrieve_relevant_chunks(question)
    ordered_chunks = app.dedupe_chunks(ordered_chunks or [])

    selected_main = [chunk for chunk in ordered_chunks if str(chunk.get('_channel') or 'main') != 'bridge']
    selected_bridge = [chunk for chunk in ordered_chunks if str(chunk.get('_channel') or '') == 'bridge']

    context = app.build_context(ordered_chunks)
    distinct_sources = len({app.get_chunk_canonical_slug(c) for c in ordered_chunks})

    return {
        'stage': stage,
        'relevant': relevant,
        'selected_main': selected_main,
        'selected_bridge': selected_bridge,
        'ordered': ordered_chunks,
        'context': context,
        'distinct_sources': distinct_sources,
    }


def run_phase3_validation():
    print('=== FAZ 3 VALIDATION START ===')
    app.startup_event()

    queries = [
        'Ihlas Risalesinin dort dusturu nelerdir?',
        'Hasir nedir?',
        'Ene nedir?',
        'Kader nedir?',
    ]

    for question in queries:
        print('\n' + '=' * 80)
        print('Soru:', question)
        for run in range(1, 4):
            result = compose_chunks(question)
            bridge_terms = [str(c.get('_concept_bridge_term') or '') for c in result['selected_bridge']]

            print(f'  Run {run}: stage={result["stage"]}, relevant={result["relevant"]}')
            print(
                f'    main={len(result["selected_main"])}, '
                f'bridge={len(result["selected_bridge"])}, '
                f'total={len(result["ordered"])}, '
                f'distinct_sources={result["distinct_sources"]}'
            )
            print(f'    context_has_ana={"ANA KAYNAK" in result["context"]}, context_has_kopru={"KAVRAMSAL KOPRU" in result["context"]}')
            if bridge_terms:
                print(f'    bridge_terms={bridge_terms[:3]}')

    print('\n=== FAZ 3 VALIDATION END ===')


if __name__ == '__main__':
    run_phase3_validation()
