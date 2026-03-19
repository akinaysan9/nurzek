import os, sys, pickle, logging
logging.disable(logging.CRITICAL)
BASE = os.path.dirname(os.path.abspath(__file__))
rag_dir = os.path.join(BASE, 'rag_service')
sys.path.insert(0, rag_dir)
os.chdir(rag_dir)

with open('risale_metadata.pkl', 'rb') as f:
    chunks = pickle.load(f)

target = 'yirmi-birinci-lema'
ybr = [c for c in chunks if target in str(c.get('metadata', {}).get('risale_canonical_slug') or c.get('metadata', {}).get('risale_slug', ''))]
print(f'yirmi-birinci-lema chunks in index: {len(ybr)}')
for c in ybr[:5]:
    text = c.get('text', '')[:200].replace('\n', ' ')
    slug = c.get('metadata', {}).get('risale_canonical_slug', '')
    has_d = 'dustur' in text.lower() or 'dusturu' in text.lower()
    print(f'  slug={slug} has_dustur={has_d} | {text[:130]}')

print()
for slug in ['birinci-sua', 'emirdag-hayati', 'otuzuncu-soz', 'yirmi-birinci-lema']:
    n = sum(1 for c in chunks if slug in str(c.get('metadata', {}).get('risale_canonical_slug') or c.get('metadata', {}).get('risale_slug', '')))
    dustur_n = sum(1 for c in chunks
                   if slug in str(c.get('metadata', {}).get('risale_canonical_slug') or '')
                   and ('dustur' in c.get('text', '').lower() or 'düstur' in c.get('text', '').lower()))
    print(f'  {slug}: {n} chunks total, {dustur_n} with dustur/düstur')
