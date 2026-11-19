/**
 * DEFY Athletic Hub — Frontend Application Logic
 * - Editable User Stats & Daily Intakes (Weight, Height, Body Fat, Calories, Protein, Carbs, Fats, Water, Split, Goal, Diet)
 * - Every edit is persisted to JSON storage on the backend (/api/profile) and immediately fed into the AI Chatbot
 * - Multi-Scenario Conversational AI (Casual Chat, Motivation/Fatigue, Food Planning Guide, Activity Planning, Injury/Mobility, History Recall)
 * - No AI Voice / TTS output (clean text chatbot with optional microphone voice-to-text dictation)
 */

const LOCAL_DB_KEY = 'defy_persistent_history_db_v3';
const ACTIVE_CONV_KEY = 'defy_active_conversation_id';

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
  macros: { protein: 160, carbs: 280, fats: 65 },
  staples: 'Low-Fat Paneer, Soya Chunks, Moong Sprouts, Yellow Dal Tadka, Greek Curd, Roasted Chana, Whey Isolate'
};

const DEFAULT_LOCAL_DB = {
  athleteProfile: DEFAULT_PROFILE,
  profileUpdateHistory: [],
  athleteMemories: [
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
  ],
  conversations: []
};

function getLocalDb() {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.conversations)) return parsed;
    }
  } catch (_) {}
  const initialConv = {
    id: 'conv-' + Date.now().toString(36),
    title: 'Coaching Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  const fresh = {
    ...JSON.parse(JSON.stringify(DEFAULT_LOCAL_DB)),
    conversations: [initialConv]
  };
  saveLocalDb(fresh);
  return fresh;
}

function saveLocalDb(db) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch (_) {}
}

/* ==========================================================================
   DOM ELEMENTS & APPLICATION STATE
   ========================================================================== */
const chatFabBtn = document.getElementById('chatFabBtn');
const navOpenCoachBtn = document.getElementById('navOpenCoachBtn');
const closeChatPopupBtn = document.getElementById('closeChatPopupBtn');
const chatPopup = document.getElementById('chatPopup');

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const typingIndicator = document.getElementById('typingIndicator');
const coachLiveMetricsSub = document.getElementById('coachLiveMetricsSub');

// Session & History elements
const popupSessionSelect = document.getElementById('popupSessionSelect');
const popupNewChatBtn = document.getElementById('popupNewChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const exportPlanBtn = document.getElementById('exportPlanBtn');
const activeSessionTitleEl = document.getElementById('activeSessionTitle');

const dashTabMemories = document.getElementById('dashTabMemories');
const dashTabSessions = document.getElementById('dashTabSessions');
const dashMemoriesPanel = document.getElementById('dashMemoriesPanel');
const dashSessionsPanel = document.getElementById('dashSessionsPanel');
const memoriesListEl = document.getElementById('memoriesList');
const conversationsListEl = document.getElementById('conversationsList');
const memoriesCountBadge = document.getElementById('memoriesCountBadge');
const sessionsCountBadge = document.getElementById('sessionsCountBadge');
const memorySyncText = document.getElementById('memorySyncText');
const newMemoryInput = document.getElementById('newMemoryInput');
const addMemoryBtn = document.getElementById('addMemoryBtn');
const dashNewSessionBtn = document.getElementById('dashNewSessionBtn');

// Editable Dashboard Display Elements
const dispInitials = document.getElementById('dispInitials');
const dispAthleteId = document.getElementById('dispAthleteId');
const dispLevel = document.getElementById('dispLevel');
const dispBmiBadge = document.getElementById('dispBmiBadge');
const dispName = document.getElementById('dispName');
const dispGoal = document.getElementById('dispGoal');
const dispDietProtocol = document.getElementById('dispDietProtocol');
const dispReadiness = document.getElementById('dispReadiness');
const dispWeight = document.getElementById('dispWeight');
const dispBodyCompSub = document.getElementById('dispBodyCompSub');
const dispCalories = document.getElementById('dispCalories');
const dispWaterSub = document.getElementById('dispWaterSub');
const dispProtein = document.getElementById('dispProtein');
const dispProteinPerKgSub = document.getElementById('dispProteinPerKgSub');
const dispActiveSplit = document.getElementById('dispActiveSplit');
const dispPanelCalBadge = document.getElementById('dispPanelCalBadge');
const dispMacroProteinText = document.getElementById('dispMacroProteinText');
const dispMacroCarbsText = document.getElementById('dispMacroCarbsText');
const dispMacroFatsText = document.getElementById('dispMacroFatsText');
const barProtein = document.getElementById('barProtein');
const barCarbs = document.getElementById('barCarbs');
const barFats = document.getElementById('barFats');
const dispStaplesTags = document.getElementById('dispStaplesTags');

// Edit Profile Modal Elements
const openEditProfileBtn = document.getElementById('openEditProfileBtn');
const heroEditBtn = document.getElementById('heroEditBtn');
const panelEditMacrosBtn = document.getElementById('panelEditMacrosBtn');
const editProfileModal = document.getElementById('editProfileModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
const editProfileForm = document.getElementById('editProfileForm');

const editNameInput = document.getElementById('editNameInput');
const editGoalInput = document.getElementById('editGoalInput');
const editWeightInput = document.getElementById('editWeightInput');
const editHeightInput = document.getElementById('editHeightInput');
const editBodyFatInput = document.getElementById('editBodyFatInput');
const editCaloriesInput = document.getElementById('editCaloriesInput');
const editProteinInput = document.getElementById('editProteinInput');
const editCarbsInput = document.getElementById('editCarbsInput');
const editFatsInput = document.getElementById('editFatsInput');
const editWaterInput = document.getElementById('editWaterInput');
const editSplitInput = document.getElementById('editSplitInput');
const editDietInput = document.getElementById('editDietInput');
const editStaplesInput = document.getElementById('editStaplesInput');

const toast = document.getElementById('toastMessage');

let state = {
  conversations: [],
  athleteMemories: [],
  athleteProfile: { ...DEFAULT_PROFILE },
  activeConversationId: null,
  isPopupOpen: false,
  isRecordingVoice: false
};

let isProcessing = false;
let speechRecognition = null;

/* ==========================================================================
   VOICE-TO-TEXT INPUT (MICROPHONE DICTATION FOR USER REQUESTS)
   ========================================================================== */
function initSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    micBtn.title = 'Voice dictation is supported in Chrome, Edge, and Safari';
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.lang = 'en-US';
  speechRecognition.interimResults = true;
  speechRecognition.continuous = false;

  speechRecognition.onstart = () => {
    state.isRecordingVoice = true;
    micBtn.classList.add('recording');
    chatInput.placeholder = 'Listening... Speak your message...';
  };

  speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    chatInput.value = transcript;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    sendBtn.disabled = chatInput.value.trim().length === 0;
  };

  speechRecognition.onerror = (event) => {
    state.isRecordingVoice = false;
    micBtn.classList.remove('recording');
    chatInput.placeholder = 'Chat casually, or ask for a food guide or activity plan...';
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showToast('🎙️ Microphone error: ' + event.error);
    }
  };

  speechRecognition.onend = () => {
    const wasRecording = state.isRecordingVoice;
    state.isRecordingVoice = false;
    micBtn.classList.remove('recording');
    chatInput.placeholder = 'Chat casually, or ask for a food guide or activity plan...';

    if (wasRecording && chatInput.value.trim().length > 0 && !isProcessing) {
      handleSendMessage('voice');
    }
  };
}

function toggleVoiceInput() {
  if (!speechRecognition) {
    showToast('🎙️ Browser Speech Recognition unavailable. Please type your message.');
    return;
  }
  if (state.isRecordingVoice) {
    speechRecognition.stop();
  } else {
    try {
      speechRecognition.start();
    } catch (_) {}
  }
}

/* ==========================================================================
   BACKEND API & FALLBACK CLIENT LAYER
   ========================================================================== */
async function apiFetchHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    saveLocalDb(data);
    return data;
  } catch (_) {
    return getLocalDb();
  }
}

async function apiUpdateProfile(updates) {
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const db = getLocalDb();
    db.athleteProfile = data.athleteProfile;
    db.athleteMemories = data.athleteMemories;
    saveLocalDb(db);
    return data;
  } catch (_) {
    const db = getLocalDb();
    const prev = db.athleteProfile;
    const hMeters = (parseFloat(updates.heightCm) || prev.heightCm || 178) / 100;
    const w = parseFloat(updates.weightKg) || prev.weightKg || 74.5;
    const bmi = Number((w / (hMeters * hMeters)).toFixed(1));
    const next = {
      ...prev,
      ...updates,
      bmi,
      bmiCategory: bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Optimal' : 'Athletic / Overweight',
      macros: {
        ...prev.macros,
        ...(updates.macros || {})
      }
    };
    db.athleteProfile = next;
    const summary = `Athlete updated metrics: ${next.weightKg}kg (${next.bodyFatPct}% BF), ${next.calories} kcal/day (${next.macros.protein}g P / ${next.macros.carbs}g C / ${next.macros.fats}g F), Goal: ${next.goal}.`;
    db.athleteMemories.unshift({
      id: 'mem-prof-' + Date.now().toString(36),
      category: 'Live Metric Update',
      fact: summary,
      sourceConversationId: 'profile-editor',
      createdAt: new Date().toISOString()
    });
    saveLocalDb(db);
    return {
      athleteProfile: db.athleteProfile,
      athleteMemories: db.athleteMemories,
      latestUpdate: { summary }
    };
  }
}

async function apiCreateConversation(title = 'New Coaching Session') {
  try {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.conversation;
  } catch (_) {
    const db = getLocalDb();
    const conv = {
      id: 'conv-' + Date.now().toString(36),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    db.conversations.unshift(conv);
    saveLocalDb(db);
    return conv;
  }
}

async function apiDeleteConversation(convId) {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (_) {
    const db = getLocalDb();
    db.conversations = db.conversations.filter(c => c.id !== convId);
    if (db.conversations.length === 0) {
      db.conversations.push({
        id: 'conv-' + Date.now().toString(36),
        title: 'New Coaching Session',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      });
    }
    saveLocalDb(db);
    return { conversations: db.conversations, activeConversation: db.conversations[0] };
  }
}

async function apiClearConversation(convId) {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearMessages: true })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (_) {
    const db = getLocalDb();
    const conv = db.conversations.find(c => c.id === convId);
    if (conv) {
      conv.messages = [];
      conv.updatedAt = new Date().toISOString();
      saveLocalDb(db);
    }
    return { conversation: conv };
  }
}

async function apiAddMemory(fact, category = 'Athlete Note') {
  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fact,
        category,
        conversationId: state.activeConversationId
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (_) {
    const db = getLocalDb();
    const mem = {
      id: 'mem-' + Date.now().toString(36),
      category,
      fact,
      sourceConversationId: state.activeConversationId || 'manual',
      createdAt: new Date().toISOString()
    };
    db.athleteMemories.unshift(mem);
    saveLocalDb(db);
    return { memory: mem, athleteMemories: db.athleteMemories };
  }
}

async function apiDeleteMemory(memId) {
  try {
    const res = await fetch(`/api/memories/${encodeURIComponent(memId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (_) {
    const db = getLocalDb();
    db.athleteMemories = db.athleteMemories.filter(m => m.id !== memId);
    saveLocalDb(db);
    return { athleteMemories: db.athleteMemories };
  }
}

async function apiSendChatMessage(conversationId, message, inputMethod = 'text') {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      message,
      inputMethod
    })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

/* ==========================================================================
   EDIT PROFILE & INTAKES MODAL LOGIC
   ========================================================================== */
function openEditModal(focusFieldId = null) {
  const p = state.athleteProfile;
  editNameInput.value = p.name || 'Arjun K.';
  editGoalInput.value = p.goal || 'Lean Hypertrophy & Stamina';
  editWeightInput.value = p.weightKg || 74.5;
  editHeightInput.value = p.heightCm || 178;
  editBodyFatInput.value = p.bodyFatPct || 14.2;
  editCaloriesInput.value = p.calories || 2450;
  editProteinInput.value = (p.macros && p.macros.protein) || 160;
  editCarbsInput.value = (p.macros && p.macros.carbs) || 280;
  editFatsInput.value = (p.macros && p.macros.fats) || 65;
  editWaterInput.value = p.waterLiters || 3.8;
  editSplitInput.value = p.activeSplit || '4-Day Push/Pull';
  editDietInput.value = p.dietProtocol || 'Indian High-Protein Vegetarian';
  editStaplesInput.value = p.staples || '';

  editProfileModal.classList.add('open');
  editProfileModal.setAttribute('aria-hidden', 'false');

  if (focusFieldId) {
    const el = document.getElementById(focusFieldId);
    if (el) setTimeout(() => { el.focus(); el.select(); }, 100);
  }
}

function closeEditModal() {
  editProfileModal.classList.remove('open');
  editProfileModal.setAttribute('aria-hidden', 'true');
}

async function handleSaveProfileForm(e) {
  e.preventDefault();

  const updates = {
    name: editNameInput.value.trim(),
    goal: editGoalInput.value.trim(),
    weightKg: parseFloat(editWeightInput.value),
    heightCm: parseFloat(editHeightInput.value),
    bodyFatPct: parseFloat(editBodyFatInput.value),
    calories: parseInt(editCaloriesInput.value, 10),
    waterLiters: parseFloat(editWaterInput.value),
    activeSplit: editSplitInput.value.trim(),
    dietProtocol: editDietInput.value.trim(),
    staples: editStaplesInput.value.trim(),
    macros: {
      protein: parseInt(editProteinInput.value, 10),
      carbs: parseInt(editCarbsInput.value, 10),
      fats: parseInt(editFatsInput.value, 10)
    }
  };

  const result = await apiUpdateProfile(updates);
  state.athleteProfile = result.athleteProfile;
  if (result.athleteMemories) state.athleteMemories = result.athleteMemories;

  renderProfileOnDashboard();
  renderDashboardHistory();
  closeEditModal();

  // Notify in the active chat window that live metrics were updated and fed to the AI coach
  const p = state.athleteProfile;
  const syncNoteRow = document.createElement('div');
  syncNoteRow.className = 'message-row bot-row';
  syncNoteRow.innerHTML = `
    <div class="msg-avatar bot-avatar">⚡</div>
    <div class="msg-bubble-wrap">
      <div class="msg-bubble bot-bubble">
        <div class="protocol-callout cyan-tip" style="margin: 0;">
          <div class="callout-header"><span>🔄 LIVE METRICS UPDATED & FED TO COACH</span></div>
          <div class="callout-body">
            Got your updated numbers, <strong>${escapeHtml(p.name)}</strong>: <strong>${p.weightKg} kg</strong> (${p.bodyFatPct}% BF • BMI ${p.bmi}), <strong>${p.calories.toLocaleString()} kcal/day</strong> (<strong>${p.macros.protein}g P</strong> / <strong>${p.macros.carbs}g C</strong> / <strong>${p.macros.fats}g F</strong> • <strong>${p.waterLiters}L Water</strong>), targeting <strong>${escapeHtml(p.goal)}</strong>. All meal guides and workout plans will now use these targets!
          </div>
        </div>
      </div>
      <div class="msg-footer-meta">
        <span class="msg-time">Synced to JSON Memory</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(syncNoteRow);
  scrollToBottom();

  showToast(`⚡ Saved to JSON & fed to Coach (${p.weightKg}kg • ${p.calories} kcal • ${p.macros.protein}g P)`);
}

function renderProfileOnDashboard() {
  const p = state.athleteProfile || DEFAULT_PROFILE;
  const macros = p.macros || { protein: 160, carbs: 280, fats: 65 };

  dispInitials.textContent = p.initials || 'AK';
  dispAthleteId.textContent = `ATHLETE ${p.id || '#DEFY-804'}`;
  dispLevel.textContent = (p.level || 'INTERMEDIATE (YR 3)').toUpperCase();
  dispBmiBadge.textContent = `BMI ${p.bmi || 23.5} • ${(p.bmiCategory || 'OPTIMAL').toUpperCase()}`;
  dispName.textContent = p.name || 'Arjun K.';
  dispGoal.textContent = p.goal || 'Lean Hypertrophy & Stamina';
  dispDietProtocol.textContent = p.dietProtocol || 'Indian High-Protein Vegetarian';
  dispReadiness.textContent = `${p.readinessPct || 92}%`;

  dispWeight.textContent = p.weightKg;
  dispBodyCompSub.textContent = `~${p.bodyFatPct}% Body Fat • ${p.heightCm} cm`;

  dispCalories.textContent = Number(p.calories).toLocaleString();
  dispWaterSub.textContent = `Hydration Target: ${p.waterLiters} L / day`;

  dispProtein.textContent = macros.protein;
  const pPerKg = (macros.protein / (p.weightKg || 74.5)).toFixed(2);
  dispProteinPerKgSub.textContent = `${pPerKg}g per kg bodyweight`;

  dispActiveSplit.textContent = p.activeSplit || '4-Day Push/Pull';
  dispPanelCalBadge.textContent = `${Number(p.calories).toLocaleString()} KCAL`;

  const pKcal = macros.protein * 4;
  const cKcal = macros.carbs * 4;
  const fKcal = macros.fats * 9;
  const totalKcal = Math.max(1, p.calories || (pKcal + cKcal + fKcal));

  const pPct = Math.round((pKcal / totalKcal) * 100);
  const cPct = Math.round((cKcal / totalKcal) * 100);
  const fPct = Math.round((fKcal / totalKcal) * 100);

  dispMacroProteinText.textContent = `${macros.protein}g • ${pKcal.toLocaleString()} kcal (${pPct}%)`;
  dispMacroCarbsText.textContent = `${macros.carbs}g • ${cKcal.toLocaleString()} kcal (${cPct}%)`;
  dispMacroFatsText.textContent = `${macros.fats}g • ${fKcal.toLocaleString()} kcal (${fPct}%)`;

  barProtein.style.width = `${Math.min(100, Math.max(15, pPct * 2.4))}%`;
  barCarbs.style.width = `${Math.min(100, Math.max(15, cPct * 1.5))}%`;
  barFats.style.width = `${Math.min(100, Math.max(15, fPct * 2.2))}%`;

  // Render Staples Tags
  dispStaplesTags.innerHTML = '';
  const staplesList = String(p.staples || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  staplesList.forEach(st => {
    const span = document.createElement('span');
    span.className = 'staple-tag';
    span.textContent = st;
    dispStaplesTags.appendChild(span);
  });

  // Update Chatbot header live metrics subtitle
  if (coachLiveMetricsSub) {
    coachLiveMetricsSub.textContent = `Synced: ${p.weightKg} kg • ${Number(p.calories).toLocaleString()} kcal • ${macros.protein}g P`;
  }
}

/* ==========================================================================
   POPUP & DASHBOARD UI HANDLERS
   ========================================================================== */
function toggleChatPopup(forceOpen = null) {
  const nextState = forceOpen !== null ? forceOpen : !state.isPopupOpen;
  state.isPopupOpen = nextState;

  if (state.isPopupOpen) {
    chatPopup.classList.add('open');
    chatPopup.setAttribute('aria-hidden', 'false');
    chatFabBtn.classList.add('open');
    setTimeout(() => {
      scrollToBottom();
      chatInput.focus();
    }, 150);
  } else {
    chatPopup.classList.remove('open');
    chatPopup.setAttribute('aria-hidden', 'true');
    chatFabBtn.classList.remove('open');
  }
}

async function init() {
  initSpeechRecognition();
  await refreshHistoryState();

  // Popup launchers
  chatFabBtn.addEventListener('click', () => toggleChatPopup());
  navOpenCoachBtn.addEventListener('click', () => toggleChatPopup(true));
  closeChatPopupBtn.addEventListener('click', () => toggleChatPopup(false));

  // Edit Profile & Intakes Modal triggers
  openEditProfileBtn.addEventListener('click', () => openEditModal('editWeightInput'));
  heroEditBtn.addEventListener('click', () => openEditModal('editNameInput'));
  panelEditMacrosBtn.addEventListener('click', () => openEditModal('editCaloriesInput'));
  closeEditModalBtn.addEventListener('click', closeEditModal);
  cancelEditModalBtn.addEventListener('click', closeEditModal);
  editProfileModal.addEventListener('click', (e) => {
    if (e.target === editProfileModal) closeEditModal();
  });
  editProfileForm.addEventListener('submit', handleSaveProfileForm);

  // Clicking any of the 4 KPI cards opens the Edit modal focused on that metric
  document.querySelectorAll('.editable-kpi').forEach(card => {
    card.addEventListener('click', () => {
      const targetId = card.getAttribute('data-edit-focus');
      openEditModal(targetId);
    });
  });

  // Mic button for voice dictation
  micBtn.addEventListener('click', toggleVoiceInput);

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    sendBtn.disabled = chatInput.value.trim().length === 0;
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage('text');
    }
  });

  sendBtn.addEventListener('click', () => handleSendMessage('text'));

  // Suggested Asks (3 suggestions when opening the chatbot)
  document.querySelectorAll('.suggested-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt && !isProcessing) {
        chatInput.value = prompt;
        sendBtn.disabled = false;
        handleSendMessage('text');
      }
    });
  });

  // Session Dropdown inside Popup Header
  popupSessionSelect.addEventListener('change', () => {
    if (isProcessing) return;
    state.activeConversationId = popupSessionSelect.value;
    localStorage.setItem(ACTIVE_CONV_KEY, state.activeConversationId);
    renderDashboardHistory();
    renderActiveConversationMessages();
  });

  // New Session buttons
  const createNewSession = async () => {
    if (isProcessing) return;
    const newConv = await apiCreateConversation('New Coaching Session');
    await refreshHistoryState(newConv.id);
    toggleChatPopup(true);
    showToast('⚡ New coaching session started — JSON memory synced');
  };

  popupNewChatBtn.addEventListener('click', createNewSession);
  dashNewSessionBtn.addEventListener('click', createNewSession);

  // Clear current chat
  clearChatBtn.addEventListener('click', async () => {
    if (!state.activeConversationId || isProcessing) return;
    if (confirm('Clear messages in this session? (Your JSON Memory Bank remains intact)')) {
      await apiClearConversation(state.activeConversationId);
      await refreshHistoryState(state.activeConversationId);
      showToast('Session messages cleared');
    }
  });

  // Dashboard tabs (Memory Bank vs Past Chats)
  dashTabMemories.addEventListener('click', () => {
    dashTabMemories.classList.add('active');
    dashTabSessions.classList.remove('active');
    dashMemoriesPanel.classList.remove('hidden');
    dashSessionsPanel.classList.add('hidden');
  });

  dashTabSessions.addEventListener('click', () => {
    dashTabSessions.classList.add('active');
    dashTabMemories.classList.remove('active');
    dashSessionsPanel.classList.remove('hidden');
    dashMemoriesPanel.classList.add('hidden');
  });

  // Add manual memory note
  const handleAddMemory = async () => {
    const val = newMemoryInput.value.trim();
    if (!val) return;
    newMemoryInput.value = '';
    await apiAddMemory(val, 'Athlete Note');
    await refreshHistoryState(state.activeConversationId, false);
    showToast('🧠 Saved to JSON Athlete Memory Bank');
  };

  addMemoryBtn.addEventListener('click', handleAddMemory);
  newMemoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMemory();
    }
  });

  exportPlanBtn.addEventListener('click', handleExportPlan);
}

/* ==========================================================================
   STATE SYNC & RENDERING
   ========================================================================== */
async function refreshHistoryState(preferredConvId = null, reRenderChat = true) {
  const data = await apiFetchHistory();
  state.conversations = data.conversations || [];
  state.athleteMemories = data.athleteMemories || [];
  if (data.athleteProfile) state.athleteProfile = data.athleteProfile;

  const savedActiveId = preferredConvId || localStorage.getItem(ACTIVE_CONV_KEY);
  const matching = state.conversations.find(c => c.id === savedActiveId);

  if (matching) {
    state.activeConversationId = matching.id;
  } else if (state.conversations.length > 0) {
    state.activeConversationId = state.conversations[0].id;
  }
  localStorage.setItem(ACTIVE_CONV_KEY, state.activeConversationId);

  renderProfileOnDashboard();
  renderDashboardHistory();
  if (reRenderChat) {
    renderActiveConversationMessages();
  }
}

function renderDashboardHistory() {
  memoriesCountBadge.textContent = state.athleteMemories.length;
  sessionsCountBadge.textContent = state.conversations.length;
  memorySyncText.textContent = `${state.athleteMemories.length} JSON Memories`;

  popupSessionSelect.innerHTML = '';
  state.conversations.forEach(conv => {
    const opt = document.createElement('option');
    opt.value = conv.id;
    opt.textContent = conv.title || 'Coaching Session';
    if (conv.id === state.activeConversationId) opt.selected = true;
    popupSessionSelect.appendChild(opt);
  });

  memoriesListEl.innerHTML = '';
  state.athleteMemories.forEach(mem => {
    const mItem = document.createElement('div');
    mItem.className = 'memory-item';
    mItem.innerHTML = `
      <div>
        <span class="memory-cat">${escapeHtml(mem.category || 'Memory')}</span>
        <div class="memory-fact">${escapeHtml(mem.fact)}</div>
      </div>
      <button class="mem-delete-btn" title="Remove this memory">
        <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;
    mItem.querySelector('.mem-delete-btn').addEventListener('click', async () => {
      await apiDeleteMemory(mem.id);
      await refreshHistoryState(state.activeConversationId, false);
      showToast('Memory removed from JSON');
    });
    memoriesListEl.appendChild(mItem);
  });

  conversationsListEl.innerHTML = '';
  state.conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `conv-item ${conv.id === state.activeConversationId ? 'active' : ''}`;
    const msgCount = (conv.messages || []).length;
    const timeStr = new Date(conv.updatedAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    item.innerHTML = `
      <div class="conv-info">
        <span class="conv-title">${escapeHtml(conv.title || 'Coaching Session')}</span>
        <div class="conv-meta">${msgCount} message${msgCount === 1 ? '' : 's'} • Updated ${timeStr}</div>
      </div>
      <button class="conv-delete-btn" title="Delete session">
        <svg class="icon" style="width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.conv-delete-btn')) return;
      state.activeConversationId = conv.id;
      localStorage.setItem(ACTIVE_CONV_KEY, conv.id);
      renderDashboardHistory();
      renderActiveConversationMessages();
      toggleChatPopup(true);
    });

    item.querySelector('.conv-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await apiDeleteConversation(conv.id);
      const nextId = conv.id === state.activeConversationId ? null : state.activeConversationId;
      await refreshHistoryState(nextId, true);
      showToast('Session deleted');
    });

    conversationsListEl.appendChild(item);
  });
}

function getWelcomeMessageHtml() {
  const p = state.athleteProfile || DEFAULT_PROFILE;
  const firstName = (p.name || 'Arjun').split(' ')[0];
  return `
    <div class="message-row bot-row">
      <div class="msg-avatar bot-avatar">⚡</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble bot-bubble">
          <h3>Hey ${escapeHtml(firstName)} — Ready when you are!</h3>
          <p>We can chat casually about how your day is going, or jump into a <strong>Food Planning Guide</strong> or <strong>Activity & Workout Plan</strong> tailored to your live stats (<strong>${p.weightKg} kg • ${Number(p.calories).toLocaleString()} kcal • ${p.macros.protein}g Protein</strong>).</p>
          <p>Whenever you edit your weight or intakes on the dashboard, I automatically update your plans.</p>
        </div>
        <div class="msg-footer-meta">
          <span class="msg-time">Coach Online</span>
        </div>
      </div>
    </div>
  `;
}

function renderActiveConversationMessages() {
  const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
  activeSessionTitleEl.textContent = activeConv ? activeConv.title : 'Defy Coach';

  chatMessages.innerHTML = getWelcomeMessageHtml();

  const messages = (activeConv && Array.isArray(activeConv.messages)) ? activeConv.messages : [];

  messages.forEach(msg => {
    const timeLabel = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : getTimeStamp();

    if (msg.role === 'user') {
      const row = document.createElement('div');
      row.className = 'message-row user-row';
      row.innerHTML = `
        <div class="msg-avatar user-avatar">${escapeHtml(state.athleteProfile.initials || 'AK')}</div>
        <div class="msg-bubble-wrap">
          <div class="msg-bubble user-bubble">${escapeHtml(msg.content)}</div>
          <div class="msg-footer-meta">
            <span class="msg-time">${timeLabel}</span>
          </div>
        </div>
      `;
      chatMessages.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'message-row bot-row';
      row.innerHTML = `
        <div class="msg-avatar bot-avatar">⚡</div>
        <div class="msg-bubble-wrap">
          <div class="msg-bubble bot-bubble">${parseMarkdown(msg.content)}</div>
          <div class="msg-footer-meta">
            <span class="msg-time">${timeLabel}</span>
          </div>
        </div>
      `;
      chatMessages.appendChild(row);
    }
  });

  scrollToBottom();
}

/* ==========================================================================
   SEND MESSAGE
   ========================================================================== */
async function handleSendMessage(inputMethod = 'text') {
  if (isProcessing) return;
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  isProcessing = true;

  appendUserMessageDom(text);

  typingIndicator.style.display = 'block';
  scrollToBottom();

  try {
    const result = await apiSendChatMessage(
      state.activeConversationId,
      text,
      inputMethod
    );

    typingIndicator.style.display = 'none';
    const bubble = createBotMessageContainer();
    await streamResponseText(bubble, result.botMessage.content);

    if (result.conversation && result.conversation.id) {
      state.activeConversationId = result.conversation.id;
      localStorage.setItem(ACTIVE_CONV_KEY, result.conversation.id);
    }
    await refreshHistoryState(state.activeConversationId, false);
    const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
    if (activeConv) activeSessionTitleEl.textContent = activeConv.title;
  } catch (err) {
    console.error('Chat error:', err);
    typingIndicator.style.display = 'none';
    showToast('Could not reach Defy Coach server');
  } finally {
    isProcessing = false;
    chatInput.focus();
  }
}

/* ==========================================================================
   MARKDOWN PARSER & DOM STREAMING HELPERS
   ========================================================================== */
function parseMarkdown(md) {
  if (!md) return '';
  let text = md.trim().replace(/\r\n/g, '\n');

  text = text.replace(/^>\s*\*\*DEFY PROTOCOL TIP:\*\*\s*(.+)$/gim, (match, tipContent) => {
    return `<div class="protocol-callout">
      <div class="callout-header"><span>⚡ DEFY PROTOCOL TIP</span></div>
      <div class="callout-body">${formatInline(tipContent)}</div>
    </div>`;
  });

  text = text.replace(/^>\s*(.+)$/gim, (match, quoteContent) => {
    return `<div class="protocol-callout cyan-tip">
      <div class="callout-header"><span>🧠 COACH INSIGHT</span></div>
      <div class="callout-body">${formatInline(quoteContent)}</div>
    </div>`;
  });

  const tableRegex = /((?:\|[^\n]+\|\r?\n?){2,})/g;
  text = text.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return match;

    let tableHtml = '<div class="table-container"><table class="plan-table">';
    let hasHeader = false;

    lines.forEach((line, index) => {
      if (/^\|(\s*[-:]+\s*\|)+$/.test(line.trim())) return;
      const rawCells = line.split('|').slice(1, -1);
      const cells = rawCells.map(c => c.trim());

      if (index === 0 && !hasHeader) {
        hasHeader = true;
        tableHtml += '<thead><tr>';
        cells.forEach(cell => {
          tableHtml += `<th>${formatInline(cell)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cells.forEach(cell => {
          const isHighlight = /\b(\d+g|\d[\d,]*\s*kcal|RPE\s*[\d.]+)\b/i.test(cell);
          tableHtml += `<td class="${isHighlight ? 'highlight' : ''}">${formatInline(cell)}</td>`;
        });
        tableHtml += '</tr>';
      }
    });

    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

  text = text.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
  text = text.replace(/<\/ul>\s*<ul>/g, '');

  const segments = text.split(/\n\s*\n/);
  const formattedSegments = segments.map(seg => {
    const trimmed = seg.trim();
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<li')
    ) {
      return trimmed;
    }
    return `<p>${formatInline(trimmed)}</p>`;
  });

  return formattedSegments.join('\n');
}

function formatInline(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 11.5px; color: var(--accent-teal);">$1</code>');
}

function appendUserMessageDom(text) {
  const time = getTimeStamp();
  const row = document.createElement('div');
  row.className = 'message-row user-row';
  row.innerHTML = `
    <div class="msg-avatar user-avatar">${escapeHtml(state.athleteProfile.initials || 'AK')}</div>
    <div class="msg-bubble-wrap">
      <div class="msg-bubble user-bubble">${escapeHtml(text)}</div>
      <div class="msg-footer-meta">
        <span class="msg-time">${time}</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(row);
  scrollToBottom();
}

function createBotMessageContainer() {
  const time = getTimeStamp();
  const row = document.createElement('div');
  row.className = 'message-row bot-row';
  row.innerHTML = `
    <div class="msg-avatar bot-avatar">⚡</div>
    <div class="msg-bubble-wrap">
      <div class="msg-bubble bot-bubble"></div>
      <div class="msg-footer-meta">
        <span class="msg-time">${time}</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(row);
  scrollToBottom();
  return row.querySelector('.bot-bubble');
}

async function streamResponseText(bubbleElement, fullMarkdown) {
  let currentLength = 0;
  const totalLength = fullMarkdown.length;
  const chunkSize = Math.max(4, Math.floor(totalLength / 65));

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      currentLength += chunkSize;
      if (currentLength >= totalLength) {
        currentLength = totalLength;
        clearInterval(interval);
        bubbleElement.innerHTML = parseMarkdown(fullMarkdown);
        scrollToBottom();
        resolve();
      } else {
        bubbleElement.innerHTML = parseMarkdown(fullMarkdown.substring(0, currentLength));
        scrollToBottom();
      }
    }, 14);
  });
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTimeStamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

/* ==========================================================================
   EXPORT PLAN
   ========================================================================== */
function handleExportPlan() {
  const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
  const messages = activeConv ? activeConv.messages : [];
  const p = state.athleteProfile;

  let content = "========================================================\n";
  content += " DEFY ATHLETIC PERFORMANCE HUB | TRAINING & DIET PLAN\n";
  content += ` Session: ${activeConv ? activeConv.title : 'Athlete Summary'}\n`;
  content += ` Generated on: ${new Date().toLocaleString()}\n`;
  content += ` Athlete: ${p.name} (${p.id}) | Goal: ${p.goal}\n`;
  content += ` Live Stats: ${p.weightKg} kg (${p.bodyFatPct}% BF) | ${p.calories} kcal | ${p.macros.protein}g P / ${p.macros.carbs}g C / ${p.macros.fats}g F\n`;
  content += "========================================================\n\n";

  if (state.athleteMemories.length > 0) {
    content += "[PERSISTENT ATHLETE MEMORY BANK]\n";
    state.athleteMemories.forEach((m, i) => {
      content += `${i + 1}. [${m.category}] ${m.fact}\n`;
    });
    content += "========================================================\n\n";
  }

  messages.forEach((msg, idx) => {
    if (msg.role === 'user') {
      content += `\n[ATHLETE QUERY #${idx + 1}]\n"${msg.content}"\n`;
      content += "--------------------------------------------------------\n";
    } else {
      content += `\n[DEFY COACH PROTOCOL]\n${msg.content}\n\n`;
      content += "========================================================\n";
    }
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DEFY_Athlete_Plan_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📥 Athlete Plan & JSON Memory Log Exported');
}

document.addEventListener('DOMContentLoaded', init);
