import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from import_local_audio import find_ffmpeg


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = 'https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/deploy/bopomofo_materials_20170213.zip'
SYLLABLES = 'https://raw.githubusercontent.com/hugolpz/audio-cmn/f759a0f18f27690742957619e1248ed91e9b3f2c/64k/syllabs'


def download(url):
    with urllib.request.urlopen(url, timeout=25) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description='Import the open Mandarin recordings used by the pinyin lessons.')
    parser.add_argument('--archive', type=Path, help='Use a local copy of the Bopomofo source ZIP.')
    parser.add_argument('--ffmpeg')
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    rows = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import './pinyin-content.js'; console.log(JSON.stringify(globalThis.pinyinLessons));",
    ], cwd=ROOT, encoding='utf-8'))
    clip_ids = sorted({row[field] for row in rows for field in ('demoClip', 'exampleClip')})
    target = ROOT / 'audio' / 'pinyin'
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary)
        archive = args.archive or staging / 'bopomofo.zip'
        if not args.archive:
            archive.write_bytes(download(ARCHIVE))

        def import_clip(clip_id):
            output = staging / f'{clip_id}.mp3'
            metadata = {}
            if clip_id.startswith('bop-'):
                source_name = f"audio/F{int(clip_id.split('-')[1])}.WAV"
                with zipfile.ZipFile(archive) as source_zip:
                    wav = source_zip.read(source_name)
                subprocess.run([
                    ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1',
                    '-ar', '44100', '-b:a', '64k', str(output),
                ], input=wav, check=True)
            elif clip_id == 'final-ong':
                source_name = 'cmn-song1.mp3'
                start, end = 0.53, 0.93
                subprocess.run([
                    ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-map_metadata', '-1',
                    '-af', f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,adelay=80,apad=pad_dur=0.10',
                    '-ac', '1', '-ar', '44100', '-b:a', '64k', str(output),
                ], input=download(f'{SYLLABLES}/{source_name}'), check=True)
                metadata['trimSeconds'] = [start, end]
            else:
                source_name = f'cmn-{clip_id}.mp3'
                output.write_bytes(download(f'{SYLLABLES}/{source_name}'))
            return clip_id, {'sourceFile': source_name, **metadata, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            clips = dict(pool.map(import_clip, clip_ids))
        target.mkdir(parents=True, exist_ok=True)
        for clip_id in clips:
            (target / f'{clip_id}.mp3').write_bytes((staging / f'{clip_id}.mp3').read_bytes())
        manifest = {'bopomofoSource': ARCHIVE, 'syllableSource': SYLLABLES, 'clips': clips}
        (target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(clips)} pinyin recordings.')


if __name__ == '__main__':
    main()
