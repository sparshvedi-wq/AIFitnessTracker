// Canonical planning metadata for the 88 original Ink exercises. IDs, names
// and cues stay in exercises.js / movement-preferences.js / sports.js; this
// file only describes how each one loads the body and what it needs.
//
// Field codes (expanded and validated by catalog/index.js):
//   p / s / st  primary, secondary and stabilising muscles (vocabulary.js)
//   pat / fam   coarse movement pattern / substitution family
//   j           joint actions          eq   equipment (+ = and, | = or)
//   sup         environment support    pos  body position
//   lat         bi | uni | alt | alt-total | hold-switch
//   sp          s (fits a small space) | o (needs open room)
//   no          noise q | m | l        im   impact 0 none, 1 low, 2 jumping
//   lv          0 starting out, 1 some experience, 2 experienced
//   k           session kinds (S strength, T seated, W warm-up, M mobility, K conditioning)
//   load        logging convention (vocabulary LOAD_CONVENTIONS)
//   role        compound | accessory | isolation | control | drill | stretch
//   areas       explicit broad areas (warm-up drills keep their original lists)

const STILL = { pat: 'warmup', fam: 'sport-rehearsal', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'W', load: 'bw', role: 'drill' }
const drill = (fields) => ({ ...STILL, ...fields })

export const CORE_METADATA = {
  'seated-knee-extension': { p: 'quads', pat: 'control', fam: 'knee-control', j: 'ke', eq: '', sup: 'seat', pos: 'seat', lat: 'uni', sp: 's', no: 'q', im: 0, lv: 0, k: 'T', load: 'bw', role: 'control' },
  'seated-heel-raise': { p: 'calves', pat: 'calf', fam: 'calf', j: 'ap', eq: '', sup: 'seat', pos: 'seat', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'T', load: 'bw', role: 'control' },
  'seated-scapular': { p: 'upper-back', s: 'rear-delts', pat: 'control', fam: 'scapular-control', j: 'sret', eq: '', sup: 'seat', pos: 'seat', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'T', load: 'bw', role: 'control' },
  'seated-reach': { p: 'front-delts', st: 'upper-back', pat: 'control', fam: 'shoulder-mobility', j: 'sf', eq: '', sup: 'seat', pos: 'seat', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'T', load: 'bw', role: 'control' },
  'seated-brace': { p: 'abs', pat: 'core', fam: 'core-brace', j: 'aext', eq: '', sup: 'seat', pos: 'seat', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'T', load: 'bw', role: 'control' },
  'standing-brace': { p: 'abs', pat: 'core', fam: 'core-brace', j: 'aext', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'control' },
  'standing-w': { p: 'upper-back', s: 'rear-delts', pat: 'control', fam: 'scapular-control', j: 'sret ser', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'control' },
  'db-overhead-press': { p: 'front-delts side-delts', s: 'triceps', st: 'abs traps', pat: 'push-v', fam: 'vertical-press', j: 'sf sab ee', eq: 'db', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 1, k: 'S', load: 'hand', role: 'compound', staple: 1 },
  'db-rdl': { p: 'hamstrings glutes', s: 'lower-back', st: 'forearms', pat: 'hinge', fam: 'hinge', j: 'he', eq: 'db', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 1, k: 'S', load: 'hand', role: 'compound', staple: 1 },
  'quiet-march': { p: 'quads', s: 'calves glutes', st: 'abs', pat: 'conditioning', fam: 'marching', j: 'hf loc', eq: '', pos: 'stand', lat: 'alt-total', sp: 's', no: 'q', im: 0, lv: 0, k: 'WK', load: 'bw', role: 'drill' },
  'quiet-step': { p: 'quads glutes', s: 'calves', st: 'abductors', pat: 'conditioning', fam: 'marching', j: 'hab loc', eq: '', pos: 'stand', lat: 'alt-total', sp: 'o', no: 'q', im: 0, lv: 0, k: 'WK', load: 'bw', role: 'drill' },
  'quiet-squat': { p: 'quads glutes', s: 'adductors', pat: 'conditioning', fam: 'squat-practice', j: 'ke he', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'K', load: 'bw', role: 'drill' },
  'bodyweight-squat': { p: 'quads glutes', s: 'adductors', pat: 'squat', fam: 'squat', j: 'ke he', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'compound', staple: 1 },
  'split-squat': { p: 'quads glutes', s: 'adductors', pat: 'lunge', fam: 'lunge', j: 'ke he', eq: '', pos: 'stand', lat: 'uni', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'compound', staple: 1 },
  'incline-push-up': { p: 'chest', s: 'front-delts triceps', pat: 'push-h', fam: 'horizontal-press', j: 'shad ee', eq: '', sup: 'wall', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'compound' },
  'prone-w': { p: 'upper-back', s: 'rear-delts', pat: 'control', fam: 'scapular-control', j: 'sret ser', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'control' },
  'band-row': { p: 'lats upper-back', s: 'biceps rear-delts', pat: 'pull-h', fam: 'horizontal-row', j: 'se sret ef', eq: 'band', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'band', role: 'compound', staple: 1 },
  'back-squat': { p: 'quads glutes', s: 'adductors lower-back', st: 'abs', pat: 'squat', fam: 'squat', j: 'ke he', eq: 'bb+rack', pos: 'stand', lat: 'bi', sp: 'o', no: 'm', im: 0, lv: 1, k: 'S', load: 'bar', role: 'compound', staple: 1 },
  'goblet-squat': { p: 'quads glutes', s: 'adductors', st: 'abs upper-back', pat: 'squat', fam: 'squat', j: 'ke he', eq: 'db|kb', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'one', role: 'compound', staple: 1 },
  rdl: { p: 'hamstrings glutes', s: 'lower-back', st: 'upper-back forearms', pat: 'hinge', fam: 'hinge', j: 'he', eq: 'bb', pos: 'stand', lat: 'bi', sp: 'o', no: 'm', im: 0, lv: 1, k: 'S', load: 'bar', role: 'compound', staple: 1 },
  deadlift: { p: 'glutes hamstrings lower-back', s: 'quads upper-back forearms', pat: 'hinge', fam: 'hinge', j: 'he ke', eq: 'bb', pos: 'stand', lat: 'bi', sp: 'o', no: 'l', im: 0, lv: 1, k: 'S', load: 'bar', role: 'compound', staple: 1, setup: 45 },
  lunge: { p: 'quads glutes', s: 'adductors', st: 'forearms', pat: 'lunge', fam: 'lunge', j: 'ke he loc', eq: 'db', pos: 'stand', lat: 'uni', sp: 'o', no: 'q', im: 0, lv: 1, k: 'S', load: 'hand', role: 'compound' },
  'leg-press': { p: 'quads glutes', s: 'adductors', pat: 'squat', fam: 'squat', j: 'ke he', eq: 'machine', pos: 'machine', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'plate', role: 'compound', staple: 1 },
  'calf-raise': { p: 'calves', pat: 'calf', fam: 'calf', j: 'ap', eq: 'db', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'hand', role: 'isolation', staple: 1 },
  'glute-bridge': { p: 'glutes', s: 'hamstrings', pat: 'hinge', fam: 'hip-thrust', j: 'he', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'accessory', staple: 1 },
  'squat-jump': { p: 'quads glutes', s: 'calves', pat: 'conditioning', fam: 'jumping', j: 'ke he ap', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'l', im: 2, lv: 1, k: 'K', load: 'bw', role: 'drill' },
  'bench-press': { p: 'chest', s: 'front-delts triceps', pat: 'push-h', fam: 'horizontal-press', j: 'shad ee', eq: 'bb+rack+bench', pos: 'bench', lat: 'bi', sp: 'o', no: 'm', im: 0, lv: 0, k: 'S', load: 'bar', role: 'compound', staple: 1 },
  'db-bench': { p: 'chest', s: 'front-delts triceps', pat: 'push-h', fam: 'horizontal-press', j: 'shad ee', eq: 'db+bench', pos: 'bench', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'hand', role: 'compound', staple: 1 },
  'push-up': { p: 'chest', s: 'front-delts triceps abs', pat: 'push-h', fam: 'horizontal-press', j: 'shad ee aext', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'compound', staple: 1 },
  ohp: { p: 'front-delts side-delts', s: 'triceps upper-back', st: 'abs', pat: 'push-v', fam: 'vertical-press', j: 'sf sab ee', eq: 'bb+rack', pos: 'stand', lat: 'bi', sp: 's', no: 'm', im: 0, lv: 1, k: 'S', load: 'bar', role: 'compound', staple: 1 },
  'lateral-raise': { p: 'side-delts', st: 'traps', pat: 'shoulder-iso', fam: 'lateral-raise', j: 'sab', eq: 'db', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'hand', role: 'isolation', staple: 1 },
  dip: { p: 'triceps chest', s: 'front-delts', pat: 'push-v', fam: 'dip', j: 'ee se shad', eq: 'dip', pos: 'hang', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 2, k: 'S', load: 'bw', role: 'compound' },
  'triceps-pushdown': { p: 'triceps', pat: 'arms', fam: 'triceps-extension', j: 'ee', eq: 'cable', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'stack', role: 'isolation', staple: 1 },
  'pull-up': { p: 'lats', s: 'biceps upper-back rear-delts', st: 'forearms abs', pat: 'pull-v', fam: 'vertical-pull', j: 'se ef', eq: 'bar', pos: 'hang', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 1, k: 'S', load: 'bw', role: 'compound', staple: 1 },
  'lat-pulldown': { p: 'lats', s: 'biceps upper-back rear-delts', pat: 'pull-v', fam: 'vertical-pull', j: 'se ef', eq: 'machine', pos: 'machine', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'stack', role: 'compound', staple: 1 },
  'barbell-row': { p: 'lats upper-back', s: 'biceps rear-delts lower-back', pat: 'pull-h', fam: 'horizontal-row', j: 'se sret ef', eq: 'bb', pos: 'stand', lat: 'bi', sp: 'o', no: 'm', im: 0, lv: 1, k: 'S', load: 'bar', role: 'compound', staple: 1 },
  'db-row': { p: 'lats upper-back', s: 'biceps rear-delts', pat: 'pull-h', fam: 'horizontal-row', j: 'se sret ef', eq: 'db+bench', pos: 'bench', lat: 'uni', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'hand', role: 'compound', staple: 1 },
  'face-pull': { p: 'rear-delts', s: 'upper-back rotator-cuff', pat: 'rear-iso', fam: 'rear-delt', j: 'shab ser sret', eq: 'cable', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'stack', role: 'isolation', staple: 1 },
  'biceps-curl': { p: 'biceps', s: 'forearms', pat: 'arms', fam: 'curl', j: 'ef', eq: 'db', pos: 'stand', lat: 'alt', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'hand', role: 'isolation', staple: 1 },
  plank: { p: 'abs', s: 'obliques', st: 'front-delts glutes', pat: 'core', fam: 'core-anti-extension', j: 'aext', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'accessory', staple: 1 },
  'side-plank': { p: 'obliques', s: 'abs serratus', st: 'abductors', pat: 'core', fam: 'core-lateral', j: 'alat', eq: '', pos: 'floor', lat: 'hold-switch', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'accessory', staple: 1 },
  'dead-bug': { p: 'abs', st: 'hip-flexors', pat: 'core', fam: 'core-anti-extension', j: 'aext', eq: '', pos: 'floor', lat: 'alt-total', sp: 's', no: 'q', im: 0, lv: 0, k: 'S', load: 'bw', role: 'accessory', staple: 1 },
  'hollow-hold': { p: 'abs', st: 'hip-flexors', pat: 'core', fam: 'core-anti-extension', j: 'aext', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 1, k: 'S', load: 'bw', role: 'accessory' },
  'russian-twist': { p: 'obliques', s: 'abs', st: 'hip-flexors', pat: 'core', fam: 'core-rotation', j: 'tr', eq: '', pos: 'floor', lat: 'alt-total', sp: 's', no: 'q', im: 0, lv: 1, k: 'S', load: 'bw', role: 'accessory' },
  'mountain-climber': { p: 'abs', s: 'hip-flexors front-delts', st: 'quads', pat: 'conditioning', fam: 'conditioning-floor', j: 'hf aext', eq: '', pos: 'floor', lat: 'alt-total', sp: 's', no: 'm', im: 1, lv: 0, k: 'K', load: 'bw', role: 'drill' },
  'jumping-jack': { p: 'calves', s: 'quads glutes', st: 'side-delts', pat: 'conditioning', fam: 'jumping', j: 'hab sab ap', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'l', im: 2, lv: 0, k: 'K', load: 'bw', role: 'drill' },
  burpee: { p: 'quads chest', s: 'glutes triceps front-delts abs', pat: 'conditioning', fam: 'jumping', j: 'ke he shad ee', eq: '', pos: 'floor', lat: 'bi', sp: 's', no: 'l', im: 2, lv: 1, k: 'K', load: 'bw', role: 'drill' },
  'high-knees': { p: 'hip-flexors quads', s: 'calves', pat: 'conditioning', fam: 'jumping', j: 'hf ap', eq: '', pos: 'stand', lat: 'alt-total', sp: 's', no: 'l', im: 2, lv: 0, k: 'K', load: 'bw', role: 'drill' },
  skater: { p: 'glutes quads', s: 'adductors calves', pat: 'conditioning', fam: 'jumping', j: 'hab ke', eq: '', pos: 'stand', lat: 'alt-total', sp: 'o', no: 'l', im: 2, lv: 1, k: 'K', load: 'bw', role: 'drill' },
  'cat-cow': { p: 'lower-back', s: 'abs', pat: 'mobility', fam: 'spine-mobility', j: 'mob', eq: '', pos: 'kneel', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'M', load: 'bw', role: 'stretch' },
  'worlds-greatest': { p: 'hip-flexors hamstrings', s: 'upper-back', pat: 'mobility', fam: 'hip-mobility', j: 'mob tr', eq: '', pos: 'floor', lat: 'hold-switch', sp: 's', no: 'q', im: 0, lv: 0, k: 'MW', load: 'bw', role: 'stretch' },
  'hip-flexor': { p: 'hip-flexors', st: 'glutes', pat: 'mobility', fam: 'hip-mobility', j: 'mob', eq: '', pos: 'kneel', lat: 'hold-switch', sp: 's', no: 'q', im: 0, lv: 0, k: 'M', load: 'bw', role: 'stretch' },
  'hamstring-stretch': { p: 'hamstrings', pat: 'mobility', fam: 'hamstring-mobility', j: 'mob', eq: '', pos: 'stand', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'M', load: 'bw', role: 'stretch' },
  'childs-pose': { p: 'lower-back lats', pat: 'mobility', fam: 'spine-mobility', j: 'mob', eq: '', pos: 'kneel', lat: 'bi', sp: 's', no: 'q', im: 0, lv: 0, k: 'M', load: 'bw', role: 'stretch' },

  // Sport preparation drills keep their original area lists (sports.js).
  'wu-racket-still': drill({ areas: 'Shoulders Back Biceps Triceps Core', j: 'tr sab' }),
  'wu-basketball-still': drill({ areas: 'Shoulders Triceps Core Legs', j: 'sf ee' }),
  'wu-footwork-still': drill({ areas: 'Legs Glutes Core', j: 'hf' }),
  'wu-volley-still': drill({ areas: 'Shoulders Triceps Core', j: 'sf' }),
  'wu-skate-still': drill({ areas: 'Legs Glutes Core', j: 'ke hab' }),
  'wu-box-still': drill({ areas: 'Core Shoulders Triceps', j: 'shad ee tr' }),
  'wu-jog': drill({ areas: 'Legs Glutes Core', j: 'loc', fam: 'easy-cardio', sp: 'o', im: 2, no: 'm', k: 'WK' }),
  'wu-ankles': drill({ areas: 'Legs Glutes Core', j: 'ap', fam: 'ankle-prep' }),
  'wu-leg-swings': drill({ areas: 'Legs Glutes Core', j: 'hf he hab', fam: 'hip-mobility', k: 'WM' }),
  'wu-lunge': drill({ areas: 'Legs Glutes Core Shoulders', j: 'ke he sf', fam: 'lunge-prep' }),
  'wu-lateral': drill({ areas: 'Legs Glutes Core', j: 'hab had', fam: 'hip-mobility' }),
  'wu-hips': drill({ areas: 'Legs Glutes Core', j: 'hab hf', fam: 'hip-mobility', k: 'WM' }),
  'wu-arms': drill({ areas: 'Shoulders Back Biceps Triceps', j: 'sab sf', fam: 'shoulder-mobility', k: 'WM' }),
  'wu-rotation': drill({ areas: 'Core Back', j: 'tr', fam: 'spine-mobility', k: 'WM' }),
  'wu-scapula': drill({ areas: 'Shoulders Back Biceps Triceps', j: 'sf sret', fam: 'scapular-control', sup: 'wall', k: 'WM' }),
  'wu-wrists': drill({ areas: 'Biceps Triceps', j: 'mob', fam: 'wrist-prep' }),
  'wu-balance': drill({ areas: 'Legs Glutes Core', j: 'he hab', fam: 'balance' }),
  'wu-march': drill({ areas: 'Legs Glutes Core Shoulders', j: 'hf loc', fam: 'marching', im: 2, no: 'm' }),
  'wu-shuffle': drill({ areas: 'Legs Glutes Core', j: 'hab loc', fam: 'footwork', sp: 'o', im: 1, no: 'm' }),
  'wu-landing': drill({ areas: 'Legs Glutes Core', j: 'ke he ap', fam: 'jumping', im: 2, no: 'l' }),
  'wu-strides': drill({ areas: 'Legs Glutes Core', j: 'loc', fam: 'easy-cardio', sp: 'o', im: 2, no: 'm' }),
  'wu-cut': drill({ areas: 'Legs Glutes Core', j: 'loc hab', fam: 'footwork', sp: 'o', im: 2, no: 'm' }),
  'wu-football': drill({ areas: 'Legs Glutes Core', j: 'loc', sp: 'o', im: 0, no: 'm' }),
  'wu-basketball': drill({ areas: 'Legs Glutes Core Shoulders Triceps', j: 'loc sf', sp: 'o', im: 2, no: 'l' }),
  'wu-racket': drill({ areas: 'Shoulders Back Biceps Triceps Core Legs Glutes', j: 'tr sab', im: 2, no: 'm' }),
  'wu-volley': drill({ areas: 'Legs Glutes Core Shoulders Triceps', j: 'sf loc', sp: 'o', im: 2, no: 'm' }),
  'wu-throw': drill({ areas: 'Shoulders Back Biceps Triceps Core', j: 'tr sf' }),
  'wu-swim': drill({ areas: 'Shoulders Back Chest Triceps Core', j: 'sf se' }),
  'wu-cycle': drill({ areas: 'Legs Glutes Core', j: 'ke he', fam: 'easy-cardio', eq: 'bike', sp: 'o' }),
  'wu-golf': drill({ areas: 'Core Legs Glutes Shoulders Back', j: 'tr' }),
  'wu-combat': drill({ areas: 'Core Legs Glutes Shoulders Triceps', j: 'shad ee tr', im: 2, no: 'm' }),
  'wu-skate': drill({ areas: 'Legs Glutes Core', j: 'hab ke', sp: 'o', im: 1 }),
  'wu-cricket': drill({ areas: 'Core Legs Glutes Shoulders Back Triceps', j: 'tr sf', sp: 'o' }),
  'wu-hinge': drill({ areas: 'Legs Glutes Core', j: 'he', fam: 'hinge-prep' }),
}
