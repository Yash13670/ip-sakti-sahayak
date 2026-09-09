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
const BHASHINI_API_KEY = process.env.BHASHINI_INFERENCE_KEY || '';
// NOTE: Bhashini.ai API works WITHOUT a key for basic usage.
// The X-API-KEY is optional — only for higher rate limits or premium voices.
// We do NOT send it by default to avoid 401 errors from invalid keys.
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

// ─── Bhashini AI API Helpers ────────────────────────────────────────────
// Bhashini: India's government-backed FREE translation/STT/TTS platform
// API: https://bhashini.ai  |  Auth: X-API-KEY header

const BHASHINI_BASE = 'https://bhashini.ai';
const BHASHINI_VERSION = 'v2';

// Map simple language codes to Bhashini full language names
const BHASHINI_LANG_MAP = {
  en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  or: 'Odia', as: 'Assamese', sa: 'Sanskrit', ur: 'Urdu', ne: 'Nepali',
};

// Reverse map: Bhashini name → our code
const BHASHINI_NAME_TO_CODE = {};
for (const [code, name] of Object.entries(BHASHINI_LANG_MAP)) {
  BHASHINI_NAME_TO_CODE[name] = code;
}

function toBhashiniLang(code) {
  if (!code) return 'English';
  if (BHASHINI_LANG_MAP[code]) return BHASHINI_LANG_MAP[code];
  // If it's already a full name, return as-is
  if (BHASHINI_NAME_TO_CODE[code]) return code;
  return 'English';
}

function fromBhashiniLang(name) {
  if (!name) return 'en';
  return BHASHINI_NAME_TO_CODE[name] || 'en';
}

async function bhashiniTranslate(text, sourceLanguage, targetLanguage) {
  const src = sourceLanguage === 'auto' || !sourceLanguage ? 'Auto' : toBhashiniLang(sourceLanguage);
  const tgt = toBhashiniLang(targetLanguage);

  const res = await fetch(`${BHASHINI_BASE}/${BHASHINI_VERSION}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputText: text,
      inputLanguage: src,
      outputLanguage: tgt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini translate error: ${res.status} ${err}`);
  }

  const data = await res.json();
  // Bhashini returns { translatedSentences: [...] }
  const translated = data.translatedSentences?.[0] || text;
  return {
    translatedText: translated,
    sourceLanguage,
    targetLanguage,
  };
}

async function bhashiniSTT(audioBase64, language, audioFormat) {
  const langName = toBhashiniLang(language);
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  console.log(`[Bhashini STT] Audio: ${audioBuffer.length} bytes, format: ${audioFormat || 'unknown'}, lang: ${langName}`);

  const boundary = '----BhashiniBoundary' + Date.now();
  const contentType = audioFormat === 'webm' ? 'audio/webm' : audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
  const ext = audioFormat === 'webm' ? 'webm' : audioFormat === 'mp3' ? 'mp3' : 'wav';

  // Build multipart body
  const parts = [];
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf-8'
  ));
  parts.push(audioBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${langName}`, 'utf-8'));
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'));

  const multipartBody = Buffer.concat(parts);
  console.log(`[Bhashini STT] Sending ${multipartBody.length} bytes to Bhashini API`);

  const res = await fetch(`${BHASHINI_BASE}/${BHASHINI_VERSION}/asr`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini STT error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    text: data?.output?.[0]?.source || data?.transcript || '',
    language,
  };
}

async function bhashiniTTS(text, language, gender) {
  const langName = toBhashiniLang(language);
  const voiceName = gender === 'male' ? 'Male1' : 'Female1';

  const res = await fetch(`${BHASHINI_BASE}/${BHASHINI_VERSION}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language: langName,
      voiceName,
      ttsModelType: 'TTS v3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini TTS error: ${res.status} ${err}`);
  }

  // Bhashini TTS returns audio/mpeg directly as binary
  const audioBuffer = Buffer.from(await res.arrayBuffer());
  const audioBase64 = audioBuffer.toString('base64');
  return {
    audioContent: audioBase64,
    language,
    gender: gender || 'female',
  };
}

async function bhashiniDetectLanguage(text) {
  // Bhashini doesn't have a dedicated language detection endpoint.
  // We use translation with 'Auto' source language — the response includes detectedInputLanguages.
  const res = await fetch(`${BHASHINI_BASE}/${BHASHINI_VERSION}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputText: text.substring(0, 500),
      inputLanguage: 'Auto',
      outputLanguage: 'English',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini detect language error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const detected = data.detectedInputLanguages?.[0] || 'English';
  return {
    language: fromBhashiniLang(detected),
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

  // ─── Bhashini AI Status ────────────────────────────────────────────

  if (url === '/api/sarvam/status' && req.method === 'GET') {
    // Bhashini.ai works without a key for basic usage.
    // Test with a lightweight translation call.
    try {
      const testRes = await fetch(`${BHASHINI_BASE}/${BHASHINI_VERSION}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: 'Hello',
          inputLanguage: 'English',
          outputLanguage: 'Hindi',
        }),
      });
      if (testRes.ok) {
        return jsonResponse(res, 200, { configured: true, working: true });
      }
      console.log(`[Bhashini Status] Test failed: ${testRes.status}`);
      return jsonResponse(res, 200, {
        configured: true,
        working: false,
        error: 'api_error',
      });
    } catch (err) {
      console.error('[Bhashini Status] Test failed:', err.message);
      return jsonResponse(res, 200, { configured: true, working: false, error: 'network_error' });
    }
  }

  // Bhashini Translation (NMT)
  if (url === '/api/sarvam/translate' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text, sourceLanguage, targetLanguage } = body;
      if (!text || !sourceLanguage || !targetLanguage) {
        return jsonResponse(res, 400, { error: 'Missing required fields: text, sourceLanguage, targetLanguage' });
      }
      const result = await bhashiniTranslate(text, sourceLanguage, targetLanguage);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Bhashini Translate] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Bhashini Speech-to-Text (ASR)
  if (url === '/api/sarvam/stt' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { audioBase64, language, audioFormat } = body;
      if (!audioBase64 || !language) {
        return jsonResponse(res, 400, { error: 'Missing required fields: audioBase64, language' });
      }
      const result = await bhashiniSTT(audioBase64, language, audioFormat);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Bhashini STT] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Bhashini Text-to-Speech (TTS)
  if (url === '/api/sarvam/tts' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text, language, gender } = body;
      if (!text || !language) {
        return jsonResponse(res, 400, { error: 'Missing required fields: text, language' });
      }
      const result = await bhashiniTTS(text, language, gender || 'female');
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Bhashini TTS] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Bhashini Language Detection
  if (url === '/api/sarvam/detect-language' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { text } = body;
      if (!text) {
        return jsonResponse(res, 400, { error: 'Missing required field: text' });
      }
      const result = await bhashiniDetectLanguage(text);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Bhashini Detect Language] Error:', err.message);
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
  const bhashiniStatus = BHASHINI_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  console.log(`SERVER_READY on http://${HOST}:${PORT}`);
  console.log(`Gemini API: ${geminiStatus}`);
  console.log(`OpenRouter API: ${openrouterStatus}`);
  console.log(`Bhashini AI: ${bhashiniStatus}`);
});
