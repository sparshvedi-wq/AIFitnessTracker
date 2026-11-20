"""Execute the complete offline notebook in an isolated local Python kernel."""
import json
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
deps = root / 'artifacts' / 'notebook-deps'
sys.path.insert(0, str(deps))
import nbformat
from nbclient import NotebookClient

kernel = root / 'artifacts' / 'jupyter' / 'kernels' / 'tally-eval'
kernel.mkdir(parents=True, exist_ok=True)
(kernel / 'kernel.json').write_text(json.dumps({
    'argv': [sys.executable, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
    'display_name': 'Tally offline evaluation', 'language': 'python',
    'env': {'PYTHONPATH': str(deps)},
}), encoding='utf-8')
os.environ['JUPYTER_PATH'] = str(kernel.parents[1])
path = root / 'docs' / 'evaluations' / 'Tally_Photo_Evaluation.ipynb'
nb = nbformat.read(path, as_version=4)
nbformat.validate(nb)
work = root / 'artifacts' / 'notebook-verification'
work.mkdir(parents=True, exist_ok=True)
NotebookClient(nb, timeout=180, kernel_name='tally-eval', resources={'metadata': {'path': str(work)}}).execute()
nbformat.validate(nb)
assert not any(o.output_type == 'error' for c in nb.cells if c.cell_type == 'code' for o in c.outputs)
nbformat.write(nb, path)
print('PASS: every notebook cell executed; notebook schema and all analytical assertions pass.')
print('Outputs:', work)
