/**
 * DEFY AI Coach — Multi-Scenario Conversational & Athletic Engine
 * - Reads API key from .env
 * - Trained with explicit scenario blueprints (Casual Conversation, Motivation/Fatigue,
 *   Dynamic Food & Meal Planning, Activity & Workout Programming, Injury/Mobility,
 *   Supplement/Recovery, and Live Profile/History Recall).
 * - Adapts naturally to normal casual chat without needlessly dumping stats tables,
 *   while dynamically calculating and formatting plans using the athlete's latest editable metrics.
 */
const fs = require('fs');
const path = require('path');
const { buildCrossConversationContext } = require('./historyStore');

function loadEnvApiKey() {
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY.trim();
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY.trim();

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'AI_API_KEY' || key === 'GEMINI_API_KEY' || key === 'GOOGLE_API_KEY') {
          return val;
        }
      }
    }
  }
  return '';
}

/**
 * System prompt with explicit scenario-based training & few-shot examples so the AI
 * knows exactly how to respond to casual conversation vs. food planning vs. activity planning.
 */
const DEFY_SCENARIO_TRAINING_PROMPT = `You are "Defy Coach" — an elite, personable, and motivating sports scientist, nutrition strategist, and athletic coach for DEFY.
Never mention any AI model name or provider.

=== SCENARIO TRAINING & RESPONSE RULES ===

SCENARIO 1: CASUAL CONVERSATION, GREETINGS & SMALL TALK
- Trigger: The user says "hey", "how are you?", "good morning", "thanks!", "tell me a joke", "what's up", or chats casually.
- Behavior: Respond naturally, warmly, and conversationally like a real human coach and friend. DO NOT dump workout tables or list out their full stats unless they ask for them. Keep it brief (2–4 sentences), personable, and supportive.

SCENARIO 2: LOW MOTIVATION, FATIGUE, STRESS OR BUSY SCHEDULE
- Trigger: The user says "I'm exhausted today", "don't feel like working out", "had a rough day at work/exams", "only have 20 minutes".
- Behavior: Empathize first—validate how they feel without guilt-tripping. Offer a practical down-regulated option (e.g., a 15-minute minimum-effective-dose pump, a restorative mobility flow, or taking an active recovery walk) so they keep the habit alive without burning out.

SCENARIO 3: FOOD PLANNING GUIDE & MACRO / MEAL STRATEGY
- Trigger: The user asks for a meal plan, diet guide, post-workout meal, snack ideas, restaurant eating tips, or macro breakdown.
- Behavior: Dynamically tailor the meals to their LIVE edited calorie and macro targets (Calories, Protein, Carbs, Fats, and Diet Protocol from the Live Athlete Profile block). Present meal plans in a clean Markdown Table with exact portion sizes, protein grams, and calories, plus practical preparation tips.

SCENARIO 4: ACTIVITY PLANNING, WORKOUT SPLITS & SPORTS CONDITIONING
- Trigger: The user asks for a workout split, gym routine, running/5K plan, HIIT session, outdoor activity plan, or weekend conditioning.
- Behavior: Engineer a structured activity or lifting plan aligned with their current bodyweight, goal, and split. Use a clear Markdown Table (Day/Phase | Activity/Exercise | Sets×Reps or Duration | Intensity/RPE | Coaching Cue) and include progressive overload or pacing rules.

SCENARIO 5: INJURY, SORENESS & BIOMECHANICS TROUBLESHOOTING
- Trigger: The user reports tightness, soreness, joint pain (lower back, knees, shoulders), or form breakdown.
- Behavior: Diagnose likely biomechanical causes (e.g., hip flexor tightness, ankle dorsiflexion, core bracing) and prescribe a phased decompression + activation protocol before their next heavy session.

SCENARIO 6: LIVE METRIC UPDATES & CROSS-CONVERSATION HISTORY RECALL
- Trigger: The user edits their weight/intakes in the dashboard, or asks "what do you remember about me?", "did you get my new weight/calories?", or references a past chat.
- Behavior: Immediately acknowledge their latest edited numbers (weight, calories, protein, carbs, fats, goal) and any facts from previous sessions stored in the memory block. Explain how their updated metrics shift their nutrition or training targets.`;

/**
 * Classifies user message into one of the trained coaching scenarios.
 */
function classifyScenario(userText) {
  const clean = userText.trim();
  const lower = clean.toLowerCase();

  // 1. Check for profile/metric update acknowledgement or history recall
  if (
    lower.includes('history') ||
    lower.includes('remember') ||
    lower.includes('past session') ||
    lower.includes('previous conversation') ||
    lower.includes('what do you know about me') ||
    lower.includes('my new weight') ||
    lower.includes('updated my') ||
    lower.includes('changed my') ||
    lower.includes('new calories') ||
    lower.includes('new intake') ||
    lower.includes('my stats')
  ) {
    return 'HISTORY_AND_METRICS';
  }

  // 2. Check for Motivation / Fatigue / Busy / Stress scenario
  if (
    /\b(tired|exhausted|no motivation|unmotivated|lazy|skip|don't feel like|do not feel like|stressed|stress|busy|exam|rough day|bad day|burnout|burnt out|overwhelmed|sleepy)\b/i.test(lower)
  ) {
    return 'MOTIVATION_FATIGUE';
  }

  // 3. Check for Injury / Mobility / Pain scenario
  if (
    /\b(pain|hurt|hurts|tightness|stiffness|stiff|sore|soreness|injury|injured|rehab|mobility|stretch|stretching|lower back|knee|shoulder|elbow|wrist|ankle)\b/i.test(lower)
  ) {
    return 'INJURY_MOBILITY';
  }

  // 4. Check for Food Planning / Diet / Nutrition scenario
  if (
    /\b(food|meal|diet|eat|eating|nutrition|protein|carb|carbs|fat|fats|calorie|calories|kcal|breakfast|lunch|dinner|snack|paneer|soya|dal|whey|cook|recipe|hungry|craving|hydration|water|creatine|supplement)\b/i.test(lower)
  ) {
    return 'FOOD_PLANNING';
  }

  // 5. Check for Activity Planning / Workout / Conditioning scenario
  if (
    /\b(workout|split|push|pull|leg|legs|upper|lower|chest|back|arms|biceps|triceps|abs|core|squat|deadlift|bench|hiit|cardio|run|running|5k|10k|marathon|swim|swimming|cycle|cycling|activity|exercise|routine|program|train|training|gym|finisher|stamina|conditioning)\b/i.test(lower)
  ) {
    return 'ACTIVITY_PLANNING';
  }

  // 6. Check for Casual Conversation / Greetings / Gratitude / Off-topic friendly chat
  if (
    /^(hi|hey|hello|yo|sup|what's up|whats up|good morning|good evening|good afternoon|howdy|namaste)\b/i.test(lower) ||
    /\b(how are you|how's it going|hows it going|who are you|what can you do|thank you|thanks|appreciate it|awesome|cool|nice|great|bye|see ya|good night|joke|funny)\b/i.test(lower) ||
    clean.split(/\s+/).length <= 5
  ) {
    return 'CASUAL_CONVO';
  }

  return 'GENERAL_COACHING';
}

/**
 * Scenario 1 Handler: Natural, warm casual conversation without dumping stats tables.
 */
function buildCasualResponse(userText, historyContext) {
  const lower = userText.trim().toLowerCase();
  const p = historyContext.profile;
  const firstName = (p.name || 'Arjun').split(' ')[0];

  if (/^(hi|hey|hello|yo|sup|what's up|whats up|good morning|good afternoon|good evening|namaste)/i.test(lower) && lower.length < 28) {
    return `Hey ${firstName}! Good to see you here. How is your energy feeling today—are we looking to plan out your meals, dial in a workout or activity, or just taking it easy today?`;
  }

  if (/\b(how are you|how's it going|hows it going)\b/i.test(lower)) {
    return `Doing great, ${firstName}—always fired up to talk training, good food, or recovery! More importantly, how are you feeling today? How did your body recover from your last session?`;
  }

  if (/\b(thank you|thanks|appreciate|awesome|great|perfect|got it)\b/i.test(lower)) {
    return `Anytime, ${firstName}! You're putting in the work—I'm just here to help steer the ship. Let me know whenever you want to tweak a meal, adjust an exercise, or just chat.`;
  }

  if (/\b(joke|funny|make me laugh)\b/i.test(lower)) {
    return `Why do bodybuilders and strength athletes make terrible comedians? Because they always take **3 minutes of rest** before delivering the punchline! 😄\n\nWhenever you're ready to get after it today, just say the word.`;
  }

  if (/\b(who are you|what can you do|help)\b/i.test(lower)) {
    return `I'm **Defy Coach**—think of me as your training partner, sports nutritionist, and sounding board rolled into one.\n\nWe can just chat casually about how your day is going, or whenever you need structure, I can build you:\n- **Custom Food & Meal Guides** automatically scaled to your live calorie & macro settings (${p.calories} kcal / ${p.macros.protein}g protein right now)\n- **Activity & Workout Plans** (gym splits, 5K running, HIIT, outdoor conditioning, or quick 20-minute busy-day sessions)\n- **Mobility & Recovery Fixes** if anything feels tight or sore.`;
  }

  if (/\b(bye|good night|see ya|talk later)\b/i.test(lower)) {
    return `Catch you later, ${firstName}! Hydrate well, get some quality sleep tonight, and I'll see you next session.`;
  }

  return `I hear you, ${firstName}! Whether you just want to talk through your week, adjust your food plan, or map out an activity for today, I'm right here. What's on your mind?`;
}

/**
 * Scenario 2 Handler: Empathetic coaching for fatigue, stress, busy days, or low motivation.
 */
function buildMotivationFatigueResponse(userText, historyContext) {
  const p = historyContext.profile;
  const firstName = (p.name || 'Arjun').split(' ')[0];
  const lower = userText.toLowerCase();

  if (lower.includes('busy') || lower.includes('20 min') || lower.includes('15 min') || lower.includes('no time') || lower.includes('exam') || lower.includes('work')) {
    return `I completely get it, ${firstName}—life and deadlines come in waves, and an all-or-nothing mindset is the enemy of consistency. On crazy busy days, we shift to a **Minimum Effective Dose (20-Minute Express Session)** so you get the endorphin boost without adding stress:

| Block | Movement | Prescription | Why It Works |
|---|---|---|---|
| **0–3 Min** | Dynamic Thoracic & Hip Opener | 90 sec each | Shakes off desk posture & wakes up the nervous system. |
| **3–13 Min** | **Antagonist Superset:** Push-ups (or DB Press) + DB/Band Rows | 4 rounds × 10–12 reps (60s rest) | Hits entire upper body in half the time via reciprocal inhibition. |
| **13–20 Min** | **Lower & Core Superset:** Goblet Squats + 45s Plank | 3 rounds × 12 reps | Stimulates leg glycogen uptake and locks in core stability. |

Grab a quick high-protein meal afterward (even a 2-minute whey shake + banana or Greek curd) and call it a win. How much time do you have on the clock today?`;
  }

  return `First off, take a breath, ${firstName}—feeling tired or unmotivated happens to every single athlete. Your central nervous system isn't a machine, and forcing a brutal 9/10 RPE workout when you're running on empty usually does more harm than good.

Here are **3 guilt-free ways** we can play today depending on how your body feels:
- **Option A — The "5-Minute Rule":** Put on your shoes and do just 5 minutes of light warm-up sets. If you still feel drained after 5 minutes, you have full permission to go home and rest. (80% of the time, blood flow wakes you right up).
- **Option B — Down-Shift to Zone 1 Recovery:** Skip the heavy weights today. Do a 20-minute outdoor walk with music or a podcast, plus 5 minutes of hip and back decompression.
- **Option C — Full Rest & Refuel:** Hit your **${p.macros.protein}g protein** and **${p.waterLiters}L water** targets, take a warm shower, and get an extra hour of sleep tonight so you crush tomorrow.

Which of those 3 options feels most doable right now?`;
}

/**
 * Scenario 3 Handler: Dynamic Food Planning Guide that scales portions and macros
 * directly from the athlete's LIVE editable profile (calories, protein, carbs, fats, diet protocol, staples).
 */
function buildDynamicFoodPlanResponse(userText, historyContext) {
  const p = historyContext.profile;
  const lower = userText.toLowerCase();

  // Check if user is asking specifically about creatine
  if (lower.includes('creatine')) {
    return `### ⚡ Supplement Guide: Creatine Monohydrate (Scaled for ${p.weightKg} kg)

At your current bodyweight of **${p.weightKg} kg**, here is your optimal protocol:

| Parameter | Recommended Standard | Biological Mechanism |
|---|---|---|
| **Daily Maintenance Dose** | **${Math.max(3, Math.round(p.weightKg * 0.05))}g – 5g daily** | Saturates intramuscular phosphocreatine stores for ATP regeneration. |
| **Best Timing** | Post-workout or with your largest carb+protein meal | Insulin response enhances muscle creatine uptake. |
| **Hydration Target** | **${p.waterLiters}L+ water daily** | Supports intracellular muscle hydration and cell volumization. |

> **DEFY PROTOCOL TIP:** Stick to plain micronized **Creatine Monohydrate**—consistency every day matters far more than the exact hour you take it.`;
  }

  // Check if user wants a quick post-workout or single snack idea
  if (lower.includes('snack') || lower.includes('quick') || lower.includes('post-workout') || lower.includes('pre-workout')) {
    const bolusProtein = Math.round(p.macros.protein / 4);
    return `### 🥗 Quick High-Protein Fuel Options (Target: ~${bolusProtein}g Protein per Bolus)

To hit your live daily target of **${p.calories} kcal** and **${p.macros.protein}g protein** (${p.dietProtocol}), aim for ~${bolusProtein}g of protein in your snack/peri-workout window:

| Option | Quick Combination | Macros | Best Window |
|---|---|---|---|
| **1. Fast Digesting** | 1 Scoop Whey Isolate + 1 Banana + 5 Almonds | **${Math.min(32, bolusProtein)}g P** • 32g C • 4g F (~290 kcal) | 30 min Pre or Post-Workout |
| **2. Savory Indian Crunch** | 200g Low-Fat Greek Curd / Hung Dahi + 40g Roasted Chana + chaat masala | **24g P** • 28g C • 5g F (~255 kcal) | Mid-Morning or 4 PM Bridge |
| **3. High-Satiety Bowl** | 120g Pan-Seared Low-Fat Paneer / Tofu + Bell Peppers | **24g P** • 8g C • 12g F (~240 kcal) | Evening / Late Dinner Add-on |

> **DEFY PROTOCOL TIP:** Pairing a fast carb (like banana or fruit) with protein within 45 minutes post-training accelerates glycogen replenishment and halts cortisol catabolism.`;
  }

  // Full Day Dynamic Food Planning Guide scaled mathematically to p.calories & p.macros
  const totalCal = p.calories;
  const totalP = p.macros.protein;
  const totalC = p.macros.carbs;
  const totalF = p.macros.fats;

  const m1P = Math.round(totalP * 0.20);
  const m2P = Math.round(totalP * 0.14);
  const m3P = Math.round(totalP * 0.25);
  const m4P = Math.round(totalP * 0.19);
  const m5P = totalP - (m1P + m2P + m3P + m4P);

  const m1Cal = Math.round(totalCal * 0.22);
  const m2Cal = Math.round(totalCal * 0.12);
  const m3Cal = Math.round(totalCal * 0.30);
  const m4Cal = Math.round(totalCal * 0.12);
  const m5Cal = totalCal - (m1Cal + m2Cal + m3Cal + m4Cal);

  return `### 🥗 Personalized Food Planning Guide (${totalCal.toLocaleString()} kcal • ${totalP}g Protein)

I've built this full-day meal plan around your **current live targets**: **${totalCal.toLocaleString()} kcal/day** (**${totalP}g Protein** / **${totalC}g Carbs** / **${totalF}g Fats**) at **${p.weightKg} kg** bodyweight following your **${p.dietProtocol}** preference.

| Meal & Timing | Recommended Foods & Portions | Protein | Energy | Purpose |
|---|---|---|---|---|
| **1. Breakfast (08:30 AM)** | Moong Sprouts & Besan Chilla stuffed with grated Low-Fat Paneer + Mint Chutney | **${m1P}g** | ${m1Cal} kcal | Morning amino acid bolus + slow-release complex carbs |
| **2. Mid-Morning (11:30 AM)** | 200g Greek Curd / Hung Dahi + 35g Roasted Chana + Chia Seeds | **${m2P}g** | ${m2Cal} kcal | Gut microbiome support & steady blood glucose |
| **3. Power Lunch (02:00 PM)** | Soya Chunks Masala (55g raw weight) + 1 Bowl Yellow Dal Tadka + 2 Multigrain Rotis + Salad | **${m3P}g** | ${m3Cal} kcal | Peak leucine & complete plant-dairy amino acid synergy |
| **4. Pre/Post Workout (05:30 PM)** | 1.2 Scoops Whey Isolate in water + 1 Medium Banana (or Apple) | **${m4P}g** | ${m4Cal} kcal | Rapid glycogen priming & muscle protein synthesis trigger |
| **5. Recovery Dinner (08:30 PM)** | 150g Paneer / Tofu Bhurji with Capsicum & Spinach + 1 Cup Steamed Rice | **${m5P}g** | ${m5Cal} kcal | Overnight myofibrillar repair without digestive heaviness |
| **DAILY TOTAL** | **Target: ${totalP}g P • ${totalC}g C • ${totalF}g F • ${p.waterLiters}L Water** | **${totalP}g** | **${totalCal.toLocaleString()} kcal** | **Optimized for ${p.goal}** |

#### Practical Prep & Bio-Availability Rules:
- **Protein Spacing:** Hitting **~${Math.round(totalP / 4)}g+ protein** every 3.5–4 hours keeps muscle protein synthesis elevated throughout the day.
- **Hydration Benchmark:** Space your **${p.waterLiters}L daily water intake** evenly (drink 500 ml upon waking and 750 ml during your workout).

> **DEFY PROTOCOL TIP:** Whenever you edit your weight, calories, or macros on your dashboard, ask me to refresh your meal plan and I will automatically recalculate your exact meal portions.`;
}

/**
 * Scenario 4 Handler: Activity Planning (Running, Sports, HIIT, Conditioning, or 4-Day Push/Pull Split).
 */
function buildActivityPlanResponse(userText, historyContext) {
  const p = historyContext.profile;
  const lower = userText.toLowerCase();

  // Sub-scenario 4A: Running / 5K / Cardio / Outdoor / Sports Activity Planning
  if (/\b(run|running|5k|10k|marathon|outdoor|cardio|swim|swimming|cycle|cycling|football|cricket|sport|weekend|activity plan)\b/i.test(lower)) {
    return `### 🏃 Hybrid Athletic Activity & Conditioning Plan (Tailored for ${p.weightKg} kg)

To build real-world stamina alongside your **${p.activeSplit}** without sacrificing lean mass (at **${p.calories} kcal/day**), we pair polarized aerobic work with high-output intervals:

| Day / Session | Activity Type | Structure & Pacing | Duration | Heart Rate / RPE | Coaching Focus |
|---|---|---|---|---|---|
| **Session 1 (Tue or Wed)** | **Zone 2 Aerobic Base Run / Cycle** | Conversational nasal-breathing pace (can speak full sentences) | 30–35 min | 65–75% Max HR (RPE 6) | Mitochondrial density & capillary expansion |
| **Session 2 (Saturday)** | **Threshold Tempo / 5K Pace Intervals** | 5 min warm-up → **5 × 3 min fast run** (90s walk recovery) → 5 min cool-down | 28 min | 85–90% Max HR (RPE 8.5) | Raises lactate clearance threshold & VO2 Max |
| **Daily Baseline** | **NEAT Active Step Target** | Brisk 10-minute post-meal walks after lunch & dinner | 8,500+ steps | Zone 1 | Improves insulin sensitivity & digestion |

#### Hybrid Athlete Fueling & Recovery Cues:
- **Pre-Activity Fuel:** Take 25–30g of easily digested carbs (a banana or toast with honey) 30 minutes before your Saturday interval run.
- **Joint Protection at ${p.weightKg} kg:** Land mid-foot directly beneath your center of mass at a cadence of 170+ steps per minute to minimize knee shear stress.

> **DEFY PROTOCOL TIP:** Separate your high-intensity running intervals from heavy leg training by at least 24 hours to prevent the "interference effect" on lower-body hypertrophy.`;
  }

  // Sub-scenario 4B: 15-Min HIIT Finisher
  if (lower.includes('hiit') || lower.includes('finisher') || lower.includes('15-min') || lower.includes('15 min')) {
    return `### 🔥 DEFY 15-Minute Anaerobic Threshold Finisher

Designed for **${p.name} (${p.weightKg} kg • ${p.goal})**—maximizes Excess Post-Exercise Oxygen Consumption (EPOC) while preserving muscle mass:

| Time Window | Exercise Protocol | Work / Rest | Target Intensity | Athletic Intent |
|---|---|---|---|---|
| **Min 00:00 – 05:00** | **EMOM: Kettlebell / DB Swings** | 18 Explosive Swings every minute | 75–85% Max HR | Posterior-chain power with zero eccentric soreness |
| **Min 05:00 – 06:00** | **Active Nasal Recovery Walk** | Slow walk around the floor | Zone 2 | Flush blood lactate & lower heart rate |
| **Min 06:00 – 11:00** | **Tabata Sprint (20s Work / 10s Rest)** | Alternating: 1) DB Thrusters 2) Lateral Burpees | 90% Max HR | Peak anaerobic metabolic conditioning |
| **Min 11:00 – 15:00** | **Core Anti-Extension Finisher** | 40s Hollow Body Hold / Plank + 20s Rest (4 rounds) | RPE 9 Core | Trunk stiffness under heavy breathing fatigue |

> **DEFY PROTOCOL TIP:** Inhale strictly through your nose and exhale forcefully through pursed lips during the 10-second rest windows to stimulate the vagus nerve and drop heart rate faster.`;
  }

  // Sub-scenario 4C: Strength & Hypertrophy Split (Adapts to p.activeSplit & p.goal)
  return `### 🏋️ Personalized ${p.activeSplit} Activity Blueprint (${p.goal})

Engineered for **${p.name}** at **${p.weightKg} kg** fueled by **${p.calories} kcal / ${p.macros.protein}g protein**:

| Day | Session Focus | Primary Exercises | Sets × Reps | Target RPE | Rest Window |
|---|---|---|---|---|---|
| **Day 1 (Mon)** | **Push A — Chest, Front Delts & Triceps** | 1. Incline Barbell / DB Press<br>2. Standing Cable Flyes<br>3. Seated DB Shoulder Press<br>4. Barbell Front Squats (Quad Prime) | 4 × 6–8<br>3 × 10–12<br>3 × 8–10<br>3 × 6–8 | RPE 8.5<br>RPE 8.5<br>RPE 8.5<br>RPE 8.0 | 2.5 min<br>90 sec<br>2 min<br>2 min |
| **Day 2 (Tue)** | **Pull A — Back Width, Hamstrings & Biceps** | 1. Weighted Pull-ups / Lat Pulldown<br>2. Chest-Supported Row<br>3. Romanian Deadlifts (RDL)<br>4. Incline DB Curls | 4 × 6–8<br>3 × 8–10<br>4 × 8–10<br>3 × 10–12 | RPE 8.5<br>RPE 8.5<br>RPE 8.0<br>RPE 9.0 | 2.5 min<br>2 min<br>2 min<br>60 sec |
| **Day 3 (Wed)** | **Active Mobility & Zone 2 Flush** | Thoracic openers, 90/90 hip flow + 25 min brisk outdoor walk | Continuous | RPE 5 | — |
| **Day 4 (Thu)** | **Push B — Shoulders, Upper Chest & Arms** | 1. Overhead Barbell / DB Press<br>2. Weighted Dips<br>3. Cable Lateral Raises<br>4. Rope Tricep Extensions | 4 × 6–8<br>3 × 8–10<br>4 × 12–15<br>3 × 12–15 | RPE 8.5<br>RPE 8.5<br>RPE 9.0<br>RPE 9.5 | 2 min<br>2 min<br>60 sec<br>60 sec |
| **Day 5 (Fri)** | **Pull B — Posterior Thickness & Traps** | 1. Trap-Bar / Conventional Deadlift<br>2. Single-Arm DB Row<br>3. Face Pulls + Hammer Curls | 3 × 5<br>3 × 8–10<br>3 × 15 + 3 × 10 | RPE 8.0<br>RPE 8.5<br>RPE 9.0 | 3 min<br>90 sec<br>75 sec |

#### Progressive Overload Directive:
- **Double Progression:** Keep the working weight fixed until you hit the top of the rep range across all sets with clean form, then add **2.5 kg**.

> **DEFY PROTOCOL TIP:** Control the eccentric (lowering) phase for a full **2–3 seconds** on every compound lift to maximize mechanical tension while protecting your joints.`;
}

/**
 * Scenario 5 Handler: Injury, Soreness & Mobility Troubleshooting.
 */
function buildInjuryMobilityResponse(userText, historyContext) {
  const p = historyContext.profile;
  return `### 🩹 Biomechanical Decompression & Mobility Protocol

When tightness or soreness shows up during your **${p.activeSplit}** blocks at **${p.weightKg} kg**, we address root joint mechanics rather than just stretching the painful area:

| Phase | Corrective Drill | Prescription | Biomechanical Purpose |
|---|---|---|---|
| **1. Decompress** | 90/90 Diaphragmatic Wall Breathing | 3 sets × 6 slow breaths | Resets anterior pelvic tilt and takes shear load off the lumbar spine. |
| **2. Unlock Hips** | Half-Kneeling Couch Stretch (Glute squeezed) | 2 × 45 sec per side | Releases tight hip flexors (psoas/rectus femoris) that pull on the lower back. |
| **3. Mobilize Capsule** | 90/90 Hip Rotations & Thoracic Open Books | 2 × 8 reps per side | Restores hip & upper-back rotation so your lower back/knees don't compensate. |
| **4. Stabilize Core** | McGill Bird-Dog (5-sec isometric hold) + Suitcase Carry | 3 × 6 reps / 3 × 25m | Activates deep spinal stabilizers (multifidus & QL) with zero compressive load. |

> **DEFY PROTOCOL TIP:** Never sit down immediately after a heavy set of squats or deadlifts—walk gently for 2–3 minutes between sets so your intervertebral discs rehydrate cleanly.`;
}

/**
 * Scenario 6 Handler: Live Metric Update Verification & Cross-Session History Recall.
 */
function buildHistoryAndMetricsResponse(userText, historyContext, currentConvMessages) {
  const { profile: p, profileUpdateHistory, otherConversations, athleteMemories } = historyContext;

  let md = `### 🧠 Live Athlete Profile & Cross-Session Memory Sync\n\n`;
  md += `I have your latest live dashboard metrics and full conversation history loaded for **${p.name} (${p.id})**:\n\n`;

  md += `| Live Metric | Current Active Value | Coaching Impact |\n`;
  md += `|---|---|---|\n`;
  md += `| **Bodyweight & Comp** | **${p.weightKg} kg** (~${p.bodyFatPct}% BF • ${p.heightCm} cm • BMI ${p.bmi}) | Baseline for protein (${(p.macros.protein / p.weightKg).toFixed(2)}g/kg) & strength loading |\n`;
  md += `| **Daily Energy Intake** | **${p.calories.toLocaleString()} kcal / day** | Fueling target for **${p.goal}** |\n`;
  md += `| **Macro Split** | **${p.macros.protein}g Protein** • **${p.macros.carbs}g Carbs** • **${p.macros.fats}g Fats** | Scaled across 4–5 daily meal boluses |\n`;
  md += `| **Hydration & Split** | **${p.waterLiters}L Water** • **${p.activeSplit}** (${p.dietProtocol}) | Daily cellular hydration & training structure |\n`;

  if (profileUpdateHistory && profileUpdateHistory.length > 0) {
    md += `\n#### Recent Dashboard Edits Fed to Coach:\n`;
    profileUpdateHistory.slice(0, 4).forEach(upd => {
      md += `- ${upd.summary}\n`;
    });
  }

  if (athleteMemories && athleteMemories.length > 0) {
    md += `\n#### Stored Cross-Session Memories (${athleteMemories.length} Total):\n`;
    athleteMemories.slice(0, 6).forEach(mem => {
      md += `- **[${mem.category}]** ${mem.fact}\n`;
    });
  }

  if (otherConversations && otherConversations.length > 0) {
    md += `\n#### Past Conversations Accessed (${otherConversations.length} Sessions):\n`;
    otherConversations.slice(0, 5).forEach(conv => {
      const queries = conv.messages.filter(m => m.role === 'user').map(m => `"${m.content.slice(0, 65)}"`).join(', ');
      md += `- **${conv.title}** (${conv.messages.length} msgs): ${queries || 'Session logged'}\n`;
    });
  }

  md += `\n> **DEFY PROTOCOL TIP:** Every time you edit your weight, calorie intake, macros, or goal on the dashboard, those numbers are immediately saved to your JSON history and fed into our chat.`;
  return md;
}

/**
 * Generates an AI response using the API key from .env (with scenario-trained fallback).
 */
async function generateCoachResponse({ conversationId, userText, conversationMessages }) {
  const apiKey = loadEnvApiKey();
  const historyContext = buildCrossConversationContext(conversationId);
  const scenario = classifyScenario(userText);

  const fullSystemInstruction = `${DEFY_SCENARIO_TRAINING_PROMPT}\n\n[DETECTED SCENARIO FOR THIS TURN: ${scenario}]\n${historyContext.contextString}`;

  let replyText = '';

  if (apiKey) {
    const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const modelId of candidateModels) {
      try {
        const contentsPayload = [];
        const recent = conversationMessages.slice(-12);
        recent.forEach(msg => {
          contentsPayload.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        });

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: fullSystemInstruction }]
            },
            contents: contentsPayload,
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            replyText = candidateText;
            break;
          }
        }
      } catch (_) {
        // Proceed to scenario-trained local engine
      }
    }
  }

  if (!replyText) {
    switch (scenario) {
      case 'CASUAL_CONVO':
        replyText = buildCasualResponse(userText, historyContext);
        break;
      case 'MOTIVATION_FATIGUE':
        replyText = buildMotivationFatigueResponse(userText, historyContext);
        break;
      case 'FOOD_PLANNING':
        replyText = buildDynamicFoodPlanResponse(userText, historyContext);
        break;
      case 'ACTIVITY_PLANNING':
        replyText = buildActivityPlanResponse(userText, historyContext);
        break;
      case 'INJURY_MOBILITY':
        replyText = buildInjuryMobilityResponse(userText, historyContext);
        break;
      case 'HISTORY_AND_METRICS':
        replyText = buildHistoryAndMetricsResponse(userText, historyContext, conversationMessages);
        break;
      default:
        replyText = buildCasualResponse(userText, historyContext);
        break;
    }
  }

  return {
    reply: replyText,
    scenario,
    historyMeta: {
      memoriesAccessed: historyContext.memoriesCount,
      pastSessionsAccessed: historyContext.pastConversationsCount,
      activeWeightKg: historyContext.profile.weightKg,
      activeCalories: historyContext.profile.calories,
      activeProteinG: historyContext.profile.macros.protein
    }
  };
}

module.exports = {
  generateCoachResponse,
  classifyScenario
};
