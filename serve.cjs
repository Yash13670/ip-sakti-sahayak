/**
 * Server-side proxy for Gemini & OpenRouter APIs.
 * Keeps API keys secure — never exposed to browser.
 * Caches embeddings to avoid re-generating on every load.
 *
 * Gemini Endpoints:
 *   GET  /api/gemini/status    → { configured: boolean }
 *   POST /api/gemini/chat      → { text: string }
 *   POST /api/gemini/embed     → { embedding: number[] }
 *   POST /api/gemini/embed-batch → { embeddings: number[][] }
 *
 * OpenRouter Endpoints:
 *   GET  /api/openrouter/status       → { configured: boolean }
 *   POST /api/openrouter/embed        → { embedding: number[] }
 *   POST /api/openrouter/embed-batch  → { embeddings: number[][] }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const DIST = path.join(__dirname, 'dist');
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'gemini-embedding-2';
const CHAT_MODEL = 'gemini-2.5-flash';

// ─── Embedding Cache ──────────────────────────────────────────────────────

const embeddingCachePath = path.join(__dirname, '.gemini-embed-cache.json');
let embeddingCache = {};

function loadEmbeddingCache() {
  try {
    if (fs.existsSync(embeddingCachePath)) {
      embeddingCache = JSON.parse(fs.readFileSync(embeddingCachePath, 'utf-8'));
      console.log(`[Cache] Loaded ${Object.keys(embeddingCache).length} cached embeddings`);
    }
  } catch { /* ignore */ }
}

function saveEmbeddingCache() {
  try {
    fs.writeFileSync(embeddingCachePath, JSON.stringify(embeddingCache));
  } catch { /* ignore */ }
}

function hashText(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

loadEmbeddingCache();

// ─── Gemini API Helpers ───────────────────────────────────────────────────

async function geminiEmbed(text) {
  const key = hashText('gemini:' + text);
  if (embeddingCache[key]) return embeddingCache[key];

  const url = `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embed error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const embedding = data.embedding.values;
  embeddingCache[key] = embedding;
  // Save cache periodically (every 50 new embeddings)
  if (Object.keys(embeddingCache).length % 50 === 0) {
    saveEmbeddingCache();
  }
  return embedding;
}

async function geminiChat(prompt, systemInstruction) {
  const url = `${GEMINI_BASE}/models/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini chat error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

// ─── OpenRouter API Helpers ───────────────────────────────────────────────

async function openrouterEmbed(text, model) {
  const key = hashText('openrouter:' + (model || 'default') + ':' + text);
  if (embeddingCache[key]) return embeddingCache[key];

  const embedModel = model || 'openai/text-embedding-3-small';

  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: embedModel,
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embed error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error('No embedding in OpenRouter response');
  embeddingCache[key] = embedding;
  if (Object.keys(embeddingCache).length % 50 === 0) {
    saveEmbeddingCache();
  }
  return embedding;
}

// OpenRouter chat completion
async function openrouterChat(prompt, systemInstruction, model) {
  const chatModel = model || 'google/gemini-2.5-flash';
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:5210',
      'X-Title': 'IP-SAKTI Sahayak',
    },
    body: JSON.stringify({
      model: chatModel,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter chat error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenRouter');
  return text;
}

// ─── Sarvam AI API Helpers ──────────────────────────────────────────────

const SARVAM_BASE = 'https://api.sarvam.ai';

// Map simple language codes to Sarvam BCP-47 codes
const SARVAM_LANG_MAP = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN',
  mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
  or: 'od-IN', as: 'as-IN', sa: 'sa-IN', ur: 'ur-IN', ne: 'ne-IN',
};

function toSarvamLang(code) {
  if (!code) return 'en-IN';
  if (code.includes('-IN')) return code;
  return SARVAM_LANG_MAP[code] || `${code}-IN`;
}

function fromSarvamLang(code) {
  if (!code) return 'en';
  return code.replace('-IN', '').replace('-in', '');
}

async function sarvamTranslate(text, sourceLanguage, targetLanguage) {
  const src = toSarvamLang(sourceLanguage);
  const tgt = toSarvamLang(targetLanguage);

  // Languages not supported by mayura:v1 need sarvam-translate:v1
  const mayuraLangs = ['en-IN','hi-IN','bn-IN','ta-IN','te-IN','mr-IN','gu-IN','kn-IN','ml-IN','pa-IN','od-IN'];
  const needsTranslateV1 = !mayuraLangs.includes(tgt) || (src !== 'auto' && !mayuraLangs.includes(src));
  const model = needsTranslateV1 ? 'sarvam-translate:v1' : 'mayura:v1';

  const res = await fetch(`${SARVAM_BASE}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: src === tgt ? 'auto' : src,
      target_language_code: tgt,
      speaker_gender: 'Female',
      mode: 'formal',
      model,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam translate error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    translatedText: data.translated_text || text,
    sourceLanguage,
    targetLanguage,
  };
}

async function sarvamSTT(audioBase64, language) {
  // Sarvam STT expects multipart/form-data with a file upload.
  // We decode the base64 audio and create a FormData request.
  const langCode = toSarvamLang(language);
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const boundary = '----SarvamBoundary' + Date.now();

  // Build multipart body manually
  let body = '';
  // file field
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n`;
  body += `Content-Type: audio/wav\r\n\r\n`;
  const preamble = Buffer.from(body, 'utf-8');
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

  // model field
  const modelPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v3\r\n`,
    'utf-8'
  );
  // language_code field
  const langPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${langCode}\r\n`,
    'utf-8'
  );

  const multipartBody = Buffer.concat([preamble, audioBuffer, modelPart, langPart, epilogue]);

  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam STT error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    text: data.transcript || '',
    language: fromSarvamLang(data.language_code) || language,
  };
}

async function sarvamTTS(text, language, gender) {
  const langCode = toSarvamLang(language);
  const speaker = gender === 'male' ? 'aditya' : 'priya';

  const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({
      text,
      language_code: langCode,
      speaker,
      model: 'bulbul:v3',
      pace: 1.0,
      speech_sample_rate: 24000,
      output_audio_codec: 'mp3',
      output_audio_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam TTS error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    audioContent: data.audios?.[0] || '',
    language,
    gender: gender || 'female',
  };
}

async function sarvamDetectLanguage(text) {
  const res = await fetch(`${SARVAM_BASE}/text-lid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam language detection error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    language: fromSarvamLang(data.language_code) || 'en',
    confidence: 1.0,
  };
}

// ─── Request Helpers ──────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // ─── API Routes ────────────────────────────────────────────────────

  // Gemini status check
  if (url === '/api/gemini/status' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      configured: !!GEMINI_API_KEY,
      model: CHAT_MODEL,
      embeddingModel: EMBEDDING_MODEL,
    });
  }

  // Gemini chat completions
  if (url === '/api/gemini/chat' && req.method === 'POST') {
    if (!GEMINI_API_KEY) {
      return jsonResponse(res, 503, { error: 'Gemini API key not configured' });
    }
    try {
      const body = await readBody(req);
      const text = await geminiChat(body.prompt, body.systemInstruction);
      return jsonResponse(res, 200, { text });
    } catch (err) {
      console.error('[Gemini Chat] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Single embedding
  if (url === '/api/gemini/embed' && req.method === 'POST') {
    if (!GEMINI_API_KEY) {
      return jsonResponse(res, 503, { error: 'Gemini API key not configured' });
    }
    try {
      const body = await readBody(req);
      const embedding = await geminiEmbed(body.text);
      return jsonResponse(res, 200, { embedding });
    } catch (err) {
      console.error('[Gemini Embed] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Batch embeddings
  if (url === '/api/gemini/embed-batch' && req.method === 'POST') {
    if (!GEMINI_API_KEY) {
      return jsonResponse(res, 503, { error: 'Gemini API key not configured' });
    }
    try {
      const body = await readBody(req);
      const texts = body.texts;
      const embeddings = [];

      // Process in batches of 5 to respect rate limits
      for (let i = 0; i < texts.length; i += 5) {
        const batch = texts.slice(i, i + 5);
        const results = await Promise.all(batch.map(t => geminiEmbed(t)));
        embeddings.push(...results);
        // Delay between batches
        if (i + 5 < texts.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // Save cache after batch operation
      saveEmbeddingCache();
      return jsonResponse(res, 200, { embeddings, count: embeddings.length });
    } catch (err) {
      console.error('[Gemini Embed Batch] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ─── OpenRouter Status ──────────────────────────────────────────────

  if (url === '/api/openrouter/status' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      configured: !!OPENROUTER_API_KEY,
    });
  }

  // OpenRouter single embedding
  if (url === '/api/openrouter/embed' && req.method === 'POST') {
    if (!OPENROUTER_API_KEY) {
      return jsonResponse(res, 503, { error: 'OpenRouter API key not configured' });
    }
    try {
      const body = await readBody(req);
      const embedding = await openrouterEmbed(body.text, body.model);
      return jsonResponse(res, 200, { embedding });
    } catch (err) {
      console.error('[OpenRouter Embed] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // OpenRouter batch embeddings
  if (url === '/api/openrouter/embed-batch' && req.method === 'POST') {
    if (!OPENROUTER_API_KEY) {
      return jsonResponse(res, 503, { error: 'OpenRouter API key not configured' });
    }
    try {
      const body = await readBody(req);
      const texts = body.texts;
      const model = body.model;
      const embeddings = [];

      for (let i = 0; i < texts.length; i += 5) {
        const batch = texts.slice(i, i + 5);
        const results = await Promise.all(batch.map(t => openrouterEmbed(t, model)));
        embeddings.push(...results);
        if (i + 5 < texts.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      saveEmbeddingCache();
      return jsonResponse(res, 200, { embeddings, count: embeddings.length });
    } catch (err) {
      console.error('[OpenRouter Embed Batch] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // OpenRouter chat completion
  if (url === '/api/openrouter/chat' && req.method === 'POST') {
    if (!OPENROUTER_API_KEY) {
      return jsonResponse(res, 503, { error: 'OpenRouter API key not configured' });
    }
    try {
      const body = await readBody(req);
      const text = await openrouterChat(body.prompt, body.systemInstruction, body.model);
      return jsonResponse(res, 200, { text });
    } catch (err) {
      console.error('[OpenRouter Chat] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ─── Sarvam AI Status ─────────────────────────────────────────────

  if (url === '/api/sarvam/status' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      configured: !!SARVAM_API_KEY,
    });
  }

  // Sarvam Translation (NMT)
  if (url === '/api/sarvam/translate' && req.method === 'POST') {
    if (!SARVAM_API_KEY) {
      return jsonResponse(res, 503, { error: 'Sarvam AI not configured. Set SARVAM_API_KEY in .env' });
    }
    try {
      const body = await readBody(req);
      const { text, sourceLanguage, targetLanguage } = body;
      if (!text || !sourceLanguage || !targetLanguage) {
        return jsonResponse(res, 400, { error: 'Missing required fields: text, sourceLanguage, targetLanguage' });
      }
      const result = await sarvamTranslate(text, sourceLanguage, targetLanguage);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Sarvam Translate] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Sarvam Speech-to-Text (ASR)
  if (url === '/api/sarvam/stt' && req.method === 'POST') {
    if (!SARVAM_API_KEY) {
      return jsonResponse(res, 503, { error: 'Sarvam AI not configured' });
    }
    try {
      const body = await readBody(req);
      const { audioBase64, language } = body;
      if (!audioBase64 || !language) {
        return jsonResponse(res, 400, { error: 'Missing required fields: audioBase64, language' });
      }
      const result = await sarvamSTT(audioBase64, language);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Sarvam STT] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Sarvam Text-to-Speech (TTS)
  if (url === '/api/sarvam/tts' && req.method === 'POST') {
    if (!SARVAM_API_KEY) {
      return jsonResponse(res, 503, { error: 'Sarvam AI not configured' });
    }
    try {
      const body = await readBody(req);
      const { text, language, gender } = body;
      if (!text || !language) {
        return jsonResponse(res, 400, { error: 'Missing required fields: text, language' });
      }
      const result = await sarvamTTS(text, language, gender || 'female');
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Sarvam TTS] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Sarvam Text Language Detection
  if (url === '/api/sarvam/detect-language' && req.method === 'POST') {
    if (!SARVAM_API_KEY) {
      return jsonResponse(res, 503, { error: 'Sarvam AI not configured' });
    }
    try {
      const body = await readBody(req);
      const { text } = body;
      if (!text) {
        return jsonResponse(res, 400, { error: 'Missing required field: text' });
      }
      const result = await sarvamDetectLanguage(text);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Sarvam Detect Language] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // ─── PDF Document Serving ─────────────────────────────────────────

  if (url.startsWith('/docs/')) {
    const docName = decodeURIComponent(url.slice(6)); // remove '/docs/'
    const docPath = path.join(__dirname, docName);
    // Prevent path traversal
    if (!docPath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const ext = path.extname(docName).toLowerCase();
    if (ext !== '.pdf' && ext !== '.PDF') {
      res.writeHead(400);
      res.end('Only PDF files are served');
      return;
    }
    fs.readFile(docPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Document not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${path.basename(docName)}"`,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(data);
    });
    return;
  }

  // ─── Static File Serving ───────────────────────────────────────────

  let filePath = url;
  if (filePath === '/') filePath = '/index.html';

  const fullPath = path.join(DIST, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(500); res.end('Error'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = parseInt(process.env.PORT, 10) || 5210;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const geminiStatus = GEMINI_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  const openrouterStatus = OPENROUTER_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  const sarvamStatus = SARVAM_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  console.log(`SERVER_READY on http://${HOST}:${PORT}`);
  console.log(`Gemini API: ${geminiStatus}`);
  console.log(`OpenRouter API: ${openrouterStatus}`);
  console.log(`Sarvam AI: ${sarvamStatus}`);
});
