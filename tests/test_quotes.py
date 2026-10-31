import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('fetch_quotes', Path(__file__).resolve().parents[1] / 'scripts/fetch_quotes.py')
quotes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quotes)


class QuoteTests(unittest.TestCase):
    def test_supply_and_measurement_time_have_independent_provenance(self):
        snapshot = {'generated_at': '2026-10-31T01:00:00Z', 'markets': [
            {'id': 'pepecoin-network', 'current_price': .01, 'total_supply': 100, 'market_cap': 1,
             'last_updated': '2026-10-31T00:55:00Z'}]}
        network = {'columns': ['supply_pep', 'time'], 'rows': [[110, 1793354919]]}
        saved = quotes.saved_price(snapshot, network)
        self.assertEqual(saved['supply'], 110)
        self.assertEqual(saved['market_cap'], 1.1)
        self.assertEqual(saved['reported_market_cap'], 1)
        self.assertEqual(saved['updated_at'], '2026-10-31T00:55:00Z')

    def test_partial_provider_failure_keeps_previous_files_and_times(self):
        with tempfile.TemporaryDirectory() as folder:
            docs = Path(folder); (docs / 'data').mkdir()
            previous = '{"generated_at":"2026-10-30T01:00:00Z"}\n'
            file = docs / 'data/market-prices.json'; file.write_text(previous)
            with patch.object(quotes, 'DOCS', docs), patch.object(quotes, 'get', side_effect=[None, []]):
                self.assertEqual(quotes.main(), 0)
            self.assertEqual(file.read_text(), previous)


if __name__ == '__main__':
    unittest.main()
