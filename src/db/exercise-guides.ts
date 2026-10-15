/**
 * Hand-written how-to guides for the starter exercises, keyed by exercise name. The rest of the
 * library (exercise-library.json) stores its steps in the exercises table instead.
 *
 * Every preview is an animated illustration with the worked muscles in red, from ExerciseGymGifsDB
 * (github.com/JahelCuadrado/ExerciseGymGifsDB), served by the jsDelivr CDN. The repo pins a release
 * tag so URLs never change. GIFs load from the network once, then expo-image caches them on disk.
 */
export type ExerciseGuide = {
  /** Path of the GIF in ExerciseGymGifsDB, without extension. */
  gif: string;
  muscles: { primary: string[]; secondary: string[] };
  steps: string[];
  tips: string[];
};

const GIF_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0';

/** URL of an exercise GIF from its path in ExerciseGymGifsDB (the `gif` column of exercises). */
export function gifUrl(path: string) {
  return `${GIF_BASE}/${path}.gif`;
}

export function getGuide(name: string): ExerciseGuide | undefined {
  return EXERCISE_GUIDES[name];
}

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  'Bench Press': {
    gif: 'pectorals/barbell-bench-press',
    muscles: { primary: ['Chest'], secondary: ['Front delts', 'Triceps'] },
    steps: [
      'Lie on the bench with your eyes under the bar, feet flat on the floor.',
      'Grip the bar slightly wider than shoulder width and unrack it over your shoulders.',
      'Lower the bar under control to your mid-chest, elbows about 45° from your body.',
      'Press back up until your arms are straight.',
    ],
    tips: ['Squeeze your shoulder blades together and keep them pinned.', 'Keep your butt on the bench.'],
  },
  'Incline Bench Press': {
    gif: 'pectorals/barbell-incline-bench-press',
    muscles: { primary: ['Upper chest'], secondary: ['Front delts', 'Triceps'] },
    steps: [
      'Set the bench to 30–45° and lie back with your feet planted.',
      'Unrack the bar with a grip slightly wider than your shoulders.',
      'Lower it to your upper chest, just below the collarbone.',
      'Press up and slightly back until your arms lock out.',
    ],
    tips: ['A lower incline keeps more of the work on the chest.', 'Keep your wrists stacked over your elbows.'],
  },
  'Dumbbell Bench Press': {
    gif: 'pectorals/dumbbell-bench-press',
    muscles: { primary: ['Chest'], secondary: ['Front delts', 'Triceps'] },
    steps: [
      'Sit with the dumbbells on your thighs, then lie back and bring them to chest level.',
      'Press them up until your arms are straight over your chest.',
      'Lower slowly until the dumbbells are beside your chest.',
      'Press back up, bringing them close together at the top.',
    ],
    tips: ['Go deeper than a barbell allows, but stay in control.', 'Keep your shoulder blades back.'],
  },
  'Incline Dumbbell Press': {
    gif: 'pectorals/dumbbell-incline-bench-press',
    muscles: { primary: ['Upper chest'], secondary: ['Front delts', 'Triceps'] },
    steps: [
      'Set the bench to 30–45° and kick the dumbbells up to shoulder level.',
      'Press them up over your upper chest.',
      'Lower slowly until they are beside your upper chest.',
      'Press back up.',
    ],
    tips: ['Keep your elbows slightly tucked, not flared straight out.'],
  },
  'Chest Fly': {
    gif: 'pectorals/lever-seated-fly',
    muscles: { primary: ['Chest'], secondary: ['Front delts'] },
    steps: [
      'Adjust the seat so the handles are at chest height and sit with your back flat on the pad.',
      'Grab the handles with a slight bend in your elbows.',
      'Bring the handles together in front of your chest in a hugging motion.',
      'Open back up slowly until you feel a stretch in your chest.',
    ],
    tips: ['Keep the elbow bend fixed; it is not a press.', 'Squeeze for a second when the handles meet.'],
  },
  'Cable Crossover': {
    gif: 'pectorals/cable-standing-fly',
    muscles: { primary: ['Chest'], secondary: ['Front delts'] },
    steps: [
      'Set both pulleys high and take a handle in each hand.',
      'Step forward into a staggered stance with a slight lean.',
      'With soft elbows, bring the handles down and together in front of your hips.',
      'Return slowly until your arms are out wide.',
    ],
    tips: ['Lead with your hands, not your shoulders.', 'Use a weight you can control on the way back.'],
  },
  'Push-up': {
    gif: 'pectorals/push-up',
    muscles: { primary: ['Chest'], secondary: ['Triceps', 'Front delts', 'Core'] },
    steps: [
      'Start in a high plank, hands slightly wider than your shoulders.',
      'Keep your body in a straight line from head to heels.',
      'Lower until your chest nearly touches the floor.',
      'Push back up to straight arms.',
    ],
    tips: ['Brace your core and squeeze your glutes so your hips do not sag.', 'Elbows about 45° from your body.'],
  },
  Dip: {
    gif: 'pectorals/chest-dip',
    muscles: { primary: ['Lower chest', 'Triceps'], secondary: ['Front delts'] },
    steps: [
      'Support yourself on the bars with straight arms.',
      'Lean your torso forward slightly.',
      'Lower until your upper arms are about parallel to the floor.',
      'Push back up to straight arms.',
    ],
    tips: ['Leaning forward targets the chest; staying upright targets the triceps.', 'Do not drop too deep if your shoulders hurt.'],
  },
  Deadlift: {
    gif: 'glutes/barbell-deadlift',
    muscles: { primary: ['Glutes', 'Hamstrings', 'Lower back'], secondary: ['Upper back', 'Forearms', 'Quads'] },
    steps: [
      'Stand with your mid-foot under the bar, feet hip-width apart.',
      'Hinge down and grip the bar just outside your legs.',
      'Bend your knees until your shins touch the bar, chest up, back flat.',
      'Push the floor away and stand up tall, keeping the bar against your legs.',
      'Lower it by pushing your hips back, then bending your knees.',
    ],
    tips: ['Take a big breath and brace before each rep.', 'Never let your lower back round.'],
  },
  'Barbell Row': {
    gif: 'upper-back/barbell-bent-over-row',
    muscles: { primary: ['Lats', 'Upper back'], secondary: ['Rear delts', 'Biceps'] },
    steps: [
      'Hold the bar with an overhand grip, slightly wider than your shoulders.',
      'Hinge forward until your torso is near 45° or lower, knees soft.',
      'Pull the bar to your lower chest or upper stomach.',
      'Lower it under control until your arms are straight.',
    ],
    tips: ['Keep your back flat and your torso still.', 'Drive your elbows back, not up.'],
  },
  'Dumbbell Row': {
    gif: 'upper-back/dumbbell-one-arm-bent-over-row',
    muscles: { primary: ['Lats', 'Upper back'], secondary: ['Rear delts', 'Biceps'] },
    steps: [
      'Put one knee and the same-side hand on a bench, back flat.',
      'Hold the dumbbell in the other hand with your arm straight.',
      'Row it to your hip, keeping your elbow close.',
      'Lower it slowly to a full stretch.',
    ],
    tips: ['Think "elbow to back pocket".', 'Do not twist your torso to lift heavier.'],
  },
  'Pull-up': {
    gif: 'lats/pull-up',
    muscles: { primary: ['Lats'], secondary: ['Biceps', 'Upper back', 'Forearms'] },
    steps: [
      'Hang from the bar with an overhand grip a bit wider than your shoulders.',
      'Pull your shoulder blades down, then pull until your chin is over the bar.',
      'Lower all the way to straight arms.',
    ],
    tips: ['Avoid kipping or swinging.', 'Use an assisted machine or band until you can do clean reps.'],
  },
  'Chin-up': {
    gif: 'lats/chin-up',
    muscles: { primary: ['Lats', 'Biceps'], secondary: ['Upper back', 'Forearms'] },
    steps: [
      'Hang from the bar with an underhand grip at shoulder width.',
      'Pull until your chin clears the bar.',
      'Lower slowly to straight arms.',
    ],
    tips: ['Underhand grip brings in more biceps than a pull-up.', 'Keep your chest up.'],
  },
  'Lat Pulldown': {
    gif: 'lats/cable-bar-lateral-pulldown',
    muscles: { primary: ['Lats'], secondary: ['Biceps', 'Upper back', 'Rear delts'] },
    steps: [
      'Sit with your thighs under the pads and grab the bar wider than your shoulders.',
      'Lean back slightly and pull the bar to your upper chest.',
      'Return it slowly until your arms are fully extended.',
    ],
    tips: ['Lead with your elbows down toward your hips.', 'Do not lean way back to move the weight.'],
  },
  'Seated Cable Row': {
    gif: 'upper-back/cable-seated-row',
    muscles: { primary: ['Upper back', 'Lats'], secondary: ['Rear delts', 'Biceps'] },
    steps: [
      'Sit with your feet on the platform and knees slightly bent.',
      'Grab the handle with straight arms and sit up tall.',
      'Pull the handle to your stomach, squeezing your shoulder blades together.',
      'Let your arms straighten slowly.',
    ],
    tips: ['Keep your torso mostly still; do not rock.', 'Keep your chest up.'],
  },
  'T-Bar Row': {
    gif: 'upper-back/lever-t-bar-row',
    muscles: { primary: ['Upper back', 'Lats'], secondary: ['Rear delts', 'Biceps'] },
    steps: [
      'Straddle the bar and grab the handle.',
      'Hinge forward with a flat back and soft knees.',
      'Row the weight toward your chest.',
      'Lower it until your arms are straight.',
    ],
    tips: ['Keep your back flat throughout.', 'Pause briefly at the top.'],
  },
  'Overhead Press': {
    gif: 'delts/barbell-standing-wide-military-press',
    muscles: { primary: ['Front delts'], secondary: ['Side delts', 'Triceps', 'Upper chest'] },
    steps: [
      'Hold the bar on your front shoulders, hands just outside shoulder width.',
      'Brace your core and squeeze your glutes.',
      'Press the bar straight up, moving your head back so it passes your face.',
      'Lock out overhead with the bar over your mid-foot, then lower to your shoulders.',
    ],
    tips: ['Do not lean back to finish the rep.', 'Keep your forearms vertical.'],
  },
  'Dumbbell Shoulder Press': {
    gif: 'delts/dumbbell-seated-shoulder-press',
    muscles: { primary: ['Front delts'], secondary: ['Side delts', 'Triceps'] },
    steps: [
      'Sit on an upright bench with the dumbbells at shoulder height.',
      'Press them overhead until your arms are straight.',
      'Lower slowly back to shoulder height.',
    ],
    tips: ['Keep your back against the pad.', 'Do not clash the dumbbells at the top.'],
  },
  'Lateral Raise': {
    gif: 'delts/dumbbell-lateral-raise',
    muscles: { primary: ['Side delts'], secondary: ['Traps'] },
    steps: [
      'Stand holding the dumbbells at your sides with a slight elbow bend.',
      'Raise your arms out to the side until they reach shoulder height.',
      'Lower slowly.',
    ],
    tips: ['Lead with your elbows.', 'Go light: swinging takes the work off your shoulders.'],
  },
  'Cable Lateral Raise': {
    gif: 'delts/cable-lateral-raise',
    muscles: { primary: ['Side delts'], secondary: ['Traps'] },
    steps: [
      'Set the pulley low and hold the handle with the hand farthest from the machine.',
      'Raise your arm out to the side until it reaches shoulder height.',
      'Lower slowly, resisting the cable.',
    ],
    tips: ['The cable keeps tension at the bottom, so start light.'],
  },
  'Rear Delt Fly': {
    gif: 'delts/dumbbell-rear-fly',
    muscles: { primary: ['Rear delts'], secondary: ['Upper back', 'Traps'] },
    steps: [
      'Sit at the end of a bench and lean your chest toward your thighs.',
      'Hold the dumbbells under your legs with soft elbows.',
      'Raise them out to the side until your arms are about level with your back.',
      'Lower slowly.',
    ],
    tips: ['Do not squeeze your shoulder blades hard; let the rear delts do the work.'],
  },
  'Face Pull': {
    gif: 'delts/cable-standing-rear-delt-row-with-rope',
    muscles: { primary: ['Rear delts'], secondary: ['Upper back', 'Rotator cuff'] },
    steps: [
      'Set a rope at upper-chest height or higher.',
      'Grab the rope with palms facing each other and step back.',
      'Pull the rope toward your face, spreading the ends apart.',
      'Return slowly.',
    ],
    tips: ['Finish with your hands beside your ears, elbows high.', 'Great for shoulder health; keep it light.'],
  },
  'Barbell Curl': {
    gif: 'biceps/barbell-curl',
    muscles: { primary: ['Biceps'], secondary: ['Forearms'] },
    steps: [
      'Stand holding the bar with an underhand grip at shoulder width.',
      'Keep your elbows at your sides and curl the bar up.',
      'Squeeze at the top, then lower slowly to straight arms.',
    ],
    tips: ['Do not swing with your back.', 'Keep your elbows from drifting forward.'],
  },
  'Dumbbell Curl': {
    gif: 'biceps/dumbbell-biceps-curl',
    muscles: { primary: ['Biceps'], secondary: ['Forearms'] },
    steps: [
      'Stand with a dumbbell in each hand, palms facing forward.',
      'Curl the weights up, keeping your elbows at your sides.',
      'Lower slowly to straight arms.',
    ],
    tips: ['Turn your pinkies up slightly at the top for a stronger squeeze.'],
  },
  'Hammer Curl': {
    gif: 'biceps/dumbbell-hammer-curl',
    muscles: { primary: ['Brachialis', 'Biceps'], secondary: ['Forearms'] },
    steps: [
      'Hold the dumbbells at your sides with palms facing each other.',
      'Curl them up without rotating your wrists.',
      'Lower slowly.',
    ],
    tips: ['Works the forearms and the outer biceps.', 'Keep your elbows pinned.'],
  },
  'Preacher Curl': {
    gif: 'biceps/barbell-preacher-curl',
    muscles: { primary: ['Biceps'], secondary: ['Forearms'] },
    steps: [
      'Sit with the back of your upper arms flat on the pad.',
      'Hold the bar or handles with an underhand grip.',
      'Curl up until your forearms are near vertical.',
      'Lower slowly until your arms are almost straight.',
    ],
    tips: ['Control the bottom; that is where the stretch is.'],
  },
  'Cable Curl': {
    gif: 'biceps/cable-curl',
    muscles: { primary: ['Biceps'], secondary: ['Forearms'] },
    steps: [
      'Attach a bar to a low pulley and hold it with an underhand grip.',
      'Stand tall with your elbows at your sides.',
      'Curl the bar up toward your chest.',
      'Lower slowly.',
    ],
    tips: ['The cable keeps tension on the whole rep.'],
  },
  'Triceps Pushdown': {
    gif: 'triceps/cable-pushdown',
    muscles: { primary: ['Triceps'], secondary: [] },
    steps: [
      'Attach a bar or rope to a high pulley and grab it.',
      'Tuck your elbows at your sides.',
      'Push down until your arms are straight.',
      'Let it rise slowly until your forearms are just above parallel.',
    ],
    tips: ['Only your forearms should move.', 'Do not lean over the weight.'],
  },
  'Overhead Triceps Extension': {
    gif: 'triceps/cable-overhead-triceps-extension-rope-attachment',
    muscles: { primary: ['Triceps (long head)'], secondary: [] },
    steps: [
      'Attach a rope to the pulley, face away, and hold it behind your head.',
      'Stagger your feet and lean forward slightly.',
      'Extend your arms forward and up until they are straight.',
      'Bend your elbows slowly to return.',
    ],
    tips: ['Keep your elbows pointing forward, not flaring out.'],
  },
  'Skull Crusher': {
    gif: 'triceps/barbell-lying-triceps-extension-skull-crusher',
    muscles: { primary: ['Triceps'], secondary: [] },
    steps: [
      'Lie on a bench holding the bar over your chest with straight arms.',
      'Bend only your elbows to lower the bar toward your forehead.',
      'Extend back up to straight arms.',
    ],
    tips: ['Keep your upper arms still.', 'Lowering the bar slightly behind your head adds stretch.'],
  },
  'Close-Grip Bench Press': {
    gif: 'triceps/barbell-close-grip-bench-press',
    muscles: { primary: ['Triceps'], secondary: ['Chest', 'Front delts'] },
    steps: [
      'Lie on the bench and grip the bar about shoulder width.',
      'Lower the bar to your lower chest with your elbows close to your body.',
      'Press back up to lockout.',
    ],
    tips: ['Grip too narrow strains the wrists; shoulder width is enough.'],
  },
  'Back Squat': {
    gif: 'glutes/barbell-full-squat',
    muscles: { primary: ['Quads', 'Glutes'], secondary: ['Adductors', 'Hamstrings', 'Lower back', 'Core'] },
    steps: [
      'Set the bar on your upper back and unrack it, feet shoulder-width apart.',
      'Brace, then sit down and back, pushing your knees out over your toes.',
      'Go down until your hips are at least level with your knees.',
      'Drive back up through your whole foot.',
    ],
    tips: ['Keep your chest up and your heels down.', 'Use the safety bars when training heavy.'],
  },
  'Front Squat': {
    gif: 'glutes/barbell-front-squat',
    muscles: { primary: ['Quads'], secondary: ['Glutes', 'Upper back', 'Core'] },
    steps: [
      'Rest the bar on your front shoulders with your elbows high.',
      'Squat down, keeping your torso upright.',
      'Go as deep as you can with your elbows still up.',
      'Stand back up.',
    ],
    tips: ['If the grip hurts your wrists, cross your arms over the bar.'],
  },
  'Leg Press': {
    gif: 'glutes/sled-45-leg-press',
    muscles: { primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Adductors'] },
    steps: [
      'Sit with your back flat and feet shoulder-width on the platform.',
      'Release the safeties and lower the platform until your knees are near 90°.',
      'Press back up without locking your knees.',
    ],
    tips: ['Do not let your lower back lift off the pad.', 'Higher feet work more glutes; lower feet more quads.'],
  },
  'Hack Squat': {
    gif: 'glutes/sled-hack-squat',
    muscles: { primary: ['Quads'], secondary: ['Glutes'] },
    steps: [
      'Stand on the platform with your back against the pad and shoulders under the pads.',
      'Release the safeties and squat down as deep as is comfortable.',
      'Push back up through your feet.',
    ],
    tips: ['Keep your heels down and your knees tracking over your toes.'],
  },
  'Leg Extension': {
    gif: 'quads/lever-leg-extension',
    muscles: { primary: ['Quads'], secondary: [] },
    steps: [
      'Sit with the pad on your lower shins and knees in line with the pivot.',
      'Extend your legs until they are straight.',
      'Squeeze, then lower slowly.',
    ],
    tips: ['Hold the handles to stay in the seat.'],
  },
  'Bulgarian Split Squat': {
    gif: 'quads/dumbbell-single-leg-split-squat',
    muscles: { primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Adductors'] },
    steps: [
      'Stand facing away from a bench and rest the top of your back foot on it.',
      'Hold dumbbells at your sides.',
      'Lower until your front thigh is about parallel to the floor.',
      'Drive up through your front foot. Finish all reps, then switch legs.',
    ],
    tips: ['Leaning forward works more glutes; staying upright works more quads.'],
  },
  'Walking Lunge': {
    gif: 'glutes/walking-lunge',
    muscles: { primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Calves'] },
    steps: [
      'Hold dumbbells at your sides and take a long step forward.',
      'Lower until your back knee nearly touches the floor.',
      'Push through your front foot and step through into the next lunge.',
    ],
    tips: ['Keep your torso upright.', 'Count each leg as one rep, or log per leg; be consistent.'],
  },
  'Romanian Deadlift': {
    gif: 'glutes/barbell-romanian-deadlift',
    muscles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Lower back', 'Forearms'] },
    steps: [
      'Stand holding the bar at your hips, knees slightly bent.',
      'Push your hips back and slide the bar down your thighs.',
      'Stop when you feel a strong hamstring stretch, usually just below the knees.',
      'Drive your hips forward to stand up.',
    ],
    tips: ['Keep your back flat; the movement is at the hips, not the knees.'],
  },
  'Lying Leg Curl': {
    gif: 'hamstrings/lever-lying-leg-curl',
    muscles: { primary: ['Hamstrings'], secondary: ['Calves'] },
    steps: [
      'Lie face down with the pad just above your heels.',
      'Curl your heels toward your glutes.',
      'Lower slowly to almost straight legs.',
    ],
    tips: ['Keep your hips pressed into the pad.'],
  },
  'Seated Leg Curl': {
    gif: 'hamstrings/lever-seated-leg-curl',
    muscles: { primary: ['Hamstrings'], secondary: ['Calves'] },
    steps: [
      'Sit with the pad behind your lower calves and the thigh pad locked down.',
      'Curl your legs down and back as far as you can.',
      'Return slowly.',
    ],
    tips: ['Lean forward slightly for a better hamstring stretch.'],
  },
  'Hip Thrust': {
    gif: 'glutes/barbell-glute-bridge',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Quads'] },
    steps: [
      'Sit with your upper back against a bench and a padded bar over your hips.',
      'Plant your feet about shoulder-width apart.',
      'Drive through your heels to lift your hips until your body is flat from knees to shoulders.',
      'Squeeze your glutes, then lower.',
    ],
    tips: [
      'The animation shows the floor version (glute bridge); the hip thrust is the same movement with your upper back on a bench.',
      'Tuck your chin and keep your ribs down; do not arch your lower back.',
    ],
  },
  'Glute Kickback': {
    gif: 'glutes/cable-standing-hip-extension',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings'] },
    steps: [
      'Attach an ankle strap to a low pulley and face the machine.',
      'Hold the frame and kick your leg straight back.',
      'Squeeze your glute at the top, then return slowly.',
    ],
    tips: ['Do not arch your back to kick higher.'],
  },
  'Hip Abduction': {
    gif: 'abductors/lever-seated-hip-abduction',
    muscles: { primary: ['Glutes (side)'], secondary: [] },
    steps: [
      'Sit with the pads on the outside of your knees.',
      'Push your legs apart as far as you can.',
      'Return slowly.',
    ],
    tips: ['Leaning forward slightly works more glutes.'],
  },
  'Standing Calf Raise': {
    gif: 'calves/lever-standing-calf-raise',
    muscles: { primary: ['Calves'], secondary: [] },
    steps: [
      'Stand with the balls of your feet on the edge and the shoulder pads on you.',
      'Lower your heels for a deep stretch.',
      'Rise as high as you can onto your toes.',
    ],
    tips: ['Pause at the bottom and the top; do not bounce.'],
  },
  'Seated Calf Raise': {
    gif: 'calves/lever-seated-calf-raise',
    muscles: { primary: ['Calves (soleus)'], secondary: [] },
    steps: [
      'Sit with the pad on your lower thighs and the balls of your feet on the platform.',
      'Lower your heels as far as possible.',
      'Push up onto your toes and squeeze.',
    ],
    tips: ['Use a full range of motion; the stretch matters.'],
  },
  Plank: {
    gif: 'abs/weighted-front-plank',
    muscles: { primary: ['Abs'], secondary: ['Obliques', 'Shoulders', 'Glutes'] },
    steps: [
      'Rest on your forearms with your elbows under your shoulders.',
      'Lift your hips so your body is straight from head to heels.',
      'Hold the position.',
    ],
    tips: [
      'The animation uses a plate on the back; start with just your bodyweight.',
      'Squeeze your glutes and brace your abs.',
      'Log the seconds held in the reps column.',
    ],
  },
  'Hanging Leg Raise': {
    gif: 'abs/hanging-leg-raise',
    muscles: { primary: ['Abs'], secondary: ['Hip flexors', 'Obliques', 'Forearms'] },
    steps: [
      'Hang from a bar with straight arms.',
      'Raise your legs, straight or bent, until your thighs pass parallel.',
      'Lower slowly without swinging.',
    ],
    tips: ['Curl your pelvis up at the top to really work the abs.'],
  },
  'Cable Crunch': {
    gif: 'abs/cable-kneeling-crunch',
    muscles: { primary: ['Abs'], secondary: ['Obliques'] },
    steps: [
      'Kneel facing a high pulley with a rope held beside your head.',
      'Crunch down, bringing your elbows toward your knees.',
      'Return slowly.',
    ],
    tips: ['Your hips should stay still; round your spine instead.'],
  },
  'Ab Wheel Rollout': {
    gif: 'abs/wheel-rollerout',
    muscles: { primary: ['Abs'], secondary: ['Lats', 'Shoulders', 'Lower back'] },
    steps: [
      'Kneel holding the wheel under your shoulders.',
      'Roll forward slowly, keeping your core tight.',
      'Go as far as you can without your lower back sagging.',
      'Pull back to the start using your abs.',
    ],
    tips: ['Start with short rollouts and increase the range over time.'],
  },
  'Wrist Curl': {
    gif: 'forearms/dumbbell-seated-palms-up-wrist-curl',
    muscles: { primary: ['Forearms'], secondary: [] },
    steps: [
      'Sit with your forearms on your thighs, palms up, wrists past your knees.',
      'Let the dumbbells roll down toward your fingers.',
      'Curl your wrists up as high as you can.',
    ],
    tips: ['Use high reps and a slow tempo.'],
  },
  "Farmer's Carry": {
    gif: 'quads/farmers-walk',
    muscles: { primary: ['Forearms', 'Traps'], secondary: ['Core', 'Shoulders', 'Legs'] },
    steps: [
      'Pick up heavy dumbbells, one in each hand.',
      'Stand tall with your shoulders back.',
      'Walk with short, controlled steps for a set distance or time.',
    ],
    tips: ['Do not let the weights pull your shoulders forward.', 'Log meters or seconds in the reps column.'],
  },
};
