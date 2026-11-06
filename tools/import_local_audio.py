"""Import supplied audio and transcode disguised AAC files to real MP3.

Usage: python tools/import_local_audio.py [--ffmpeg PATH]
Source directories are read-only. Requires FFmpeg, or installed imageio-ffmpeg.
"""
import argparse
import concurrent.futures
import csv
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = 'supplied-phonetic-symbol-web'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def find_ffmpeg(explicit):
    if explicit:
        return explicit
    executable = shutil.which('ffmpeg')
    if executable:
        return executable
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise SystemExit('FFmpeg required: pass --ffmpeg with its executable path.') from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg')
    parser.add_argument('--upstream', type=Path, default=ROOT.parent / 'phonetic_symbol_web-main')
    parser.add_argument('--voices', type=Path, help='Defaults to upstream project words-voice directory')
    parser.add_argument('--reference', type=Path, default=ROOT.parent / 'english-ipa-main')
    args = parser.parse_args()
    voices = args.voices or args.upstream / 'words-voice'
    source_map_file = args.upstream / 'phonetic_words.json'
    source_map = json.loads(source_map_file.read_text(encoding='utf-8'))
    token_lessons = {token: lesson for lesson, items in source_map.items() for token in items if '_' in token}
    ffmpeg = find_ffmpeg(args.ffmpeg)
    output = subprocess.run(['node', '--input-type=module', '-e',
                             "import {phonemes} from './content.js'; console.log(JSON.stringify(phonemes));"],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    phonemes = json.loads(output.stdout)
    files = list(voices.glob('*.mp3'))
    by_word = {path.stem.removeprefix('word-').lower(): path for path in files if '_' not in path.stem}
    by_hash = {}
    for path in files:
        by_hash.setdefault(sha256(path), []).append(path)
    selected = {}
    required = {}
    lessons = []
    for phoneme in phonemes:
        original = args.reference / 'public/audio' / (phoneme['sourcePhonemeId'] + '.mp3')
        matches = by_hash.get(sha256(original), [])
        if not matches:
            raise SystemExit(f'No matching phoneme recording for {phoneme["id"]}')
        source_audio = next((path for path in matches if path.stem.removeprefix('word-') in token_lessons), None)
        if not source_audio:
            raise SystemExit(f'No upstream lesson for phoneme: {phoneme["id"]}')
        selected[phoneme['id']] = source_audio
        lesson_id = token_lessons[source_audio.stem.removeprefix('word-')]
        source_examples = [word for word in source_map[lesson_id] if '_' not in word]
        lessons.append({'id': phoneme['id'], 'ipa': phoneme['ipa'], 'sourceLessonId': lesson_id,
                        'sourceExamples': source_examples, 'selectedExamples': [word['word'] for word in phoneme['words']]})
        required[phoneme['id']] = ('phoneme', '/' + phoneme['ipa'] + '/', phoneme['kind'])
        for word in phoneme['words']:
            path = by_word.get(word['word'].lower())
            if not path:
                raise SystemExit(f'Missing actual word recording: {word["word"]}')
            selected[word['id']] = path
            required[word['id']] = ('word', word['word'], word['meaning'])
    destination = ROOT / 'audio/files'
    destination.mkdir(exist_ok=True)

    def convert(item):
        clip_id, source = item
        target = destination / (clip_id + '.mp3')
        temporary = destination / (clip_id + '.tmp.mp3')
        command = [ffmpeg, '-v', 'error', '-nostdin', '-y', '-i', str(source),
                   '-map', '0:a:0', '-map_metadata', '-1', '-ac', '1', '-ar', '44100',
                   '-c:a', 'libmp3lame', '-b:a', '96k', str(temporary)]
        subprocess.run(command, capture_output=True, text=True, check=True)
        if temporary.stat().st_size == 0:
            raise RuntimeError(f'Empty converted audio: {clip_id}')
        temporary.replace(target)
        return clip_id, {
            'path': 'audio/files/' + target.name, 'sourceId': SOURCE_ID,
            'sourceFile': source.name, 'sourceSha256': sha256(source),
            'sha256': sha256(target), 'bytes': target.stat().st_size,
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        converted = dict(executor.map(convert, selected.items()))
    old_manifest = json.loads((ROOT / 'audio/manifest.json').read_text(encoding='utf-8'))
    manifest = {
        'version': str(int(old_manifest.get('version', '1')) + 1),
        'accent': 'Traditional British teaching inventory; supplied recordings, accent listening review pending',
        'sources': [{
            'id': SOURCE_ID, 'name': '用户提供的 phonetic_symbol_web-main / words-voice',
            'url': 'https://github.com/boommanpro/phonetic_symbol_web/tree/main/words-voice',
            'originalSite': 'https://www.yyybabc.com/',
            'license': '用户确认可用于本项目本地/家庭学习；原参考项目注明仅供学习。未据此认定具备公开再分发授权。',
        }],
        'clips': converted,
    }
    (ROOT / 'audio/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (ROOT / 'audio/required-clips.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['clip_id', 'type', 'text', 'meaning_or_group', 'path', 'source_file'])
        for clip_id, (kind, text, meaning) in required.items():
            writer.writerow([clip_id, kind, text, meaning, converted[clip_id]['path'], converted[clip_id]['sourceFile']])
    report = {
        'referenceProject': 'english-ipa-main', 'referenceData': 'src/data/phoneticSymbols.ts',
        'upstreamProject': 'phonetic_symbol_web-main', 'upstreamExampleMap': 'phonetic_words.json',
        'upstreamMapSha256': sha256(source_map_file),
        'phonemes': len(phonemes), 'words': len(converted) - len(phonemes),
        'totalClips': len(converted), 'totalBytes': sum(clip['bytes'] for clip in converted.values()),
        'matching': 'Phonemes matched by SHA-256 to reference recordings; words matched by filename, case insensitive.',
        'encoding': 'Decoded from supplied audio, re-encoded as MPEG Layer III, 44.1 kHz mono, 96 kbps.',
        'review': 'Mapping and encoding checked. Word identity/accent listening and mobile-device acceptance remain pending.',
    }
    (ROOT / 'audio/import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'audio/lesson-mapping.json').write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    notices = ('Third-party reference: phonetic_symbol_web by boommanpro\n'
               'https://github.com/boommanpro/phonetic_symbol_web\n'
               'Audio/lesson data adapted for local and family learning. Original site: https://www.yyybabc.com/\n'
               'The upstream README separately credits audio content to the original site.\n\n'
               + (args.upstream / 'LICENSE').read_text(encoding='utf-8'))
    (ROOT / 'THIRD_PARTY_NOTICES.txt').write_text(notices, encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
