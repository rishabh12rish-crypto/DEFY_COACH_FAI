/**
 * DEFY AI Coach — Backend HTTP & REST API Server
 * - Reads API key from .env
 * - Persists all user profile edits, intakes, conversation sessions, and memories in .json files
 * - Feeds live edited user metrics directly into the AI chatbot context
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  readDb,
  writeDb,
  updateAthleteProfile,
  createConversationObject,
  extractMemoriesFromUserText
} = require('./historyStore');

const { generateCoachResponse } = require('./aiEngine');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function deriveConversationTitle(firstMessage) {
  const clean = firstMessage.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();
  if (lower.includes('4-day push/pull') || lower.includes('push/pull')) return '4-Day Push/Pull Split';
  if (lower.includes('high-protein') || lower.includes('meal plan') || lower.includes('food')) return 'Food & Meal Plan Guide';
  if (lower.includes('lower back') || lower.includes('tightness')) return 'Lower Back Mobility';
  if (lower.includes('hiit') || lower.includes('finisher') || lower.includes('5k') || lower.includes('activity')) return 'Activity & Conditioning';
  if (lower.includes('history') || lower.includes('remember')) return 'Training History Review';
  return clean.length > 34 ? clean.slice(0, 34) + '…' : clean;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    /* ========================================================================
       API ROUTES
       ======================================================================== */

    // 1. GET /api/history — Returns athlete profile, profile update history, memories, and conversations from .json files
    if (req.method === 'GET' && pathname === '/api/history') {
      const db = readDb();
      if (db.conversations.length === 0) {
        db.conversations.push(createConversationObject('Coaching Session'));
        writeDb(db);
      }
      const sortedConvs = [...db.conversations].sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      return sendJson(res, 200, {
        athleteProfile: db.athleteProfile,
        profileUpdateHistory: db.profileUpdateHistory || [],
        athleteMemories: db.athleteMemories,
        conversations: sortedConvs
      });
    }

    // 2. GET /api/profile & PUT /api/profile — View or edit athlete weight, intakes, macros, goals, etc.
    if (req.method === 'GET' && pathname === '/api/profile') {
      const db = readDb();
      return sendJson(res, 200, {
        athleteProfile: db.athleteProfile,
        profileUpdateHistory: db.profileUpdateHistory || []
      });
    }

    if (req.method === 'PUT' && pathname === '/api/profile') {
      const body = await parseJsonBody(req);
      const result = updateAthleteProfile(body);
      return sendJson(res, 200, result);
    }

    // 3. POST /api/conversations — Create a new conversation session
    if (req.method === 'POST' && pathname === '/api/conversations') {
      const body = await parseJsonBody(req);
      const db = readDb();
      const newConv = createConversationObject(body.title || 'New Coaching Session');
      db.conversations.unshift(newConv);
      writeDb(db);
      return sendJson(res, 201, {
        conversation: newConv,
        conversations: db.conversations
      });
    }

    // 4. GET / PUT / DELETE /api/conversations/:id
    const convMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (req.method === 'GET' && convMatch) {
      const convId = convMatch[1];
      const db = readDb();
      const conv = db.conversations.find(c => c.id === convId);
      if (!conv) return sendJson(res, 404, { error: 'Conversation not found' });
      return sendJson(res, 200, { conversation: conv });
    }

    if (req.method === 'PUT' && convMatch) {
      const convId = convMatch[1];
      const body = await parseJsonBody(req);
      const db = readDb();
      const conv = db.conversations.find(c => c.id === convId);
      if (!conv) return sendJson(res, 404, { error: 'Conversation not found' });

      if (typeof body.title === 'string' && body.title.trim()) {
        conv.title = body.title.trim();
      }
      if (body.clearMessages === true) {
        conv.messages = [];
      }
      conv.updatedAt = new Date().toISOString();
      writeDb(db);
      return sendJson(res, 200, { conversation: conv });
    }

    if (req.method === 'DELETE' && convMatch) {
      const convId = convMatch[1];
      const db = readDb();
      db.conversations = db.conversations.filter(c => c.id !== convId);
      if (db.conversations.length === 0) {
        db.conversations.push(createConversationObject('New Coaching Session'));
      }
      writeDb(db);
      return sendJson(res, 200, {
        conversations: db.conversations,
        activeConversation: db.conversations[0]
      });
    }

    // 5. POST /api/memories & DELETE /api/memories/:id
    if (req.method === 'POST' && pathname === '/api/memories') {
      const body = await parseJsonBody(req);
      if (!body.fact || !body.fact.trim()) {
        return sendJson(res, 400, { error: 'Memory fact is required' });
      }
      const db = readDb();
      const newMem = {
        id: 'mem-' + crypto.randomBytes(3).toString('hex') + '-' + Date.now().toString(36),
        category: body.category || 'Coach Note',
        fact: body.fact.trim(),
        sourceConversationId: body.conversationId || 'manual',
        createdAt: new Date().toISOString()
      };
      db.athleteMemories.unshift(newMem);
      writeDb(db);
      return sendJson(res, 201, {
        memory: newMem,
        athleteMemories: db.athleteMemories
      });
    }

    const memMatch = pathname.match(/^\/api\/memories\/([^/]+)$/);
    if (req.method === 'DELETE' && memMatch) {
      const memId = memMatch[1];
      const db = readDb();
      db.athleteMemories = db.athleteMemories.filter(m => m.id !== memId);
      writeDb(db);
      return sendJson(res, 200, { athleteMemories: db.athleteMemories });
    }

    // 6. POST /api/chat — Send message, store in JSON history, extract memory, and generate scenario-aware AI reply
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await parseJsonBody(req);
      const userText = (body.message || '').trim();
      if (!userText) {
        return sendJson(res, 400, { error: 'Message cannot be empty' });
      }

      const db = readDb();
      let conv = db.conversations.find(c => c.id === body.conversationId);
      if (!conv) {
        conv = createConversationObject(deriveConversationTitle(userText));
        db.conversations.unshift(conv);
      }

      if (conv.messages.length === 0 && (conv.title === 'New Coaching Session' || conv.title === 'Initial Coaching Session' || conv.title === 'Coaching Session')) {
        conv.title = deriveConversationTitle(userText);
      }

      const now = new Date().toISOString();
      const userMessage = {
        id: 'msg-' + crypto.randomBytes(4).toString('hex'),
        role: 'user',
        content: userText,
        timestamp: now,
        inputMethod: body.inputMethod || 'text'
      };
      conv.messages.push(userMessage);
      conv.updatedAt = now;

      const newMemories = extractMemoriesFromUserText(userText, conv.id, db);
      writeDb(db);

      const aiResult = await generateCoachResponse({
        conversationId: conv.id,
        userText,
        conversationMessages: conv.messages
      });

      const botMessage = {
        id: 'msg-' + crypto.randomBytes(4).toString('hex'),
        role: 'assistant',
        content: aiResult.reply,
        scenario: aiResult.scenario,
        timestamp: new Date().toISOString()
      };

      const updatedDb = readDb();
      const targetConv = updatedDb.conversations.find(c => c.id === conv.id);
      if (targetConv) {
        targetConv.messages.push(botMessage);
        targetConv.updatedAt = botMessage.timestamp;
      }
      writeDb(updatedDb);

      return sendJson(res, 200, {
        conversation: targetConv || conv,
        userMessage,
        botMessage,
        scenario: aiResult.scenario,
        newMemories,
        athleteProfile: updatedDb.athleteProfile,
        athleteMemories: updatedDb.athleteMemories,
        historyMeta: aiResult.historyMeta
      });
    }

    /* ========================================================================
       STATIC FRONTEND FILE SERVER
       ======================================================================== */
    let safePath = pathname === '/' ? '/index.html' : pathname;
    safePath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(FRONTEND_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const indexFile = path.join(FRONTEND_DIR, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexFile).pipe(res);
      } else {
        sendJson(res, 404, { error: 'Resource not found' });
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n⚡ DEFY Athletic Intelligence Server running at http://localhost:${PORT}`);
    console.log(`   - JSON Storage: backend/data/history.json, user_profile.json, conversations.json`);
    console.log(`   - API Key loaded securely from .env\n`);
  });
}

module.exports = { server };
