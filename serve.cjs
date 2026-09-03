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
const BHASHINI_USER_ID = process.env.BHASHINI_USER_ID || '';
const BHASHINI_ULCA_API_KEY = process.env.BHASHINI_ULCA_API_KEY || '';
const BHASHINI_AUTH_KEY = process.env.BHASHINI_AUTH_KEY || '';
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

// ─── Bhashini API Helpers ────────────────────────────────────────────────

const BHASHINI_ULCA_BASE = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0';
const BHASHINI_DHRUVA_BASE = 'https://dhruva-api.bhashini.gov.in/services/inference';

// Cache pipeline configs to avoid repeated lookups
let bhashiniPipelineCache = {};

async function bhashiniGetPipelineConfig(pipelineId, taskType) {
  const cacheKey = `${pipelineId}:${taskType}`;
  if (bhashiniPipelineCache[cacheKey]) return bhashiniPipelineCache[cacheKey];

  const res = await fetch(`${BHASHINI_ULCA_BASE}/model/getModelsPipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'userID': BHASHINI_USER_ID,
      'ulcaApiKey': BHASHINI_ULCA_API_KEY,
    },
    body: JSON.stringify({
      pipelineId,
      taskType,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini pipeline config error: ${res.status} ${err}`);
  }

  const data = await res.json();
  bhashiniPipelineCache[cacheKey] = data;
  return data;
}

async function bhashiniTranslate(text, sourceLanguage, targetLanguage) {
  // Pipeline for NMT: use ai4bharat/indictrans-v2-all-gpu--t4
  const config = await bhashiniGetPipelineConfig('445f97df-8e97-4f7e-b5c3-ccae5add253c', 'translation');

  const pipelineConfig = config?.pipelineResponse?.[0];
  if (!pipelineConfig) throw new Error('No pipeline config returned for translation');

  const computeEndpoint = config.pipelineInferenceAPIEnfPoint?.callbackURL;
  const authKey = config.pipelineInferenceAPIEnfPoint?.inferenceApiKey?.value;
  const serviceName = config.pipelineInferenceAPIEnfPoint?.inferenceApiKey?.name;

  if (!computeEndpoint) throw new Error('No compute endpoint in pipeline config');

  const res = await fetch(computeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authKey || BHASHINI_AUTH_KEY,
    },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'translation',
        config: {
          language: { sourceLanguage, targetLanguage },
          serviceId: pipelineConfig.config?.serviceId,
        },
      }],
      inputData: {
        input: [{ source: text }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini translation compute error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const output = data.pipelineResponse?.[0]?.output?.[0]?.target;
  return {
    translatedText: output || text,
    sourceLanguage,
    targetLanguage,
  };
}

async function bhashiniSTT(audioBase64, language) {
  // Pipeline for ASR: use multilingual conformer
  const config = await bhashiniGetPipelineConfig('6b7071d0-da09-442f-93f7-a0af754ef38b', 'asr');

  const pipelineConfig = config?.pipelineResponse?.[0];
  if (!pipelineConfig) throw new Error('No pipeline config returned for ASR');

  const computeEndpoint = config.pipelineInferenceAPIEnfPoint?.callbackURL;
  const authKey = config.pipelineInferenceAPIEnfPoint?.inferenceApiKey?.value;

  if (!computeEndpoint) throw new Error('No compute endpoint in pipeline config');

  const res = await fetch(computeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authKey || BHASHINI_AUTH_KEY,
    },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'asr',
        config: {
          language: { sourceLanguage: language },
          serviceId: pipelineConfig.config?.serviceId,
          audioFormat: 'wav',
          samplingRate: 16000,
        },
      }],
      inputData: {
        input: [{ source: null }],
        audio: [{ audioContent: audioBase64 }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini STT compute error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const output = data.pipelineResponse?.[0]?.output?.[0]?.source;
  return {
    text: output || '',
    language,
  };
}

async function bhashiniTTS(text, language, gender) {
  // Pipeline for TTS: use IIT Madras model
  const config = await bhashiniGetPipelineConfig('db7b4b06-b636-49f5-bc66-6a705eb62b8d', 'tts');

  const pipelineConfig = config?.pipelineResponse?.[0];
  if (!pipelineConfig) throw new Error('No pipeline config returned for TTS');

  const computeEndpoint = config.pipelineInferenceAPIEnfPoint?.callbackURL;
  const authKey = config.pipelineInferenceAPIEnfPoint?.inferenceApiKey?.value;

  if (!computeEndpoint) throw new Error('No compute endpoint in pipeline config');

  const res = await fetch(computeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authKey || BHASHINI_AUTH_KEY,
    },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'tts',
        config: {
          language: { sourceLanguage: language },
          serviceId: pipelineConfig.config?.serviceId,
          gender,
          speed: 1.0,
        },
      }],
      inputData: {
        input: [{ source: text }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini TTS compute error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const audioContent = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
  return {
    audioContent: audioContent || '',
    language,
    gender,
  };
}

async function bhashiniDetectLanguage(text) {
  const res = await fetch(`${BHASHINI_DHRUVA_BASE}/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': BHASHINI_AUTH_KEY,
      'Accept': '*/*',
    },
    body: JSON.stringify({
      pipelineTasks: [{
        taskType: 'language-detection',
        config: {
          serviceId: 'bhashini/indic-lang-detection-all',
        },
      }],
      inputData: {
        input: [{ source: text }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bhashini language detection error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const langTag = data.pipelineResponse?.[0]?.output?.[0]?.lang === 'unknown'
    ? 'en'
    : data.pipelineResponse?.[0]?.output?.[0]?.lang || 'en';
  return {
    language: langTag,
    confidence: data.pipelineResponse?.[0]?.output?.[0]?.confidence || 0,
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

  // ─── Bhashini Status ─────────────────────────────────────────────

  if (url === '/api/bhashini/status' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      configured: !!(BHASHINI_USER_ID && BHASHINI_ULCA_API_KEY && BHASHINI_AUTH_KEY),
      userId: !!BHASHINI_USER_ID,
      ulcaKey: !!BHASHINI_ULCA_API_KEY,
      authKey: !!BHASHINI_AUTH_KEY,
    });
  }

  // Bhashini Translation (NMT)
  if (url === '/api/bhashini/translate' && req.method === 'POST') {
    if (!BHASHINI_USER_ID || !BHASHINI_ULCA_API_KEY || !BHASHINI_AUTH_KEY) {
      return jsonResponse(res, 503, { error: 'Bhashini not configured. Set BHASHINI_USER_ID, BHASHINI_ULCA_API_KEY, BHASHINI_AUTH_KEY in .env' });
    }
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
  if (url === '/api/bhashini/stt' && req.method === 'POST') {
    if (!BHASHINI_USER_ID || !BHASHINI_ULCA_API_KEY || !BHASHINI_AUTH_KEY) {
      return jsonResponse(res, 503, { error: 'Bhashini not configured' });
    }
    try {
      const body = await readBody(req);
      const { audioBase64, language } = body;
      if (!audioBase64 || !language) {
        return jsonResponse(res, 400, { error: 'Missing required fields: audioBase64, language' });
      }
      const result = await bhashiniSTT(audioBase64, language);
      return jsonResponse(res, 200, result);
    } catch (err) {
      console.error('[Bhashini STT] Error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Bhashini Text-to-Speech (TTS)
  if (url === '/api/bhashini/tts' && req.method === 'POST') {
    if (!BHASHINI_USER_ID || !BHASHINI_ULCA_API_KEY || !BHASHINI_AUTH_KEY) {
      return jsonResponse(res, 503, { error: 'Bhashini not configured' });
    }
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

  // Bhashini Text Language Detection
  if (url === '/api/bhashini/detect-language' && req.method === 'POST') {
    if (!BHASHINI_AUTH_KEY) {
      return jsonResponse(res, 503, { error: 'Bhashini not configured' });
    }
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

server.listen(5210, '127.0.0.1', () => {
  const geminiStatus = GEMINI_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  const openrouterStatus = OPENROUTER_API_KEY ? 'CONNECTED' : 'NOT CONFIGURED';
  const bhashiniStatus = (BHASHINI_USER_ID && BHASHINI_ULCA_API_KEY && BHASHINI_AUTH_KEY) ? 'CONNECTED' : 'NOT CONFIGURED';
  console.log(`SERVER_READY on http://127.0.0.1:5210`);
  console.log(`Gemini API: ${geminiStatus}`);
  console.log(`OpenRouter API: ${openrouterStatus}`);
  console.log(`Bhashini API: ${bhashiniStatus}`);
});
