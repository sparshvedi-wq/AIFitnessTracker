# Exercise catalog import audit

Generated from the actual canonical definitions and versioned source manifest by running `node scripts/catalog-report.mjs`.

| Measure | Count |
|---|---:|
| Legacy source records accounted for | 200 |
| Source records mapped to retained Ink IDs | 32 |
| Distinct original Ink IDs matched | 31 |
| Source synonyms mapped to another imported definition | 1 |
| New definitions | 167 |
| Meaningful variations among new definitions | 97 |
| Other new movements | 70 |
| Original Ink-only movements retained | 57 |
| Final unique built-in definitions | 255 |
| Reviewed strength candidates before personal eligibility filtering | 202 |

The original 88 IDs and mannequin guides remain intact. The imported exercises have written guides; images are displayed only for the 88 exercises with matching artwork. The total exceeds 200 because Ink-only movements and sport drills are retained. A movement is suggested only when its metadata, session kind, equipment, skill and personal constraints allow it.

The FRAME sources are read-only references: `N:\Workspaces\AIFitnessTracker\mobile\src\lib\workouts.ts` (60 base records) and `exercise-catalog-extra.ts` (140 records). No FRAME accounts, photographs or saved workouts were imported. Saved custom-ID collisions use the idempotent migration in `src/lib/catalog/migrations.js`; user-facing names and historical records are retained.

## Complete source-to-canonical mapping

| Source / index | Legacy name | Relationship | Stable Ink ID | Canonical name |
|---|---|---|---|---|
| base 0 | Bodyweight squat | existing | bodyweight-squat | Bodyweight squat |
| base 1 | Incline push-up | imported | bench-push-up | Incline push-up (bench) |
| base 2 | Prone Y-T raise | imported | prone-yt-raise | Prone Y-T raise |
| base 3 | Glute bridge | existing | glute-bridge | Glute bridge |
| base 4 | Dead bug | existing | dead-bug | Dead bug |
| base 5 | Wall push-up | existing | incline-push-up | Wall push-up |
| base 6 | Dumbbell goblet squat | existing | goblet-squat | Goblet squat |
| base 7 | Dumbbell floor press | imported | db-floor-press | Dumbbell floor press |
| base 8 | Dumbbell row | existing | db-row | One-arm dumbbell row |
| base 9 | Dumbbell Romanian deadlift | existing | db-rdl | Dumbbell Romanian deadlift |
| base 10 | Dumbbell lateral raise | existing | lateral-raise | Lateral raise |
| base 11 | Dumbbell curl | existing | biceps-curl | Biceps curl |
| base 12 | Band row | imported | band-anchored-row | Standing band row |
| base 13 | Band chest press | imported | band-chest-press | Band chest press |
| base 14 | Barbell squat | existing | back-squat | Back squat |
| base 15 | Barbell Romanian deadlift | existing | rdl | Romanian deadlift |
| base 16 | Machine chest press | imported | machine-chest-press | Machine chest press |
| base 17 | Lat pulldown | existing | lat-pulldown | Lat pulldown |
| base 18 | Leg press | existing | leg-press | Leg press |
| base 19 | Cable row | imported | cable-row | Seated cable row |
| base 20 | Kettlebell deadlift | imported | kb-deadlift | Kettlebell deadlift |
| base 21 | Push-up | existing | push-up | Push-up |
| base 22 | Pike push-up | imported | pike-push-up | Pike push-up |
| base 23 | Reverse lunge | imported | reverse-lunge | Reverse lunge |
| base 24 | Split squat | existing | split-squat | Bodyweight split squat |
| base 25 | Calf raise | imported | bodyweight-calf-raise | Bodyweight calf raise |
| base 26 | Plank | existing | plank | Plank |
| base 27 | Side plank | existing | side-plank | Side plank |
| base 28 | Bench dip | imported | bench-dip | Bench dip |
| base 29 | Hip thrust | imported | hip-thrust | Hip thrust |
| base 30 | Dumbbell bench press | existing | db-bench | Dumbbell bench press |
| base 31 | Dumbbell shoulder press | existing | db-overhead-press | Dumbbell overhead press |
| base 32 | Dumbbell triceps extension | imported | db-overhead-triceps-extension | Dumbbell overhead triceps extension |
| base 33 | Dumbbell hammer curl | imported | db-hammer-curl | Dumbbell hammer curl |
| base 34 | Dumbbell reverse lunge | imported | db-reverse-lunge | Dumbbell reverse lunge |
| base 35 | Dumbbell rear delt fly | imported | db-rear-delt-fly | Dumbbell rear delt fly |
| base 36 | Barbell bench press | existing | bench-press | Bench press |
| base 37 | Barbell row | existing | barbell-row | Bent-over row |
| base 38 | Overhead press | existing | ohp | Overhead press |
| base 39 | Barbell hip thrust | imported | barbell-hip-thrust | Barbell hip thrust |
| base 40 | Machine shoulder press | imported | machine-shoulder-press | Machine shoulder press |
| base 41 | Leg curl | synonym | seated-leg-curl | Seated leg curl |
| base 42 | Leg extension | imported | leg-extension | Leg extension |
| base 43 | Pec deck | imported | pec-deck | Pec deck |
| base 44 | Triceps pushdown | existing | triceps-pushdown | Triceps pushdown |
| base 45 | Face pull | existing | face-pull | Face pull |
| base 46 | Cable fly | imported | cable-fly | Cable fly |
| base 47 | Pull-up | existing | pull-up | Pull-up |
| base 48 | Hanging knee raise | imported | hanging-knee-raise | Hanging knee raise |
| base 49 | Kettlebell swing | imported | kb-swing | Kettlebell swing |
| base 50 | Kettlebell goblet squat | existing | goblet-squat | Goblet squat |
| base 51 | Band pull-apart | imported | band-pull-apart | Band pull-apart |
| base 52 | Band curl | imported | band-curl | Band curl |
| base 53 | Band squat | imported | band-squat | Band squat |
| base 54 | Band Romanian deadlift | imported | band-rdl | Band Romanian deadlift |
| base 55 | Band triceps pushdown | imported | band-pushdown | Band triceps pushdown |
| base 56 | Dumbbell calf raise | existing | calf-raise | Calf raise |
| base 57 | Machine calf raise | imported | machine-calf-raise | Machine calf raise |
| base 58 | Bird dog | imported | bird-dog | Bird dog |
| base 59 | Wall slide | existing | wu-scapula | Wall shoulder slides |
| extra 0 | Kneeling push-up | imported | kneeling-push-up | Kneeling push-up |
| extra 1 | Close-grip push-up | imported | close-grip-push-up | Close-grip push-up |
| extra 2 | Wide-grip push-up | imported | wide-push-up | Wide-grip push-up |
| extra 3 | Scapular push-up | imported | scapular-push-up | Scapular push-up |
| extra 4 | Tempo squat | imported | tempo-squat | Tempo squat |
| extra 5 | Paused squat | imported | paused-squat | Paused squat |
| extra 6 | Sumo squat | imported | sumo-squat | Sumo squat |
| extra 7 | Lateral lunge | imported | lateral-lunge | Lateral lunge |
| extra 8 | Forward lunge | imported | forward-lunge | Forward lunge |
| extra 9 | Curtsy lunge | imported | curtsy-lunge | Curtsy lunge |
| extra 10 | Single-leg glute bridge | imported | single-leg-glute-bridge | Single-leg glute bridge |
| extra 11 | Glute bridge march | imported | glute-bridge-march | Glute bridge march |
| extra 12 | Single-leg calf raise | imported | single-leg-calf-raise | Single-leg calf raise |
| extra 13 | Kneeling side plank | imported | kneeling-side-plank | Kneeling side plank |
| extra 14 | Reverse crunch | imported | reverse-crunch | Reverse crunch |
| extra 15 | Bicycle crunch | imported | bicycle-crunch | Bicycle crunch |
| extra 16 | Heel tap | imported | heel-tap | Heel tap |
| extra 17 | Superman raise | imported | superman | Superman raise |
| extra 18 | Prone W raise | existing | prone-w | Prone W raise |
| extra 19 | Dead bug heel tap | imported | dead-bug-heel-tap | Dead bug heel tap |
| extra 20 | Dumbbell incline bench press | imported | db-incline-press | Dumbbell incline bench press |
| extra 21 | Dumbbell squeeze floor press | imported | db-squeeze-press | Dumbbell squeeze floor press |
| extra 22 | Dumbbell neutral-grip bench press | imported | db-neutral-bench | Dumbbell neutral-grip bench press |
| extra 23 | Dumbbell alternating floor press | imported | db-alt-floor-press | Dumbbell alternating floor press |
| extra 24 | Dumbbell floor fly | imported | db-floor-fly | Dumbbell floor fly |
| extra 25 | Dumbbell pullover | imported | db-pullover | Dumbbell pullover |
| extra 26 | Dumbbell chest-supported row | imported | db-chest-supported-row | Dumbbell chest-supported row |
| extra 27 | Dumbbell bent-over row | imported | db-bent-over-row | Dumbbell bent-over row |
| extra 28 | Dumbbell wide-elbow row | imported | db-wide-row | Dumbbell wide-elbow row |
| extra 29 | Dumbbell single-arm floor press | imported | db-single-arm-floor-press | Dumbbell single-arm floor press |
| extra 30 | Dumbbell seated shoulder press | imported | db-seated-press | Dumbbell seated shoulder press |
| extra 31 | Dumbbell Arnold press | imported | db-arnold-press | Dumbbell Arnold press |
| extra 32 | Dumbbell front raise | imported | db-front-raise | Dumbbell front raise |
| extra 33 | Dumbbell scaption raise | imported | db-scaption | Dumbbell scaption raise |
| extra 34 | Dumbbell shrug | imported | db-shrug | Dumbbell shrug |
| extra 35 | Dumbbell concentration curl | imported | db-concentration-curl | Dumbbell concentration curl |
| extra 36 | Dumbbell incline curl | imported | db-incline-curl | Dumbbell incline curl |
| extra 37 | Dumbbell reverse curl | imported | db-reverse-curl | Dumbbell reverse curl |
| extra 38 | Dumbbell cross-body hammer curl | imported | db-cross-body-curl | Dumbbell cross-body hammer curl |
| extra 39 | Dumbbell triceps kickback | imported | db-kickback | Dumbbell triceps kickback |
| extra 40 | Dumbbell lying triceps extension | imported | db-lying-triceps-extension | Dumbbell lying triceps extension |
| extra 41 | Dumbbell front squat | imported | db-front-squat | Dumbbell front squat |
| extra 42 | Dumbbell sumo squat | imported | db-sumo-squat | Dumbbell sumo squat |
| extra 43 | Dumbbell split squat | imported | db-split-squat | Dumbbell split squat |
| extra 44 | Dumbbell lateral lunge | imported | db-lateral-lunge | Dumbbell lateral lunge |
| extra 45 | Dumbbell step-up | imported | db-step-up | Dumbbell step-up |
| extra 46 | Dumbbell single-leg Romanian deadlift | imported | db-single-leg-rdl | Dumbbell single-leg Romanian deadlift |
| extra 47 | Dumbbell glute bridge | imported | db-glute-bridge | Dumbbell glute bridge |
| extra 48 | Dumbbell hip thrust | imported | db-hip-thrust | Dumbbell hip thrust |
| extra 49 | Dumbbell seated calf raise | imported | db-seated-calf-raise | Dumbbell seated calf raise |
| extra 50 | Band seated row | existing | band-row | Seated band row |
| extra 51 | Band lat pulldown | imported | band-lat-pulldown | Band lat pulldown |
| extra 52 | Band straight-arm pulldown | imported | band-straight-arm-pulldown | Band straight-arm pulldown |
| extra 53 | Band face pull | imported | band-face-pull | Band face pull |
| extra 54 | Band reverse fly | imported | band-reverse-fly | Band reverse fly |
| extra 55 | Band shoulder press | imported | band-shoulder-press | Band shoulder press |
| extra 56 | Band lateral raise | imported | band-lateral-raise | Band lateral raise |
| extra 57 | Band front raise | imported | band-front-raise | Band front raise |
| extra 58 | Band external rotation | imported | band-external-rotation | Band external rotation |
| extra 59 | Band floor press | imported | band-floor-press | Band floor press |
| extra 60 | Band chest fly | imported | band-chest-fly | Band chest fly |
| extra 61 | Band overhead triceps extension | imported | band-overhead-extension | Band overhead triceps extension |
| extra 62 | Band hammer curl | imported | band-hammer-curl | Band hammer curl |
| extra 63 | Band good morning | imported | band-good-morning | Band good morning |
| extra 64 | Band glute bridge | imported | band-glute-bridge | Band glute bridge |
| extra 65 | Band lateral walk | imported | band-lateral-walk | Band lateral walk |
| extra 66 | Band standing hip abduction | imported | band-hip-abduction | Band standing hip abduction |
| extra 67 | Band standing hip extension | imported | band-hip-extension | Band standing hip extension |
| extra 68 | Band leg curl | imported | band-leg-curl | Band leg curl |
| extra 69 | Band Pallof press | imported | band-pallof-press | Band Pallof press |
| extra 70 | Barbell front squat | imported | front-squat | Barbell front squat |
| extra 71 | Barbell box squat | imported | box-squat | Barbell box squat |
| extra 72 | Barbell paused squat | imported | paused-back-squat | Barbell paused squat |
| extra 73 | Barbell split squat | imported | barbell-split-squat | Barbell split squat |
| extra 74 | Barbell conventional deadlift | existing | deadlift | Deadlift |
| extra 75 | Barbell sumo deadlift | imported | sumo-deadlift | Barbell sumo deadlift |
| extra 76 | Barbell glute bridge | imported | barbell-glute-bridge | Barbell glute bridge |
| extra 77 | Barbell good morning | imported | good-morning | Barbell good morning |
| extra 78 | Barbell incline bench press | imported | incline-bench-press | Barbell incline bench press |
| extra 79 | Barbell close-grip bench press | imported | close-grip-bench | Barbell close-grip bench press |
| extra 80 | Barbell floor press | imported | barbell-floor-press | Barbell floor press |
| extra 81 | Barbell paused bench press | imported | paused-bench-press | Barbell paused bench press |
| extra 82 | Barbell underhand row | imported | underhand-row | Barbell underhand row |
| extra 83 | Barbell Pendlay row | imported | pendlay-row | Barbell Pendlay row |
| extra 84 | Barbell shrug | imported | barbell-shrug | Barbell shrug |
| extra 85 | Barbell curl | imported | barbell-curl | Barbell curl |
| extra 86 | Barbell reverse curl | imported | barbell-reverse-curl | Barbell reverse curl |
| extra 87 | Barbell lying triceps extension | imported | barbell-lying-triceps-extension | Barbell lying triceps extension |
| extra 88 | Barbell seated overhead press | imported | seated-barbell-press | Barbell seated overhead press |
| extra 89 | Landmine press | imported | landmine-press | Landmine press |
| extra 90 | Machine incline chest press | imported | machine-incline-press | Machine incline chest press |
| extra 91 | Machine decline chest press | imported | machine-decline-press | Machine decline chest press |
| extra 92 | Machine seated row | imported | machine-row | Machine seated row |
| extra 93 | Machine chest-supported high row | imported | machine-high-row | Machine chest-supported high row |
| extra 94 | Machine pullover | imported | machine-pullover | Machine pullover |
| extra 95 | Assisted pull-up | imported | assisted-pull-up | Assisted pull-up |
| extra 96 | Assisted dip | imported | assisted-dip | Assisted dip |
| extra 97 | Machine lateral raise | imported | machine-lateral-raise | Machine lateral raise |
| extra 98 | Reverse pec deck | imported | reverse-pec-deck | Reverse pec deck |
| extra 99 | Machine biceps curl | imported | machine-curl | Machine biceps curl |
| extra 100 | Machine triceps extension | imported | machine-triceps-extension | Machine triceps extension |
| extra 101 | Hack squat | imported | hack-squat | Hack squat |
| extra 102 | Belt squat | imported | belt-squat | Belt squat |
| extra 103 | Pendulum squat | imported | pendulum-squat | Pendulum squat |
| extra 104 | Seated leg curl | imported | seated-leg-curl | Seated leg curl |
| extra 105 | Lying leg curl | imported | lying-leg-curl | Lying leg curl |
| extra 106 | Machine hip abduction | imported | hip-abduction-machine | Machine hip abduction |
| extra 107 | Machine hip adduction | imported | hip-adduction-machine | Machine hip adduction |
| extra 108 | Machine glute kickback | imported | machine-glute-kickback | Machine glute kickback |
| extra 109 | Machine abdominal crunch | imported | machine-crunch | Machine abdominal crunch |
| extra 110 | Single-arm cable row | imported | single-arm-cable-row | Single-arm cable row |
| extra 111 | Wide-grip cable row | imported | wide-cable-row | Wide-grip cable row |
| extra 112 | Cable straight-arm pulldown | imported | cable-straight-arm-pulldown | Cable straight-arm pulldown |
| extra 113 | Single-arm cable pulldown | imported | single-arm-pulldown | Single-arm cable pulldown |
| extra 114 | Cable lateral raise | imported | cable-lateral-raise | Cable lateral raise |
| extra 115 | Cable rear delt fly | imported | cable-rear-delt-fly | Cable rear delt fly |
| extra 116 | Cable front raise | imported | cable-front-raise | Cable front raise |
| extra 117 | Cable chest press | imported | cable-chest-press | Cable chest press |
| extra 118 | Low-to-high cable fly | imported | low-high-cable-fly | Low-to-high cable fly |
| extra 119 | High-to-low cable fly | imported | high-low-cable-fly | High-to-low cable fly |
| extra 120 | Cable biceps curl | imported | cable-curl | Cable biceps curl |
| extra 121 | Cable hammer curl | imported | cable-hammer-curl | Cable hammer curl |
| extra 122 | Cable overhead triceps extension | imported | cable-overhead-extension | Cable overhead triceps extension |
| extra 123 | Cable Pallof press | imported | cable-pallof-press | Cable Pallof press |
| extra 124 | Cable wood chop | imported | cable-wood-chop | Cable wood chop |
| extra 125 | Kettlebell Romanian deadlift | imported | kb-rdl | Kettlebell Romanian deadlift |
| extra 126 | Kettlebell sumo deadlift | imported | kb-sumo-deadlift | Kettlebell sumo deadlift |
| extra 127 | Kettlebell single-leg deadlift | imported | kb-single-leg-deadlift | Kettlebell single-leg deadlift |
| extra 128 | Kettlebell front-rack squat | imported | kb-front-rack-squat | Kettlebell front-rack squat |
| extra 129 | Kettlebell reverse lunge | imported | kb-reverse-lunge | Kettlebell reverse lunge |
| extra 130 | Kettlebell floor press | imported | kb-floor-press | Kettlebell floor press |
| extra 131 | Kettlebell row | imported | kb-row | Kettlebell row |
| extra 132 | Kettlebell strict press | imported | kb-strict-press | Kettlebell strict press |
| extra 133 | Kettlebell halo | imported | kb-halo | Kettlebell halo |
| extra 134 | Kettlebell suitcase march | imported | kb-suitcase-march | Kettlebell suitcase march |
| extra 135 | Suspension row | imported | suspension-row | Suspension row |
| extra 136 | Stability ball hamstring curl | imported | ball-hamstring-curl | Stability ball hamstring curl |
| extra 137 | Slider reverse lunge | imported | slider-reverse-lunge | Slider reverse lunge |
| extra 138 | Kneeling ab wheel rollout | imported | ab-wheel-rollout | Kneeling ab wheel rollout |
| extra 139 | Parallel-bar dip | existing | dip | Dip |
