"""Validate local audio mappings without relying on a running server."""
import json
import hashlib
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]


def has_mp3_frame(data):
    """Check MPEG Layer III sync/header; AAC ADTS has invalid MPEG layer bits."""
    for offset in range(min(len(data) - 3, 4096)):
        header = int.from_bytes(data[offset:offset + 4], 'big')
        if (header & 0xFFE00000 == 0xFFE00000 and
                (header >> 19) & 3 != 1 and (header >> 17) & 3 == 1 and
                (header >> 12) & 15 not in (0, 15) and (header >> 10) & 3 != 3):
            return True
    return False


def main():
    result = subprocess.run(
        ['node', '--input-type=module', '-e',
         "import {clipIds} from './content.js'; console.log(JSON.stringify(clipIds));"],
        cwd=ROOT, capture_output=True, text=True, check=True, encoding='utf-8')
    expected = set(json.loads(result.stdout))
    manifest = json.loads((ROOT / 'audio/manifest.json').read_text(encoding='utf-8'))
    sources = {source['id']: source for source in manifest.get('sources', [])}
    errors = []
    for clip_id, clip in manifest.get('clips', {}).items():
        if clip_id not in expected:
            errors.append(f'Unknown clip: {clip_id}')
        parsed = urlparse(clip.get('path', ''))
        path = (ROOT / unquote(parsed.path)).resolve()
        audio_root = (ROOT / 'audio').resolve()
        if parsed.scheme or parsed.netloc or not path.is_relative_to(audio_root) or path.suffix.lower() not in {'.mp3', '.wav', '.m4a', '.ogg'}:
            errors.append(f'Invalid local audio path: {clip_id}')
        elif not path.is_file() or path.stat().st_size == 0:
            errors.append(f'Missing/empty audio file: {clip_id}')
        else:
            data = path.read_bytes()
            if path.suffix.lower() == '.mp3' and not has_mp3_frame(data):
                errors.append(f'File is not MPEG Layer III: {clip_id}')
            if clip.get('sha256') and hashlib.sha256(data).hexdigest() != clip['sha256']:
                errors.append(f'Audio content hash mismatch: {clip_id}')
        source = sources.get(clip.get('sourceId'))
        if not source or not source.get('license') or not source.get('url'):
            errors.append(f'Missing source URL/license: {clip_id}')
    found = len(set(manifest.get('clips', {})) & expected)
    print(f'Audio coverage: {found}/{len(expected)} clips; {len(errors)} mapping errors.')
    if found < len(expected):
        print('INCOMPLETE: audio materials are still pending. No synthetic placeholder audio is included.')
    for error in errors:
        print(f'ERROR: {error}')
    return 1 if errors or ('--require-complete' in sys.argv and found != len(expected)) else 0


if __name__ == '__main__':
    raise SystemExit(main())
