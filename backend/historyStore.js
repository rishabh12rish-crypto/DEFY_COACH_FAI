/**
 * DEFY AI Coach — Persistent JSON History, Profile & Cross-Conversation Memory Store
 * Stores all user profile stats, profile change logs, conversation histories, and long-term memories
 * in structured .json files inside backend/data/.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'history.json');
const PROFILE_FILE = path.join(DATA_DIR, 'user_profile.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

const DEFAULT_PROFILE = {
  id: '#DEFY-804',
  name: 'Arjun K.',
  initials: 'AK',
  tier: 'ATHLETE',
  goal: 'Lean Hypertrophy & Stamina',
  level: 'Intermediate (Yr 3)',
  weightKg: 74.5,
  heightCm: 178,
  bodyFatPct: 14.2,
  bmi: 23.5,
  bmiCategory: 'Optimal',
  dietProtocol: 'Indian High-Protein Vegetarian',
  calories: 2450,
  waterLiters: 3.8,
  activeSplit: '4-Day Push/Pull',
  readinessPct: 92,
  macros: {
    protein: 160,
    carbs: 280,
    fats: 65
  },
  staples: 'Low-Fat Paneer, Soya Chunks, Moong Sprouts, Yellow Dal Tadka, Greek Curd, Roasted Chana, Whey Isolate',
  updatedAt: new Date().toISOString()
};

const DEFAULT_MEMORIES = [
  {
    id: 'mem-init-1',
    category: 'Profile',
    fact: 'Baseline stats: 74.5 kg (~14.2% BF, 178 cm), Intermediate Yr 3 lifter targeting Lean Hypertrophy & Stamina.',
    sourceConversationId: 'system',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mem-init-2',
    category: 'Nutrition',
    fact: 'Follows an Indian High-Protein Vegetarian protocol (2,450 kcal/day, 160g P / 280g C / 65g F) using paneer, soya chunks, moong sprouts, dal, curd, and whey.',
    sourceConversationId: 'system',
    createdAt: new Date().toISOString()
  }
];

function computeBmi(weightKg, heightCm) {
  const w = parseFloat(weightKg) || 74.5;
  const hMeters = (parseFloat(heightCm) || 178) / 100;
  if (hMeters <= 0) return { bmi: 23.5, category: 'Optimal' };
  const bmi = Number((w / (hMeters * hMeters)).toFixed(1));
  let category = 'Optimal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Optimal';
  else if (bmi < 30) category = 'Athletic / Overweight';
  else category = 'High Mass';
  return { bmi, category };
}

function normalizeProfile(raw = {}) {
  const merged = {
    ...DEFAULT_PROFILE,
    ...raw,
    macros: {
      ...DEFAULT_PROFILE.macros,
      ...(raw.macros || {})
    }
  };

  // Handle legacy string weight like "74.5 kg (~14.2% BF)"
  if (typeof raw.weight === 'string' && !raw.weightKg) {
    const parsedW = parseFloat(raw.weight);
    if (!isNaN(parsedW)) merged.weightKg = parsedW;
  }

  merged.weightKg = Number(parseFloat(merged.weightKg) || 74.5);
  merged.heightCm = Number(parseFloat(merged.heightCm) || 178);
  merged.bodyFatPct = Number(parseFloat(merged.bodyFatPct) || 14.2);
  merged.calories = Math.round(Number(parseFloat(merged.calories) || 2450));
  merged.waterLiters = Number(parseFloat(merged.waterLiters) || 3.8);
  merged.readinessPct = Math.min(100, Math.max(10, Math.round(Number(parseFloat(merged.readinessPct) || 92))));

  merged.macros.protein = Math.round(Number(parseFloat(merged.macros.protein) || 160));
  merged.macros.carbs = Math.round(Number(parseFloat(merged.macros.carbs) || 280));
  merged.macros.fats = Math.round(Number(parseFloat(merged.macros.fats) || 65));

  const { bmi, category } = computeBmi(merged.weightKg, merged.heightCm);
  merged.bmi = bmi;
  merged.bmiCategory = category;

  if (merged.name) {
    const parts = String(merged.name).trim().split(/\s+/);
    merged.initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'AK';
  }

  return merged;
}

function createConversationObject(title = 'New Coaching Session') {
  const now = new Date().toISOString();
  return {
    id: 'conv-' + crypto.randomBytes(4).toString('hex') + '-' + Date.now().toString(36),
    title,
    createdAt: now,
    updatedAt: now,
    summary: '',
    messages: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialConv = createConversationObject('Coaching Session');
    const seed = {
      athleteProfile: normalizeProfile(DEFAULT_PROFILE),
      profileUpdateHistory: [],
      athleteMemories: DEFAULT_MEMORIES,
      conversations: [initialConv]
    };
    writeDbFiles(seed);
  }
}

function writeDbFiles(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  data.athleteProfile = normalizeProfile(data.athleteProfile);
  if (!Array.isArray(data.profileUpdateHistory)) data.profileUpdateHistory = [];
  if (!Array.isArray(data.athleteMemories)) data.athleteMemories = DEFAULT_MEMORIES;
  if (!Array.isArray(data.conversations)) data.conversations = [];

  // Write unified history.json as well as dedicated user_profile.json & conversations.json
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  fs.writeFileSync(
    PROFILE_FILE,
    JSON.stringify(
      {
        athleteProfile: data.athleteProfile,
        profileUpdateHistory: data.profileUpdateHistory,
        athleteMemories: data.athleteMemories
      },
      null,
      2
    ),
    'utf-8'
  );
  fs.writeFileSync(
    CONVERSATIONS_FILE,
    JSON.stringify({ conversations: data.conversations }, null, 2),
    'utf-8'
  );
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    parsed.athleteProfile = normalizeProfile(parsed.athleteProfile);
    if (!Array.isArray(parsed.profileUpdateHistory)) parsed.profileUpdateHistory = [];
    if (!Array.isArray(parsed.athleteMemories)) parsed.athleteMemories = DEFAULT_MEMORIES;
    if (!Array.isArray(parsed.conversations)) parsed.conversations = [];
    return parsed;
  } catch (err) {
    console.error('Error reading history.json, re-initializing:', err);
    const fallback = {
      athleteProfile: normalizeProfile(DEFAULT_PROFILE),
      profileUpdateHistory: [],
      athleteMemories: JSON.parse(JSON.stringify(DEFAULT_MEMORIES)),
      conversations: [createConversationObject('Coaching Session')]
    };
    writeDbFiles(fallback);
    return fallback;
  }
}

function writeDb(data) {
  writeDbFiles(data);
}

/**
 * Updates the athlete profile (weight, calories, macros, goal, diet, etc.),
 * persists immediately to history.json & user_profile.json, and records a
 * high-priority memory entry so the AI chatbot knows what changed and can use it in any conversation.
 */
function updateAthleteProfile(updates = {}) {
  const db = readDb();
  const prev = db.athleteProfile;

  const nextRaw = {
    ...prev,
    ...updates,
    macros: {
      ...prev.macros,
      ...(updates.macros || {})
    },
    updatedAt: new Date().toISOString()
  };

  if (updates.protein !== undefined) nextRaw.macros.protein = updates.protein;
  if (updates.carbs !== undefined) nextRaw.macros.carbs = updates.carbs;
  if (updates.fats !== undefined) nextRaw.macros.fats = updates.fats;

  const next = normalizeProfile(nextRaw);

  // Detect what changed so we can feed a clear delta to the AI memory bank
  const changes = [];
  if (prev.name !== next.name) changes.push(`Name: ${prev.name} → ${next.name}`);
  if (prev.weightKg !== next.weightKg) changes.push(`Weight: ${prev.weightKg}kg → ${next.weightKg}kg`);
  if (prev.bodyFatPct !== next.bodyFatPct) changes.push(`Body Fat: ${prev.bodyFatPct}% → ${next.bodyFatPct}%`);
  if (prev.heightCm !== next.heightCm) changes.push(`Height: ${prev.heightCm}cm → ${next.heightCm}cm`);
  if (prev.calories !== next.calories) changes.push(`Calories: ${prev.calories} kcal → ${next.calories} kcal`);
  if (prev.macros.protein !== next.macros.protein) changes.push(`Protein: ${prev.macros.protein}g → ${next.macros.protein}g`);
  if (prev.macros.carbs !== next.macros.carbs) changes.push(`Carbs: ${prev.macros.carbs}g → ${next.macros.carbs}g`);
  if (prev.macros.fats !== next.macros.fats) changes.push(`Fats: ${prev.macros.fats}g → ${next.macros.fats}g`);
  if (prev.waterLiters !== next.waterLiters) changes.push(`Hydration: ${prev.waterLiters}L → ${next.waterLiters}L`);
  if (prev.goal !== next.goal) changes.push(`Goal: "${prev.goal}" → "${next.goal}"`);
  if (prev.dietProtocol !== next.dietProtocol) changes.push(`Diet: "${prev.dietProtocol}" → "${next.dietProtocol}"`);
  if (prev.activeSplit !== next.activeSplit) changes.push(`Split: "${prev.activeSplit}" → "${next.activeSplit}"`);
  if (prev.level !== next.level) changes.push(`Level: "${prev.level}" → "${next.level}"`);
  if (prev.staples !== next.staples) changes.push(`Staples updated to: ${next.staples}`);

  db.athleteProfile = next;

  const summaryOfChanges = changes.length > 0
    ? `Athlete updated metrics (${changes.join(', ')}). Current live targets: ${next.weightKg}kg (${next.bodyFatPct}% BF, BMI ${next.bmi}), ${next.calories} kcal/day (${next.macros.protein}g P / ${next.macros.carbs}g C / ${next.macros.fats}g F), Goal: ${next.goal}.`
    : `Athlete confirmed metrics: ${next.weightKg}kg, ${next.calories} kcal/day (${next.macros.protein}g P / ${next.macros.carbs}g C / ${next.macros.fats}g F), Goal: ${next.goal}.`;

  const changeRecord = {
    id: 'prof-upd-' + Date.now().toString(36),
    timestamp: next.updatedAt,
    changes,
    summary: summaryOfChanges
  };
  db.profileUpdateHistory.unshift(changeRecord);
  if (db.profileUpdateHistory.length > 25) {
    db.profileUpdateHistory = db.profileUpdateHistory.slice(0, 25);
  }

  // Also inject into athleteMemories so the AI sees it immediately in its memory bank
  const memEntry = {
    id: 'mem-prof-' + crypto.randomBytes(3).toString('hex') + '-' + Date.now().toString(36),
    category: 'Live Metric Update',
    fact: summaryOfChanges,
    sourceConversationId: 'profile-editor',
    createdAt: next.updatedAt
  };
  db.athleteMemories.unshift(memEntry);
  if (db.athleteMemories.length > 45) {
    db.athleteMemories = db.athleteMemories.slice(0, 45);
  }

  writeDb(db);
  return {
    athleteProfile: db.athleteProfile,
    athleteMemories: db.athleteMemories,
    profileUpdateHistory: db.profileUpdateHistory,
    latestUpdate: changeRecord
  };
}

/**
 * Automatically extracts notable athlete facts, goals, injuries, PRs, or dietary preferences
 * from user chat messages and stores them in history.json.
 */
function extractMemoriesFromUserText(userText, conversationId, db) {
  const text = userText.trim();
  const lower = text.toLowerCase();
  const extracted = [];

  // Skip extracting memories from simple casual greetings like "hey", "hi", "thanks"
  if (text.length < 10) return extracted;

  const patterns = [
    {
      category: 'Injury / Mobility',
      regex: /\b(tightness|stiffness|pain|hurt|injury|injured|sore|strain|ache|issue|sprain|rehab)\b/i,
      summarize: () => `Reported physical/mobility concern: "${text.slice(0, 140)}"`
    },
    {
      category: 'Training & Activity',
      regex: /\b(push\/pull|upper\/lower|full body|4-day|5-day|3-day|ppl|hypertrophy|hiit|finisher|marathon|5k|10k|running|cycling|swimming|football|cricket)\b/i,
      summarize: () => `Training / activity interest: "${text.slice(0, 140)}"`
    },
    {
      category: 'Nutrition / Diet',
      regex: /\b(diet|meal plan|protein|kcal|calories|paneer|soya|vegan|vegetarian|egg|whey|creatine|fasting|deficit|surplus|bulk|cut|allergic|lactose)\b/i,
      summarize: () => `Nutrition / dietary note: "${text.slice(0, 140)}"`
    },
    {
      category: 'Personal Record / Stats',
      regex: /\b(\d+\s*kg|\d+\s*lbs|bench|squat|deadlift|ohp|pr|max|bodyweight|weight is)\b/i,
      summarize: () => `Mentioned lift / body metric: "${text.slice(0, 140)}"`
    },
    {
      category: 'Personal Context',
      regex: /\b(my goal|i prefer|i like|i hate|i can't|i cannot|busy|schedule|traveling|exam|tired|exhausted|stressed)\b/i,
      summarize: () => `Athlete lifestyle / context note: "${text.slice(0, 140)}"`
    }
  ];

  for (const rule of patterns) {
    if (rule.regex.test(lower)) {
      const factStr = rule.summarize();
      const exists = db.athleteMemories.some(
        m => m.fact.toLowerCase() === factStr.toLowerCase()
      );
      if (!exists) {
        const mem = {
          id: 'mem-' + crypto.randomBytes(3).toString('hex') + '-' + Date.now().toString(36),
          category: rule.category,
          fact: factStr,
          sourceConversationId: conversationId,
          createdAt: new Date().toISOString()
        };
        db.athleteMemories.unshift(mem);
        extracted.push(mem);
      }
      break;
    }
  }

  if (db.athleteMemories.length > 45) {
    db.athleteMemories = db.athleteMemories.slice(0, 45);
  }

  return extracted;
}

/**
 * Builds the comprehensive Cross-Conversation Context block injected into the AI system prompt
 * on every single turn, including live edited profile metrics, recent metric updates,
 * saved memories, and past conversation summaries.
 */
function buildCrossConversationContext(currentConversationId) {
  const db = readDb();
  const p = db.athleteProfile;

  let context = `\n=== LIVE ATHLETE PROFILE & PERSISTENT CROSS-CONVERSATION MEMORY ===\n`;
  context += `Athlete: ${p.name} (${p.id}) | Level: ${p.level} | Primary Goal: ${p.goal}\n`;
  context += `Live Body Metrics: Weight: ${p.weightKg} kg | Height: ${p.heightCm} cm | Body Fat: ~${p.bodyFatPct}% | BMI: ${p.bmi} (${p.bmiCategory})\n`;
  context += `Live Daily Intakes: ${p.calories} kcal/day | Protein: ${p.macros.protein}g | Carbs: ${p.macros.carbs}g | Fats: ${p.macros.fats}g | Water Target: ${p.waterLiters}L\n`;
  context += `Active Workout Split: ${p.activeSplit} | Diet Protocol: ${p.dietProtocol} | Readiness: ${p.readinessPct}%\n`;
  context += `Preferred Food Staples: ${p.staples}\n\n`;

  if (db.profileUpdateHistory && db.profileUpdateHistory.length > 0) {
    context += `[RECENT ATHLETE PROFILE / INTAKE EDITS]:\n`;
    db.profileUpdateHistory.slice(0, 5).forEach((upd, i) => {
      context += `${i + 1}. (${new Date(upd.timestamp).toLocaleTimeString()}) ${upd.summary}\n`;
    });
    context += `\n`;
  }

  if (db.athleteMemories && db.athleteMemories.length > 0) {
    context += `[SAVED ATHLETE MEMORIES & FACTS ACROSS ALL SESSIONS]:\n`;
    db.athleteMemories.slice(0, 20).forEach((m, idx) => {
      context += `${idx + 1}. [${m.category}] ${m.fact}\n`;
    });
    context += `\n`;
  }

  const otherConversations = db.conversations.filter(
    c => c.id !== currentConversationId && c.messages && c.messages.length > 0
  );

  if (otherConversations.length > 0) {
    context += `[PREVIOUS CONVERSATION SESSIONS HISTORY (${otherConversations.length} past sessions)]:\n`;
    otherConversations.slice(0, 8).forEach(conv => {
      const dateStr = new Date(conv.updatedAt).toLocaleString();
      const userQueries = conv.messages
        .filter(m => m.role === 'user')
        .map(m => m.content.slice(0, 120))
        .join(' | ');
      const lastBotMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');
      const lastBotSnippet = lastBotMsg
        ? lastBotMsg.content.replace(/\s+/g, ' ').slice(0, 200) + '...'
        : 'No response recorded';

      context += `- Session "${conv.title}" (${dateStr}):\n`;
      context += `  * Athlete asked: ${userQueries}\n`;
      context += `  * Coach provided: ${lastBotSnippet}\n`;
    });
    context += `\n`;
  }

  context += `===================================================================\n`;

  return {
    contextString: context,
    profile: p,
    profileUpdateHistory: db.profileUpdateHistory || [],
    memoriesCount: db.athleteMemories.length,
    pastConversationsCount: otherConversations.length,
    otherConversations,
    athleteMemories: db.athleteMemories
  };
}

module.exports = {
  DATA_DIR,
  DB_FILE,
  PROFILE_FILE,
  CONVERSATIONS_FILE,
  readDb,
  writeDb,
  updateAthleteProfile,
  createConversationObject,
  extractMemoriesFromUserText,
  buildCrossConversationContext
};
