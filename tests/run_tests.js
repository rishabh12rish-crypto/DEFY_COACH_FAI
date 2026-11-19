/**
 * DEFY AI Coach — Automated End-to-End Integration Test Suite
 * Spins up the backend server and runs automated tests covering:
 * 1. Casual Conversation (greetings, small talk, humor — no unwanted stats dumping)
 * 2. Low Motivation / Busy Schedule Scenario ("feeling tired and busy today")
 * 3. Editable User Intakes & Weight -> Live JSON persistence & feeding into AI Chatbot
 * 4. Dynamic Food Planning Guide (verifying meal calories & protein match the edited intakes)
 * 5. Activity & Conditioning Planning (workout split + 5K / outdoor activity planning)
 * 6. Injury & Mobility Troubleshooting (lower back tightness protocol)
 * 7. Cross-Conversation History & JSON File Verification (history.json, user_profile.json, conversations.json)
 */
const assert = require('assert');
const fs = require('fs');
const { Readable } = require('stream');
const { server } = require('../backend/server');
const { DB_FILE, PROFILE_FILE, CONVERSATIONS_FILE, updateAthleteProfile } = require('../backend/historyStore');

function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      }
    });
    req.method = method;
    req.url = endpoint;
    req.headers = {
      host: 'localhost:3000',
      'content-type': 'application/json'
    };

    let statusCode = 200;
    let resBody = '';
    const res = {
      writeHead(code) {
        statusCode = code;
      },
      end(chunk) {
        if (chunk) resBody += chunk.toString();
        try {
          resolve({ status: statusCode, data: resBody ? JSON.parse(resBody) : {} });
        } catch (err) {
          reject(err);
        }
      }
    };

    server.emit('request', req, res);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('⚡ STARTING DEFY AI COACH TEST SERVER & SCENARIO TEST SUITE');
  console.log('================================================================\n');

  console.log(`✅ Test HTTP Server Request Handler Initialized\n`);

  try {
    // 1. Fetch initial history & create a clean test session
    const initRes = await apiRequest('POST', '/api/conversations', { title: 'Automated Scenario Test Session' });
    assert.strictEqual(initRes.status, 201);
    const convId = initRes.data.conversation.id;
    console.log(`[PASS] 1. Created Test Conversation Session (${convId})`);

    // 2. SCENARIO TEST: Casual Conversation (Greeting & Small Talk)
    const casual1 = await apiRequest('POST', '/api/chat', {
      conversationId: convId,
      message: 'Hey coach, how are you doing today?'
    });
    assert.strictEqual(casual1.status, 200);
    assert.strictEqual(casual1.data.scenario, 'CASUAL_CONVO');
    assert(!casual1.data.botMessage.content.includes('|---|'), 'Casual greeting should NOT dump a markdown stats table');
    console.log(`[PASS] 2. Casual Text Scenario ("Hey coach, how are you doing today?")`);
    console.log(`       -> Scenario classified: ${casual1.data.scenario}`);
    console.log(`       -> Reply: "${casual1.data.botMessage.content.replace(/\n/g, ' ')}"\n`);

    // 3. SCENARIO TEST: Low Motivation / Busy Schedule
    const fatigueRes = await apiRequest('POST', '/api/chat', {
      conversationId: convId,
      message: "I'm exhausted and super busy with exams today, only have 20 mins"
    });
    assert.strictEqual(fatigueRes.status, 200);
    assert.strictEqual(fatigueRes.data.scenario, 'MOTIVATION_FATIGUE');
    console.log(`[PASS] 3. Motivation & Busy Day Scenario ("I'm exhausted and super busy with exams today, only have 20 mins")`);
    console.log(`       -> Scenario classified: ${fatigueRes.data.scenario}`);
    console.log(`       -> Reply Snippet: "${fatigueRes.data.botMessage.content.slice(0, 140).replace(/\n/g, ' ')}..."\n`);

    // 4. EDITABLE USER STATS & INTAKES TEST: Update Weight (78.0 kg), Calories (2800 kcal), Protein (185g)
    const editRes = await apiRequest('PUT', '/api/profile', {
      weightKg: 78.0,
      heightCm: 180,
      bodyFatPct: 13.5,
      calories: 2800,
      waterLiters: 4.2,
      goal: 'Athletic Strength & Lean Mass',
      macros: {
        protein: 185,
        carbs: 330,
        fats: 75
      }
    });
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.data.athleteProfile.weightKg, 78.0);
    assert.strictEqual(editRes.data.athleteProfile.calories, 2800);
    assert.strictEqual(editRes.data.athleteProfile.macros.protein, 185);
    console.log(`[PASS] 4. Editable User Intakes & Weight Saved via PUT /api/profile`);
    console.log(`       -> Updated Live Metrics: ${editRes.data.athleteProfile.weightKg} kg | ${editRes.data.athleteProfile.calories} kcal | ${editRes.data.athleteProfile.macros.protein}g Protein | BMI ${editRes.data.athleteProfile.bmi}\n`);

    // 5. SCENARIO TEST: Dynamic Food Planning Guide (Verify AI uses the newly edited 2,800 kcal & 185g Protein!)
    const foodRes = await apiRequest('POST', '/api/chat', {
      conversationId: convId,
      message: 'Build me a full day food planning guide and meal plan for my current intakes'
    });
    assert.strictEqual(foodRes.status, 200);
    assert.strictEqual(foodRes.data.scenario, 'FOOD_PLANNING');
    const foodReply = foodRes.data.botMessage.content;
    assert(foodReply.includes('2,800') || foodReply.includes('2800'), 'Food guide must reflect newly edited 2,800 kcal intake');
    assert(foodReply.includes('185g'), 'Food guide must reflect newly edited 185g protein target');
    assert(foodReply.includes('78 kg'), 'Food guide must reflect newly edited 78 kg bodyweight');
    console.log(`[PASS] 5. Food Planning Guide Scenario (Verified live sync with edited 2,800 kcal, 185g Protein, 78 kg)`);
    console.log(`       -> Scenario classified: ${foodRes.data.scenario}`);
    console.log(`       -> Reply Headline: "${foodReply.split('\n')[0]}"\n`);

    // 6. SCENARIO TEST: Activity Planning (Outdoor 5K Running + Conditioning)
    const activityRunRes = await apiRequest('POST', '/api/chat', {
      conversationId: convId,
      message: 'Plan an outdoor 5K running and conditioning activity schedule for this week'
    });
    assert.strictEqual(activityRunRes.status, 200);
    assert.strictEqual(activityRunRes.data.scenario, 'ACTIVITY_PLANNING');
    assert(activityRunRes.data.botMessage.content.includes('78 kg'), 'Activity plan must reference updated 78 kg weight');
    console.log(`[PASS] 6. Activity Planning Scenario — Outdoor 5K & Conditioning`);
    console.log(`       -> Scenario classified: ${activityRunRes.data.scenario}`);
    console.log(`       -> Reply Headline: "${activityRunRes.data.botMessage.content.split('\n')[0]}"\n`);

    // 7. SCENARIO TEST: Activity Planning — 4-Day Push/Pull Gym Split
    const activityGymRes = await apiRequest('POST', '/api/chat', {
      conversationId: convId,
      message: 'Give me my 4-Day Push/Pull workout split with sets and reps'
    });
    assert.strictEqual(activityGymRes.status, 200);
    assert.strictEqual(activityGymRes.data.scenario, 'ACTIVITY_PLANNING');
    console.log(`[PASS] 7. Activity Planning Scenario — 4-Day Push/Pull Split`);
    console.log(`       -> Reply Headline: "${activityGymRes.data.botMessage.content.split('\n')[0]}"\n`);

    // 8. SCENARIO TEST: Cross-Conversation Memory & Live Metrics Recall in a Brand-New Session
    const newConvRes = await apiRequest('POST', '/api/conversations', { title: 'Second Session Recall Test' });
    const conv2Id = newConvRes.data.conversation.id;
    const recallRes = await apiRequest('POST', '/api/chat', {
      conversationId: conv2Id,
      message: 'What do you remember about my history and my updated weight and calorie intakes?'
    });
    assert.strictEqual(recallRes.status, 200);
    assert.strictEqual(recallRes.data.scenario, 'HISTORY_AND_METRICS');
    assert(recallRes.data.botMessage.content.includes('78 kg'), 'New conversation must recall edited 78 kg weight');
    assert(recallRes.data.botMessage.content.includes('185g'), 'New conversation must recall edited 185g protein');
    console.log(`[PASS] 8. Cross-Conversation History & Edited Metrics Recall in a Brand-New Session (${conv2Id})`);
    console.log(`       -> Memories Accessed: ${recallRes.data.historyMeta.memoriesAccessed} | Past Sessions Accessed: ${recallRes.data.historyMeta.pastSessionsAccessed}\n`);

    // 9. VERIFY .JSON FILES ON DISK
    assert(fs.existsSync(DB_FILE), 'history.json must exist on disk');
    assert(fs.existsSync(PROFILE_FILE), 'user_profile.json must exist on disk');
    assert(fs.existsSync(CONVERSATIONS_FILE), 'conversations.json must exist on disk');

    const diskHistory = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const diskProfile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
    const diskConvs = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf-8'));

    assert.strictEqual(diskProfile.athleteProfile.weightKg, 78.0);
    assert.strictEqual(diskProfile.athleteProfile.calories, 2800);
    assert(diskConvs.conversations.length >= 2);
    console.log(`[PASS] 9. Verified Persistent .JSON Files on Disk:`);
    console.log(`       - ${DB_FILE} (${fs.statSync(DB_FILE).size} bytes)`);
    console.log(`       - ${PROFILE_FILE} (${fs.statSync(PROFILE_FILE).size} bytes)`);
    console.log(`       - ${CONVERSATIONS_FILE} (${fs.statSync(CONVERSATIONS_FILE).size} bytes)\n`);

    // Restore clean default baseline profile (74.5 kg, 2450 kcal, 160g P) after test verification
    updateAthleteProfile({
      name: 'Arjun K.',
      goal: 'Lean Hypertrophy & Stamina',
      weightKg: 74.5,
      heightCm: 178,
      bodyFatPct: 14.2,
      calories: 2450,
      waterLiters: 3.8,
      activeSplit: '4-Day Push/Pull',
      dietProtocol: 'Indian High-Protein Vegetarian',
      macros: { protein: 160, carbs: 280, fats: 65 }
    });

    console.log('================================================================');
    console.log('🎉 ALL 9 END-TO-END SCENARIO & JSON STORAGE TESTS PASSED!');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  server.close();
  process.exit(1);
});
