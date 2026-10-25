"""Load user-provided workbook locally on the server without bypassing web authentication."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'services' / 'analytics'))
os.environ.setdefault('DATA_DIR', str(root / 'data' / 'analytics'))
from main import load_facts

if __name__ == '__main__':
    source = Path(sys.argv[1])
    result = load_facts(source.read_bytes(), source.name)
    print({key: value for key, value in result.items() if key != 'message'})
