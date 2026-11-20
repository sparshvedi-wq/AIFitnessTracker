# Photo evaluation notebook

Open `Tally_Photo_Evaluation.ipynb` in [Google Colab](https://colab.research.google.com/):
**File → Upload notebook**, select the file, then **Runtime → Run all**.
Use a CPU runtime; no GPU, credentials or paid model calls are needed.

The notebook is self-contained, including the saved synthetic benchmark data.
`benchmark_snapshot.json` is the same allowlisted data in readable JSON form.
No source photos, user records, API credentials or provider request IDs are included.
Nothing has been uploaded to Google or published to GitHub automatically.

Included analysis:

- Four models, seven synthetic adults, two saved readings per person/model.
- Three eligible positive references, exclusions and planned-trial denominators.
- Clustered-by-person exploratory bootstrap intervals; repeatability is separate from detection.
- Per-region observations and confidence audit with an interactive result inspector.
- Six-condition ablation with controls, reflection tests and failed-call visibility.
- Editable standard short-context price snapshot, cache-aware costs and legacy reconciliation.
- Monthly workload calculator with separate, explicitly unknown quality-check costs.
- CSV and reproducibility manifest export in a ZIP, generated when the notebook runs.

The old OpenAI cost formula treated saved cache writes as ordinary input. The new
report preserves the old formula alongside corrected accounting; absent lifetime
details use short writes with a separate long-write sensitivity estimate.
Token estimates are not invoices. A failed call with no saved usage has unknown cost.

Original benchmark records were read from the preserved legacy repository, without
modifying it. Only three specifically named synthetic experiment JSON files were
used. The 56 four-model readings are distinct from the 74 ablation attempts (73
completed). Initial Claude schema setup rejections are not completed readings and
their unrecorded billing is outside the known-usage subtotal.

The reference labels are AI visual reviews of generated adults, not independently
measured muscle differences. Results do not establish real-world physique accuracy.
The production photo-analysis prompt is different and was not tested by these runs.

Official price sources (checked October 27, 2026):

- [OpenAI standard API pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI cache read/write accounting](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)

To rebuild the notebook from the saved original results:

```powershell
python scripts/build-photo-evaluation-notebook.py --source-root N:\Workspaces\AIFitnessTracker
```

This overwrites the notebook's rendered outputs. `scripts/verify-photo-evaluation-notebook.py`
executes every cell locally using notebook tooling installed in ignored
`artifacts/notebook-deps`; application dependencies and source are untouched.
