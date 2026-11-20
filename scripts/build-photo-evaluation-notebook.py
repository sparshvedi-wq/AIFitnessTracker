"""Build a self-contained, offline Colab report from saved synthetic evaluations.

Reads only explicitly named benchmark JSON files; never reads credentials/photos.
Run with --source-root pointing at the preserved evaluation repository.
"""
import argparse
import hashlib
import json
from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source-root', type=Path, required=True)
args = parser.parse_args()
source = args.source_root.resolve()
out = ROOT / 'docs' / 'evaluations'
out.mkdir(parents=True, exist_ok=True)
specs = {
    'gpt': 'artifacts/asymmetry-model-comparison/2026-10-16T00-01-42.558Z/results.json',
    'claude': 'artifacts/claude-photo-comparison/2026-10-18T15-10-13.749Z/results.json',
    'ablation': 'artifacts/accuracy-ablation/2026-10-16T00-25-13.193Z/results.json',
}
bundle = {'schema_version': 1, 'created': '2026-10-27', 'scope': 'Saved synthetic-adult photo evaluations only', 'experiments': {}, 'provenance': []}
for name, relative in specs.items():
    raw = (source / relative).read_bytes()
    data = json.loads(raw)
    # Keep reproducibility metadata and synthetic observations, not request IDs,
    # credentials, photos/base64, local absolute paths, or application state.
    allowed = ['at', 'models', 'model', 'reasoningEffort', 'imageDetail', 'repeats', 'effort', 'maxOutputTokens', 'experiment', 'scope', 'comparability', 'referenceHash', 'reference', 'promptHash', 'prompt', 'protocol', 'variants', 'gptBaselineSha256']
    clean = {k: data[k] for k in allowed if k in data}
    clean['results'] = [{k: r[k] for k in ['id', 'model', 'returnedModel', 'repeat', 'reflected', 'variant', 'imageHashes', 'hashes', 'seconds', 'usage', 'estimatedUsd', 'result', 'error'] if k in r} for r in data['results']]
    bundle['experiments'][name] = clean
    bundle['provenance'].append({'experiment': name, 'source_relative_path': relative, 'source_sha256': hashlib.sha256(raw).hexdigest(), 'attempts': len(clean['results'])})

cells = []
def md(s): cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': textwrap.dedent(s).strip()})
def code(s): cells.append({'cell_type': 'code', 'metadata': {}, 'source': textwrap.dedent(s).strip(), 'execution_count': None, 'outputs': []})

md('''
    # Tally · Photo analysis evaluation
    **Protocol v1.0 · Report prepared October 27, 2026 · USD**

    A reproducible comparison of saved model responses, visible-outline detection,
    repeatability, latency, and estimated token costs. Four models, seven synthetic
    adults, two readings per model/person; a separate six-condition ablation adds
    two synthetic controls and reflection checks.

    **Start:** upload this `.ipynb` at [Google Colab](https://colab.research.google.com/)
    → **File → Upload notebook**, then **Runtime → Run all** on a CPU runtime.
    All required benchmark data are embedded. No Drive mount, image upload, API key,
    image generation, or paid API calls are used by any cell.

    **Interpretation:** “verified” below means the original AI reviewer found a
    visible outline difference in a synthetic image. It is **not** independent
    expert ground truth, a muscle measurement, or clinical validation. Only three
    distinct positive people are eligible for detection metrics. Repeats are correlated.
    This experimental ordinal prompt is different from the current app prompt.
''')
md('''
    ## 1 · Evaluation contract

    | Item | Frozen rule |
    |---|---|
    | Unit | One model call reviews front, side and back of one fictional adult. |
    | Primary endpoint | Correct anatomical fuller side on the reference region with assessable=true and apparent difference ≥2. |
    | Denominator | All six planned positive readings per model (three people × two repeats); missing/failed readings do not become successes. |
    | Secondary endpoints | ≥3 detection, wrong-side claims, target abstention, repeat agreement, completion and latency. |
    | Reference exclusions | Four ambiguous/not reliably generated targets remain descriptive; never scored as negatives. |
    | Controls | Only ablation controls, only labeled shoulder/arm/calf regions. No four-model false-positive rate is available. |
    | Scales | Apparent outline difference and subjective confidence are separate ordinal 1–5 scales. Neither is a probability. |
    | Severity accuracy | Not computed: no independent numeric severity labels exist. |
    | Blinding/comparability | Original records report matching normalized image hashes and prompt/reference hashes across providers; provider thinking and schema adapters differ. |
    | Decision use | Exploratory engineering evidence; insufficient to establish real-person physique accuracy or prescribe unilateral training. |

    Cost comparisons use standard short-context rates checked on October 27, 2026:
    [OpenAI pricing](https://developers.openai.com/api/docs/pricing),
    [OpenAI cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching),
    [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
    Rates are editable below. Estimates exclude taxes, regional premiums and other services.
''')
code('''
    import json, math, hashlib, io, zipfile, platform
    from pathlib import Path
    from collections import Counter
    import numpy as np
    import pandas as pd
    import matplotlib.pyplot as plt
    from IPython.display import display, Markdown

    pd.set_option('display.max_columns', 30)
    pd.set_option('display.max_colwidth', 85)
    plt.rcParams.update({'figure.dpi': 120, 'axes.spines.top': False, 'axes.spines.right': False})
    SEED = 20261027
    DETECTION_THRESHOLD = 2  # Keep primary endpoint fixed; explore confidence separately.
    EXPORT_DIR = Path('tally_evaluation_exports')
    print('Offline analysis. No API clients or credentials are needed.')
    print('Python', platform.python_version(), '| pandas', pd.__version__, '| numpy', np.__version__)
''')
code("# Embedded allowlisted benchmark archive; synthetic data only.\nBUNDLE = json.loads(" + repr(json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))) + ")\nE = BUNDLE['experiments']\ndisplay(pd.DataFrame(BUNDLE['provenance']))")
md('''
    ## 2 · Validate provenance and planned coverage
    Hashes describe the original local result files. The embedded archive is an
    allowlisted extract, so its hash is intentionally different. Images themselves
    are not included. Checks below verify the saved cross-model image and prompt
    identity and prevent duplicate trial inflation.
''')
code('''
    REGIONS = ['shoulders', 'arms', 'chest', 'back', 'thighs', 'calves', 'glutes']
    MODELS = E['gpt']['models'] + E['claude']['models']
    references = {r['id']: r for r in E['gpt']['reference']['cases']}
    positives = {k: r for k, r in references.items() if r['eligibility'] == 'verified'}
    assert len(positives) == 3
    assert E['gpt']['promptHash'] == E['claude']['promptHash']
    assert E['gpt']['referenceHash'] == E['claude']['referenceHash']
    assert E['claude']['gptBaselineSha256'] == next(p['source_sha256'] for p in BUNDLE['provenance'] if p['experiment'] == 'gpt')
    baseline_hashes = {r['id']: r['imageHashes'] for r in E['gpt']['results']}
    for experiment, record in E.items():
        keys = [(r['id'], r.get('model', record.get('model')), r.get('variant', 'ordinal'), r['repeat'], r.get('reflected', False)) for r in record['results']]
        assert len(keys) == len(set(keys)), f'Duplicate trials in {experiment}'
        for r in record['results']:
            if experiment in ('gpt', 'claude'):
                assert r['imageHashes'] == baseline_hashes[r['id']]
            if r.get('result'):
                assert set(r['result']['regions']) == set(REGIONS)
                for region in r['result']['regions'].values():
                    assert (region['asymmetry'] in range(1, 6) and region['confidence'] in range(1, 6)) if region['assessable'] else (region['asymmetry'] is None and region['confidence'] is None)
    display(pd.DataFrame(E['gpt']['reference']['cases'])[['id', 'eligibility', 'region', 'largerSide', 'visibleReference']])
    print('PASS: unique trials; identical saved comparison inputs and prompt/reference hashes.')
''')
md('''
    ## 3 · Token accounting and editable price snapshot
    OpenAI input totals include ordinary, cache-read and cache-write tokens;
    Claude reports ordinary input separately from cache reads/writes. Count each
    category once. Output already includes billed reasoning/thinking: do not add it again.

    **Historical correction:** the old comparison formula priced OpenAI cache writes
    as ordinary input. We retain that legacy estimate for reconciliation and show a
    corrected estimate alongside it. Where write-lifetime details were not saved,
    30-minute OpenAI / 5-minute Claude writes are an explicit assumption; a long-write
    sensitivity estimate is also shown. Missing usage is unknown, never a free call.
''')
code('''
    # USD per one million tokens. Edit and rerun subsequent cells when rates change.
    PRICE_AS_OF = '2026-10-27'
    PRICES = {
        'gpt-6.1-sol': dict(input=2.0, output=10.0, read=.10, write_short=2.50, write_long=5.0),
        'gpt-6-luna': dict(input=.10, output=.50, read=.01, write_short=.125, write_long=.25),
        'claude-haiku-5-5': dict(input=.10, output=.50, read=.01, write_short=.125, write_long=.20),
        'claude-sonnet-5-5': dict(input=2.0, output=10.0, read=.10, write_short=2.50, write_long=4.0),
    }
    display(pd.DataFrame(PRICES).T.rename_axis('model'))

    def token_parts(model, usage, assume_long=False):
        if not usage or 'input_tokens' not in usage or 'output_tokens' not in usage:
            return None
        if model.startswith('gpt-'):
            details = usage.get('input_tokens_details', {})
            read, writes = details.get('cached_tokens', 0), details.get('cache_write_tokens', 0)
            split = details.get('cache_write_tokens_details', {})
            long = split.get('ttl_12h_tokens', writes if assume_long else 0)
            short = split.get('ttl_30m_tokens', writes - long)
            ordinary = usage['input_tokens'] - read - writes
        else:
            read, writes = usage.get('cache_read_input_tokens', 0), usage.get('cache_creation_input_tokens', 0)
            split = usage.get('cache_creation', {})
            long = split.get('ephemeral_1h_input_tokens', writes if assume_long else 0)
            short = split.get('ephemeral_5m_input_tokens', writes - long)
            ordinary = usage['input_tokens']
        assert short + long == writes and min(ordinary, read, short, long) >= 0
        return dict(input=ordinary, read=read, write_short=short, write_long=long, output=usage['output_tokens'])

    def cost(model, usage, assume_long=False):
        parts = token_parts(model, usage, assume_long)
        if parts is None or model not in PRICES:
            return np.nan
        return sum(n * PRICES[model][key] for key, n in parts.items()) / 1e6

    def legacy_cost(model, u):
        if not u: return np.nan
        p = PRICES[model]
        cached = u.get('input_tokens_details', {}).get('cached_tokens', 0)
        return ((u['input_tokens'] - cached)*p['input'] + u['output_tokens']*p['output'] + u.get('cache_read_input_tokens', cached)*p['read'] + u.get('cache_creation_input_tokens', 0)*p['write_short'])/1e6

    # Hand-calculated accounting fixtures; these must fail if categories double count.
    assert math.isclose(cost('gpt-6.1-sol', {'input_tokens': 1000, 'input_tokens_details': {'cached_tokens': 200, 'cache_write_tokens': 300}, 'output_tokens': 100}), .00277)
    assert math.isclose(cost('claude-sonnet-5-5', {'input_tokens': 500, 'cache_read_input_tokens': 200, 'cache_creation_input_tokens': 300, 'output_tokens': 100}), .00277)
    assert np.isnan(cost('gpt-6-luna', None))
    assert math.isclose(cost('gpt-6.1-sol', {'input_tokens':1000, 'input_tokens_details':{'cache_write_tokens':1000}, 'output_tokens':0}, True), .005)
    print('PASS: input partitions, output and missing-usage checks.')
''')
code('''
    calls, readings = [], []
    for experiment, record in E.items():
        for r in record['results']:
            model = r.get('model', record.get('model'))
            key = (experiment, model, r['id'], r.get('variant', 'ordinal'), r['repeat'], r.get('reflected', False))
            row = dict(experiment=experiment, model=model, person=r['id'], condition=r.get('variant', 'ordinal'), repeat=r['repeat'], reflected=r.get('reflected', False), completed=bool(r.get('result')), seconds=r.get('seconds', np.nan), estimated_usd=cost(model, r.get('usage')), long_write_usd=cost(model, r.get('usage'), True), legacy_estimate_usd=legacy_cost(model, r.get('usage')), saved_estimate_usd=r.get('estimatedUsd', np.nan), error=(r.get('error') or {}).get('message', ''), trial_key=str(key))
            calls.append(row)
            for region, value in (r.get('result') or {}).get('regions', {}).items():
                readings.append({**row, 'region': region, **value})
    calls = pd.DataFrame(calls)
    readings = pd.DataFrame(readings)
    comparison = calls[calls.experiment.isin(['gpt', 'claude'])].copy()
    regions = readings[readings.experiment.isin(['gpt', 'claude'])].copy()
    coverage = comparison.groupby('model').agg(attempts=('completed','size'), completed=('completed','sum'), people=('person','nunique'), known_usage=('estimated_usd','count'))
    coverage['planned'] = 14
    display(coverage)
    display(calls[~calls.completed][['experiment','person','condition','repeat','reflected','error','estimated_usd']])
    print('Unknown failed-call usage is excluded from cost sums, not assumed $0.')
''')
md('''
    ## 4 · Primary comparison and uncertainty
    Detection is agreement with a synthetic visible-outline reference. Wrong-side,
    uncertainty and missing results count as no detection in the planned denominator.
    The exploratory 95% bootstrap interval resamples **people**, retaining both
    repeats together. With only three positive people these intervals are unstable;
    0/6 can produce a degenerate bootstrap interval and does not prove zero ability.
    No significance claims or winner based on confidence alone.
''')
code('''
    targets = []
    for model in MODELS:
        for person, ref in positives.items():
            for repeat in [1, 2]:
                match = regions[(regions.model == model) & (regions.person == person) & (regions.repeat == repeat) & (regions.region == ref['region'])]
                v = match.iloc[0] if len(match) else None
                assessable = bool(v['assessable']) if v is not None else False
                side = v['fullerSide'] if v is not None else 'missing'
                score = v['asymmetry'] if v is not None else np.nan
                targets.append(dict(model=model, person=person, repeat=repeat, correct=assessable and score>=2 and side==ref['largerSide'], correct_ge3=assessable and score>=3 and side==ref['largerSide'], wrong_side=assessable and score>=2 and side in ['left','right'] and side!=ref['largerSide'], abstain=(v is None or not assessable or side=='uncertain'), confidence=v['confidence'] if v is not None else np.nan, score=score, side=side))
    targets = pd.DataFrame(targets)
    rng = np.random.default_rng(SEED)
    summary = []
    for model in MODELS:
        t = targets[targets.model == model]
        c = comparison[comparison.model == model]
        person_rates = t.groupby('person').correct.mean().to_numpy()
        bootstrap = rng.choice(person_rates, size=(10000,len(person_rates)), replace=True).mean(axis=1)
        pair = regions[regions.model == model].pivot(index=['person','region'], columns='repeat', values=['asymmetry','fullerSide','assessable'])
        stable = ((pair['asymmetry'][1].fillna(-1)==pair['asymmetry'][2].fillna(-1)) & (pair['fullerSide'][1]==pair['fullerSide'][2]) & (pair['assessable'][1]==pair['assessable'][2]))
        summary.append(dict(model=model, detection=f'{t.correct.sum()}/6', detection_rate=t.correct.mean(), ge3=f'{t.correct_ge3.sum()}/6', wrong_side=int(t.wrong_side.sum()), abstentions=int(t.abstain.sum()), people=3, bootstrap_low=np.quantile(bootstrap,.025), bootstrap_high=np.quantile(bootstrap,.975), repeat_agreement=f'{stable.sum()}/{len(stable)}', completion=f'{c.completed.sum()}/14', median_seconds=c.loc[c.completed,'seconds'].median(), mean_usd=c.estimated_usd.mean(), usd_per_1000=c.estimated_usd.mean()*1000, known_cost_total=c.estimated_usd.sum(min_count=1)))
    summary = pd.DataFrame(summary).set_index('model')
    display(summary.round(5))
    assert targets.groupby('model').correct.sum().to_dict() == {'gpt-6.1-sol':4,'gpt-6-luna':0,'claude-haiku-5-5':0,'claude-sonnet-5-5':0}
    fig, axes = plt.subplots(1, 3, figsize=(16,4), layout='constrained')
    summary.detection_rate.plot.barh(ax=axes[0], color='#517fad'); axes[0].set(xlim=(0,1),title='Reference-side detection (3 people)',xlabel='Correct / six planned readings')
    summary.usd_per_1000.plot.barh(ax=axes[1],color='#54846c'); axes[1].set(title='Repriced analysis cost',xlabel='Estimated USD / 1,000 calls')
    summary.median_seconds.plot.barh(ax=axes[2],color='#aa8050'); axes[2].set(title='Observed median latency',xlabel='Seconds; dates/network differ')
    plt.show()
''')
md('''
    ## 5 · Person-level readings and confidence audit
    Keep misses visible instead of hiding them behind an average. Confidence bins
    below are descriptive agreement counts on eligible positives, **not probability
    calibration**. Four-model negative controls were not collected, so sensitivity,
    specificity, precision, F1 and ROC/AUC cannot all be inferred from these data.
''')
code('''
    def inspection(model=MODELS[0], person='01-right-arm'):
        display(regions[(regions.model==model)&(regions.person==person)][['repeat','region','assessable','asymmetry','confidence','fullerSide','observation','confounders']])
    target_detail = targets.copy()
    target_detail['reading'] = target_detail.apply(lambda r: f"A{r.score:g} · C{r.confidence:g} · {r.side}",axis=1)
    display(target_detail.pivot(index=['person','repeat'],columns='model',values='reading'))
    confidence_audit = targets.dropna(subset=['confidence']).groupby(['model','confidence']).agg(n=('correct','size'), correct=('correct','sum'))
    confidence_audit['reference_agreement'] = confidence_audit.correct/confidence_audit.n
    display(confidence_audit)
    try:
        import ipywidgets as widgets
        inspector = widgets.interactive(inspection, model=MODELS, person=list(references))
        display(inspector)
    except ImportError:
        inspection()  # The static tables above work without widgets.
''')
md('''
    ## 6 · Ablations: did extra work help?
    Compare each condition with its own frozen baseline, not the earlier provider
    run. Primary planned calls are five people × two repeats per condition (10);
    positive detection uses 6 planned readings, while control rates use completed
    labeled regions. Reflections and four ambiguous cases are separate. Combined
    changes several factors and cannot attribute an effect to one component.
''')
code('''
    a = E['ablation']
    arefs = {r['id']:r for r in a['reference']['cases']}
    ablation_rows, reflection_rows = [], []
    for variant in a['variants']:
        selected = [r for r in a['results'] if r['variant']==variant['id'] and not r.get('reflected') and arefs[r['id']]['kind']!='ambiguous']
        done = [r for r in selected if r.get('result')]
        detected, alarms, controls, abstentions = 0,0,0,0
        for r in done:
            ref = arefs[r['id']]
            if ref['kind']=='positive':
                v=r['result']['regions'][ref['target']]
                detected += int(v['assessable'] and v['asymmetry']>=2 and v['fullerSide']==ref['side'])
            for region in ref.get('controlRegions',[]):
                v=r['result']['regions'][region]; controls+=1
                alarms+=int(v['assessable'] and v['asymmetry']>=2)
                abstentions+=int(not v['assessable'])
        selected_costs = [cost(a['model'],r.get('usage')) for r in selected]
        ablation_rows.append(dict(condition=variant['id'], completed=f'{len(done)}/10', correct=detected, planned_positive=6, detection_rate=detected/6, control_alarms=alarms, control_n=controls, control_abstentions=abstentions, median_seconds=np.median([r['seconds'] for r in done]) if done else np.nan, mean_known_usd=np.nanmean(selected_costs), unknown_cost_calls=int(np.isnan(selected_costs).sum())))
    ablation_summary=pd.DataFrame(ablation_rows).set_index('condition')
    base=ablation_summary.loc['baseline']
    ablation_summary['extra_usd_vs_baseline']=ablation_summary.mean_known_usd-base.mean_known_usd
    ablation_summary['extra_detections_vs_baseline']=ablation_summary.correct-base.correct
    display(ablation_summary.round(5))
    reflected=[r for r in a['results'] if r.get('reflected')]
    for r in reflected:
        ref=arefs[r['id']]; expected={'left':'right','right':'left'}[ref['side']]
        v=(r.get('result') or {}).get('regions',{}).get(ref['target'],{})
        reflection_rows.append(dict(person=r['id'],repeat=r['repeat'],completed=bool(r.get('result')),expected_side=expected,observed_side=v.get('fullerSide'),correct=bool(v.get('assessable') and v.get('asymmetry',0)>=2 and v.get('fullerSide')==expected)))
    display(pd.DataFrame(reflection_rows))
    assert len(a['results'])==74 and sum(bool(r.get('result')) for r in a['results'])==73
    assert ablation_summary.correct.to_list()==[4,4,4,4,4,4]
    assert ablation_summary.control_alarms.to_list()==[0,1,0,1,1,6]
    print('At A≥2 none of the six conditions improves observed target detection; compare added cost, false alarms and completion separately.')
''')
md('''
    ## 7 · Reconcile costs and budget the actual product
    The old dollar estimates are not invoices. Compare the old formula with corrected
    cache-write accounting and a long-write sensitivity case. Failed calls without
    saved usage make total spending a **known-usage subtotal**, not an exact bill.
    Initial rejected Claude schema requests are outside the 56 completed comparison
    readings; their billing was not captured in this archive.

    The benchmark covers a three-view assessment, not the three separate production
    quality checks. Enter a measured quality-check cost below; leaving it blank gives
    an **analysis-only subtotal**. Retake rate, repeat requests and quality calls are
    scenario assumptions, not measured conversion or monthly use.
''')
code('''
    reconciliation = comparison.groupby('model')[['saved_estimate_usd','legacy_estimate_usd','estimated_usd','long_write_usd']].mean()
    reconciliation['cache_correction_usd']=reconciliation.estimated_usd-reconciliation.legacy_estimate_usd
    display(reconciliation.round(7))

    # Change these assumptions, then rerun this cell. No network requests occur.
    MONTHLY_PEOPLE = 1000
    ANALYSES_PER_PERSON = 4
    REPEAT_ANALYSIS_RATE = .10
    QUALITY_CALLS_PER_SET = 3
    EXTRA_QUALITY_CALL_RATE = .20
    QUALITY_CALL_USD = None  # Unknown: enter measured USD per one-image quality call.
    for number in [MONTHLY_PEOPLE,ANALYSES_PER_PERSON,REPEAT_ANALYSIS_RATE,QUALITY_CALLS_PER_SET,EXTRA_QUALITY_CALL_RATE]:
        assert number>=0 and math.isfinite(number)
    assert QUALITY_CALL_USD is None or QUALITY_CALL_USD>=0
    rows=[]
    for model, row in summary.iterrows():
        analyses=MONTHLY_PEOPLE*ANALYSES_PER_PERSON*(1+REPEAT_ANALYSIS_RATE)
        quality=MONTHLY_PEOPLE*ANALYSES_PER_PERSON*QUALITY_CALLS_PER_SET*(1+EXTRA_QUALITY_CALL_RATE)
        analysis_cost=analyses*row.mean_usd
        quality_cost=quality*QUALITY_CALL_USD if QUALITY_CALL_USD is not None else np.nan
        rows.append(dict(model=model,analysis_calls=analyses,quality_calls=quality,analysis_subtotal_usd=analysis_cost,quality_usd=quality_cost,total_usd=analysis_cost+quality_cost,scope='full pipeline estimate' if QUALITY_CALL_USD is not None else 'analysis only; quality cost UNKNOWN'))
    budget=pd.DataFrame(rows).set_index('model')
    display(budget.round(3))
    print('Output caps, prompts, image resolution, retries and cache reuse in production may differ; these are workload projections, not a production price promise.')
''')
md('''
    ## 8 · Conclusions and next evaluation
    - Sol found the reference side in 4/6 planned positive readings; the other three
      models found it in 0/6. This is only three distinct positives, not proof of a
      general ranking. Stable answers can be stable mistakes.
    - No isolated ablation improved primary ≥2 detection in this saved experiment.
      Higher reasoning and combined processing added latency/cost; combined also
      increased control alarms. A ≥3 score increase is not severity validation.
    - Keep quality checks and full assessments as separate workloads when budgeting.
      This notebook does not measure whether cheaper quality checks reject the right photos.
    - Next: freeze a larger, consented, independently labeled dataset; include
      matched symmetry controls, pose/lighting/clothing changes, mirrored inputs,
      missing views and varied equipment/framing. Separate prompt-development people
      from held-out evaluation people. Keep repeated images in the same split.
    - Use two blinded human reviewers plus adjudication, anatomical-side annotations,
      and uncertainty/exclusion labels. Pre-register thresholds and a budget before
      any new paid run; preserve every failure and billed usage record.
    - Evaluate the **current production prompt** separately. Do not pool teen results,
      quality checks, physiology measurements or production claims into this adult
      synthetic outline benchmark.

    No provider calls are implemented in this notebook. New experiments should have
    an explicit call cap, spending limit, no automatic retries, and frozen input hashes.
''')
code('''
    EXPORT_DIR.mkdir(exist_ok=True)
    tables={'model_summary':summary,'planned_target_readings':targets,'all_calls':calls,'all_regions':readings,'confidence_audit':confidence_audit,'ablation_summary':ablation_summary,'cost_reconciliation':reconciliation,'monthly_budget':budget}
    for name, table in tables.items(): table.to_csv(EXPORT_DIR/f'{name}.csv',index=True)
    manifest={'protocol_version':'1.0','price_as_of':PRICE_AS_OF,'prices_usd_per_million':PRICES,'seed':SEED,'primary_threshold':DETECTION_THRESHOLD,'source_provenance':BUNDLE['provenance'],'embedded_archive_sha256':hashlib.sha256(json.dumps(BUNDLE,sort_keys=True).encode()).hexdigest(),'unknown_usage_calls':int(calls.estimated_usd.isna().sum()),'new_paid_calls':0,'budget_assumptions':dict(people=MONTHLY_PEOPLE,analyses_per_person=ANALYSES_PER_PERSON,repeat_analysis_rate=REPEAT_ANALYSIS_RATE,quality_calls_per_set=QUALITY_CALLS_PER_SET,extra_quality_rate=EXTRA_QUALITY_CALL_RATE,quality_call_usd=QUALITY_CALL_USD),'limits':['synthetic adults','AI-reviewed labels','three eligible distinct positive people','historical model dates differ','experimental prompt differs from production']}
    (EXPORT_DIR/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    archive=Path('tally_photo_evaluation_exports.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for path in sorted(EXPORT_DIR.iterdir()): z.write(path,arcname=path.name)
    display(Markdown(f'**Exports ready:** `{archive}`. In Colab, use the Files sidebar to download the ZIP or individual CSVs.'))
    print('Final checks passed. No paid calls made.')
''')

notebook = {'nbformat': 4, 'nbformat_minor': 5, 'metadata': {'colab': {'name': 'Tally_Photo_Evaluation.ipynb', 'provenance': []}, 'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}, 'language_info': {'name': 'python', 'version': '3.12'}}, 'cells': cells}
for index, cell in enumerate(cells): cell['id'] = f'tally-eval-{index:02d}'
(out/'Tally_Photo_Evaluation.ipynb').write_text(json.dumps(notebook,ensure_ascii=False,indent=1),encoding='utf-8')
(out/'benchmark_snapshot.json').write_text(json.dumps(bundle,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Created {len(cells)} cells in {out}')
