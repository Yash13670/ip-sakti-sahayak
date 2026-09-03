/**
 * LLM Service Abstraction
 * Generates evidence-grounded answers.
 * Primary: OpenRouter → Fallback: Gemini → Fallback: Local template
 */

import type { ParsedInput, RetrievedEvidence } from '../types';
import {
  isOpenRouterConfigured, isGeminiConfigured,
  chatCompletion, checkOpenRouterStatus, checkGeminiStatus,
} from './gemini';

let statusChecked = false;

async function ensureStatusChecked(): Promise<void> {
  if (!statusChecked) {
    await Promise.all([checkOpenRouterStatus(), checkGeminiStatus()]);
    statusChecked = true;
  }
}

export async function isLLMConnected(): Promise<boolean> {
  await ensureStatusChecked();
  return isOpenRouterConfigured() || isGeminiConfigured();
}

// Synchronous check after status has been fetched
export function isLLMConnectedSync(): boolean {
  return isOpenRouterConfigured() || isGeminiConfigured();
}

export async function generateGroundedAnswer(
  input: ParsedInput,
  evidence: RetrievedEvidence[]
): Promise<string> {
  await ensureStatusChecked();

  // Try OpenRouter first
  if (isOpenRouterConfigured()) {
    try {
      console.log('[LLM] Using OpenRouter for answer generation');
      return await generateWithLLM(input, evidence);
    } catch (err) {
      console.warn('[LLM] OpenRouter answer generation failed, trying Gemini:', err);
    }
  }

  // Try Gemini fallback
  if (isGeminiConfigured()) {
    try {
      console.log('[LLM] Using Gemini for answer generation');
      return await generateWithLLM(input, evidence);
    } catch (err) {
      console.warn('[LLM] Gemini answer generation failed, using local fallback:', err);
    }
  }

  console.log('[LLM] Using local fallback for answer generation');
  return generateLocal(input, evidence);
}

// ─── LLM-powered Answer Generation ──────────────────────────────────────

async function generateWithLLM(
  input: ParsedInput,
  evidence: RetrievedEvidence[]
): Promise<string> {
  // Build the evidence block for Gemini
  const evidenceBlock = evidence.slice(0, 8).map((e, i) => {
    return `[Source ${i + 1}] ${e.chunk.source_name} — ${e.chunk.provision} (p.${e.chunk.page_number})
${e.chunk.actual_text.substring(0, 1500)}`;
  }).join('\n\n---\n\n');

  const systemInstruction = `You are an IP/TK screening assistant for AYUSH innovators.
Answer ONLY from the supplied evidence.
Do NOT invent legal provisions, facts, citations, page numbers, or source content.
If the supplied evidence is insufficient, explicitly say so.
Use cautious wording: "may be relevant", "requires further assessment", "the retrieved evidence indicates", "preliminary screening".
Never claim "Patent guaranteed", "Definitely patentable", or "Definitely not patentable".
Always include a disclaimer that this is preliminary screening only.`;

  const prompt = `Based on the following retrieved evidence from the legal knowledge base, provide a preliminary IP/TK screening assessment for this formulation.

PRODUCT: ${input.productName}
INGREDIENTS: ${input.ingredients.join(', ') || 'Not specified'}
DESCRIPTION: ${input.description || 'Not provided'}
TRADITIONAL KNOWLEDGE REFERENCE: ${input.traditionalReference}
INNOVATION TYPE: ${input.innovationType}
JURISDICTION: ${input.jurisdiction}

RETRIEVED EVIDENCE:
${evidenceBlock}

Provide your assessment in this format:
## Preliminary IP/TK Screening Summary
[1-2 sentence summary]

## Relevant Legal Provisions
[List each relevant provision from the evidence, citing source name, provision, and page]

## Why This Evidence Is Relevant
[Explain how the evidence connects to the formulation]

## Ingredient Considerations
[Note any ingredient-specific considerations from the evidence]

## Preliminary Risk Assessment
[Based on evidence, note any risk factors]

## Recommended Next Steps
[2-3 concrete next steps]

---
**Disclaimer**: IP-SAKTI Sahayak provides preliminary IP/TK screening assistance only. This assessment is based on evidence retrieved from the current knowledge base and does not constitute legal advice or a patentability opinion. Consult a qualified IP professional for final legal assessment.`;

  const response = await chatCompletion(prompt, systemInstruction);
  return response;
}

// ─── Local Template Fallback ──────────────────────────────────────────────

function generateLocal(
  input: ParsedInput,
  evidence: RetrievedEvidence[]
): string {
  if (evidence.length === 0) {
    return 'Insufficient directly relevant evidence found in the current knowledge base for this formulation. A detailed prior-art search and expert consultation is recommended before proceeding with any IP filing.';
  }

  const sections: string[] = [];

  sections.push(`## Preliminary IP/TK Screening Summary`);
  sections.push('');
  sections.push(`The formulation "${input.productName}" has been screened against the available knowledge base. The following preliminary assessment is based on the retrieved evidence.`);
  sections.push('');

  sections.push(`## Relevant Legal Provisions`);
  sections.push('');
  const seenSources = new Set<string>();
  for (const e of evidence.slice(0, 6)) {
    const key = `${e.chunk.source_name}-${e.chunk.provision}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    sections.push(`- **${e.chunk.source_name}**, ${e.chunk.provision} (p.${e.chunk.page_number}): The retrieved evidence indicates this provision may be relevant to the screening of this formulation.`);
  }
  sections.push('');

  sections.push(`## Why This Evidence Is Relevant`);
  sections.push('');
  if (input.traditionalReference === 'yes' || input.traditionalReference === 'modified') {
    sections.push(`The formulation has a traditional knowledge component (${input.traditionalReference} reference). The retrieved evidence from the knowledge base discusses provisions related to traditional knowledge protection, disclosure requirements, and biodiversity-related obligations that may be relevant.`);
  } else {
    sections.push(`The formulation ingredients and innovation type were compared against the knowledge base. The retrieved evidence provides context for preliminary IP screening considerations.`);
  }
  sections.push('');

  if (input.ingredients.length > 0) {
    sections.push(`## Ingredient Considerations`);
    sections.push('');
    sections.push(`The following ingredients were identified: ${input.ingredients.join(', ')}.`);
    for (const ingredient of input.ingredients) {
      const relevantEvidence = evidence.filter(e =>
        e.chunk.actual_text.toLowerCase().includes(ingredient.toLowerCase())
      );
      if (relevantEvidence.length > 0) {
        sections.push(`- **${ingredient}**: Mentioned in retrieved evidence from ${relevantEvidence[0].chunk.source_name}. This ingredient may be relevant to biological resource or traditional knowledge considerations.`);
      }
    }
    sections.push('');
  }

  sections.push(`## Preliminary Risk Assessment`);
  sections.push('');
  sections.push(`Based on the retrieved evidence and screening rules, a preliminary risk classification will be provided. These are preliminary screening labels only and do not constitute a patentability opinion.`);
  sections.push('');

  sections.push(`## Recommended Next Steps`);
  sections.push('');
  sections.push(`1. Review the retrieved evidence and claim verification results.`);
  sections.push(`2. Consider consulting an IP professional for detailed patentability assessment.`);
  sections.push(`3. If the formulation involves biological resources, assess compliance with the Biological Diversity Act, 2002.`);
  sections.push(`4. Document the innovation and its differentiation from existing traditional knowledge.`);
  sections.push('');

  sections.push(`---`);
  sections.push('');
  sections.push(`**Disclaimer**: IP-SAKTI Sahayak provides preliminary IP/TK screening assistance only. This assessment is based on evidence retrieved from the current knowledge base and does not constitute legal advice or a patentability opinion. Consult a qualified IP professional for final legal assessment.`);

  return sections.join('\n');
}
