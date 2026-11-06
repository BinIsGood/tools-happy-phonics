import importlib.util
import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'tools/extract_anki_audio.py'
spec = importlib.util.spec_from_file_location('anki_audio', MODULE)
anki_audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(anki_audio)


class AnkiExtractionTest(unittest.TestCase):
    def test_exports_media_and_corresponding_note_text(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / 'notes.db'
            connection = sqlite3.connect(database)
            connection.execute('CREATE TABLE notes (id INTEGER, flds TEXT)')
            connection.execute('INSERT INTO notes VALUES (?, ?)', (1, 'cat\x1f猫 [sound:cat.mp3]'))
            connection.commit()
            connection.close()
            package = root / 'deck.apkg'
            with zipfile.ZipFile(package, 'w') as archive:
                archive.writestr('media', json.dumps({'0': 'cat.mp3', '1': 'image.png'}))
                archive.writestr('0', b'ID3-test-fixture-only')
                archive.writestr('1', b'not-an-audio-file')
                archive.writestr('collection.anki2', database.read_bytes())
            output = root / 'review'
            anki_audio.extract(package, output)
            self.assertEqual(len(list(output.glob('*.mp3'))), 1)
            self.assertFalse(list(output.glob('*.png')))
            notes = (output / 'notes.csv').read_text(encoding='utf-8-sig')
            self.assertIn('cat', notes)
            self.assertIn('猫', notes)
            self.assertIn('cat.mp3', notes)

    def test_original_media_paths_cannot_escape_review_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'deck.apkg'
            with zipfile.ZipFile(package, 'w') as archive:
                archive.writestr('media', json.dumps({'0': '../outside.mp3'}))
                archive.writestr('0', b'ID3-test-fixture-only')
            anki_audio.extract(package, root / 'review')
            self.assertFalse((root / 'outside.mp3').exists())
            self.assertEqual(len(list((root / 'review').glob('*.mp3'))), 1)

    def test_compressed_manifest_gives_actionable_export_instruction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'deck.apkg'
            with zipfile.ZipFile(package, 'w') as archive:
                archive.writestr('media', bytes.fromhex('28b52ffd'))
            with self.assertRaisesRegex(ValueError, 'Support older Anki versions'):
                anki_audio.extract(package, root / 'review')

    def test_existing_review_folder_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileExistsError):
                anki_audio.extract(Path(directory) / 'missing.apkg', Path(directory))


if __name__ == '__main__':
    unittest.main()
