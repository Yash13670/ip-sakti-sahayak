/**
 * Translates AI-generated content to the user's selected language.
 * Used after LLM generates English content to provide multilingual output.
 */

const PROXY_BASE = '/api/sarvam';

/**
 * Translate a long text chunk to the target language.
 * Sends in parts if text is too long (Sarvam limit: 1000 chars per request).
 */
async function translateChunk(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'en') return text;

  const res = await fetch(`${PROXY_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.substring(0, 990), // Sarvam mayura limit
      sourceLanguage: 'en',
      targetLanguage: targetLang,
    }),
  });

  if (!res.ok) {
    console.error('[TranslateOutput] Translation failed:', res.status);
    return text; // Fallback to original
  }

  const data = await res.json();
  return data.translatedText || text;
}

/**
 * Translate a screening result's user-facing text fields.
 * Returns a new object with translated answer, risk reason, and next step.
 */
export async function translateScreeningOutput<T extends {
  generated_answer: string;
  risk_reason: string;
  recommended_next_step: string;
}>(result: T, language: string): Promise<T> {
  if (language === 'en') return result;

  try {
    // Translate the three main text fields in parallel
    const [answer, riskReason, nextStep] = await Promise.all([
      translateChunk(result.generated_answer, language),
      translateChunk(result.risk_reason, language),
      translateChunk(result.recommended_next_step, language),
    ]);

    return {
      ...result,
      generated_answer: answer,
      risk_reason: riskReason,
      recommended_next_step: nextStep,
    };
  } catch (err) {
    console.error('[TranslateOutput] Failed to translate screening output:', err);
    return result;
  }
}

/**
 * Translate a chat message's content.
 */
export async function translateChatMessage(content: string, language: string): Promise<string> {
  if (language === 'en') return content;

  try {
    return await translateChunk(content, language);
  } catch (err) {
    console.error('[TranslateOutput] Failed to translate chat message:', err);
    return content;
  }
}
