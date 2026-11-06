"""Extract audio from compatible .apkg exports into a separate review folder.

Only Python standard libraries are needed. Modern compressed Anki exports should
be re-exported with 'Include media' and 'Support older Anki versions' enabled.
This tool does not copy unreviewed materials into the publishable site.
"""
import argparse
import csv
import hashlib
import html
import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path

EXTENSIONS = {'.mp3', '.wav', '.m4a', '.ogg'}


def extract(package, output):
    output.mkdir(parents=True, exist_ok=False)
    inventory = []
    notes = []
    with zipfile.ZipFile(package) as archive:
        try:
            media = json.loads(archive.read('media').decode('utf-8'))
            if not isinstance(media, dict):
                raise ValueError('Unexpected media manifest format')
        except (UnicodeError, json.JSONDecodeError, KeyError) as error:
            raise ValueError("Please export again with 'Include media' and 'Support older Anki versions' enabled.") from error
        for archive_name, original_name in media.items():
            extension = Path(str(original_name)).suffix.lower()
            if extension not in EXTENSIONS:
                continue
            info = archive.getinfo(archive_name)
            if info.file_size > 50 * 1024 * 1024:
                raise ValueError(f'Audio exceeds the 50 MB per-file limit: {original_name}')
            data = archive.read(archive_name)
            digest = hashlib.sha256(data).hexdigest()
            filename = digest + extension
            (output / filename).write_bytes(data)
            inventory.append({'original_name': original_name, 'extracted_name': filename,
                              'sha256': digest, 'bytes': len(data)})
        db_name = next((name for name in ('collection.anki21', 'collection.anki2') if name in archive.namelist()), None)
        if db_name:
            database = archive.read(db_name)
            if database.startswith(b'SQLite format 3\x00'):
                with tempfile.TemporaryDirectory() as directory:
                    db_path = Path(directory) / 'collection.db'
                    db_path.write_bytes(database)
                    connection = sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True)
                    try:
                        for note_id, fields in connection.execute('SELECT id, flds FROM notes'):
                            sounds = re.findall(r'\[sound:([^\]]+)\]', fields)
                            if not sounds:
                                continue
                            clean = re.sub(r'\[sound:[^\]]+\]', '', fields.replace('\x1f', ' | '))
                            clean = html.unescape(re.sub(r'<[^>]*>', '', clean))
                            notes.append({'note_id': note_id, 'text': clean, 'sounds': ' | '.join(sounds)})
                    finally:
                        connection.close()
    for filename, rows, columns in [('inventory.csv', inventory, ['original_name', 'extracted_name', 'sha256', 'bytes']),
                                    ('notes.csv', notes, ['note_id', 'text', 'sounds'])]:
        with (output / filename).open('w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)
    (output / 'review.json').write_text(json.dumps({
        'package': package.name, 'audio_count': len(inventory),
        'status': 'Pending license, pronunciation and accent review. Not yet installed in app.'
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Extracted {len(inventory)} audio files and {len(notes)} note references into {output}')
    print('Review inventory.csv and notes.csv; check usage rights and pronunciation before publishing.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--output', type=Path, required=True, help='New review folder OUTSIDE the web project')
    args = parser.parse_args()
    web_root = Path(__file__).resolve().parents[1]
    destination = args.output.resolve()
    if destination.is_relative_to(web_root):
        parser.error('Choose a review folder outside the web project, to avoid publishing unreviewed files.')
    try:
        extract(args.package, destination)
    except (ValueError, OSError, zipfile.BadZipFile, KeyError, sqlite3.Error) as error:
        parser.exit(1, f'Cannot extract: {error}\n')


if __name__ == '__main__':
    main()
