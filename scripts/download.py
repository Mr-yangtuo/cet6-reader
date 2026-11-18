"""Download only the six selected papers and six matching answer PDFs."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
REVISION = '0739f9810cc5884c4b0f7d2804343725296f1e94'
REPO = '0609x/CET46-Resources'

def download(spec):
    date, number, kind = spec
    year, month = date.split('.')
    filename = f'cet6_{year}_{month}_{number}' + ('_ans' if kind == 'answers' else '') + '.pdf'
    source_folder = '答案解析' if kind == 'answers' else '真题PDF'
    folder = '答案' if kind == 'answers' else '原题'
    source = f'六级真题/{date}/{source_folder}/{filename}'
    url = f'https://raw.githubusercontent.com/{REPO}/{REVISION}/' + urllib.parse.quote(source)
    target = ROOT / 'docs' / folder / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        data = urllib.request.urlopen(url, timeout=90).read()
        if not data.startswith(b'%PDF-'):
            raise ValueError(f'Not a PDF: {filename}')
        target.write_bytes(data)
    data = target.read_bytes()
    reader = PdfReader(target)
    item = {
        'id': f'{year}-{month}-{number}-{kind}',
        'exam': date, 'set': number, 'kind': kind,
        'title': f'{year} 年 {int(month)} 月 · 第 {number} 套',
        'file': f'{folder}/{filename}', 'pages': len(reader.pages),
        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'source': f'https://github.com/{REPO}/blob/{REVISION}/' + urllib.parse.quote(source)
    }
    print(f'{folder}/{filename}: {item["pages"]} pages, {len(data)} bytes', flush=True)
    return item

specs = [(date, number, kind) for kind in ['papers', 'answers'] for date in ['2026.06', '2025.12'] for number in [1, 2, 3]]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    items = list(pool.map(download, specs))
(ROOT / 'docs' / 'catalog.json').write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Validated {len(items)} PDF files; total {sum(x["bytes"] for x in items) / 1024 / 1024:.1f} MB.')
