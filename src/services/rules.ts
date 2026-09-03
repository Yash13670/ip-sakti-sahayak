/**
 * Screening Rules Engine
 * Transparent rule-based screening layer.
 */

import type {
  ParsedInput,
  ScreeningRule,
  RiskLevel,
  ClaimVerificationResult,
  RetrievedEvidence,
} from '../types';

export function applyScreeningRules(
  input: ParsedInput,
  evidence: RetrievedEvidence[]
): ScreeningRule[] {
  const rules: ScreeningRule[] = [];

  // Rule 1: Traditional Knowledge involvement
  rules.push({
    rule_id: 'TK_01',
    name: 'Traditional Knowledge Involvement',
    description:
      input.traditionalReference === 'yes' || input.traditionalReference === 'modified'
        ? 'The formulation is connected to traditional knowledge, which may require TK-related IP considerations.'
        : 'No direct traditional knowledge reference identified.',
    triggered: input.traditionalReference === 'yes' || input.traditionalReference === 'modified',
    risk_contribution: input.traditionalReference === 'yes' ? 'high' : 'medium',
  });

  // Rule 2: Biological Resource involvement
  const hasBiological = evidence.some(
    e =>
      e.chunk.actual_text.toLowerCase().includes('biological resource') ||
      e.chunk.actual_text.toLowerCase().includes('genetic resource') ||
      e.chunk.actual_text.toLowerCase().includes('biodiversity')
  );
  rules.push({
    rule_id: 'BIO_01',
    name: 'Biological Resource Consideration',
    description:
      hasBiological
        ? 'The retrieved evidence indicates potential relevance of biological/genetic resources legislation.'
        : 'No strong biological resource indicators found in evidence.',
    triggered: hasBiological,
    risk_contribution: hasBiological ? 'medium' : 'low',
  });

  // Rule 3: Minor modification concern
  rules.push({
    rule_id: 'MOD_01',
    name: 'Modification Assessment',
    description:
      input.innovationType === 'new_dosage'
        ? 'New dosage/formulation modifications may face novelty questions in patent examination.'
        : input.innovationType === 'traditional_formulation'
        ? 'Traditional formulations as-is may not meet novelty requirements for patent protection.'
        : 'Innovation type assessment completed.',
    triggered:
      input.innovationType === 'new_dosage' || input.innovationType === 'traditional_formulation',
    risk_contribution:
      input.innovationType === 'traditional_formulation' ? 'high' : 'medium',
  });

  // Rule 4: Novelty / prior-art assessment
  const hasNoveltyIssues = evidence.some(
    e =>
      e.chunk.actual_text.toLowerCase().includes('novelty') ||
      e.chunk.actual_text.toLowerCase().includes('prior art') ||
      e.chunk.actual_text.toLowerCase().includes('inventive step')
  );
  rules.push({
    rule_id: 'NOV_01',
    name: 'Novelty / Prior-Art Consideration',
    description:
      hasNoveltyIssues
        ? 'The retrieved evidence discusses novelty or inventive step requirements that may be relevant.'
        : 'No specific novelty-related provisions found in retrieved evidence.',
    triggered: hasNoveltyIssues,
    risk_contribution: 'medium',
  });

  // Rule 5: New process/composition (positive indicator)
  rules.push({
    rule_id: 'INN_01',
    name: 'Innovation Type Assessment',
    description:
      input.innovationType === 'new_process' || input.innovationType === 'new_composition'
        ? 'New process or composition innovations may have stronger patentability prospects, subject to novelty and non-obviousness assessment.'
        : 'Innovation type recorded.',
    triggered:
      input.innovationType === 'new_process' || input.innovationType === 'new_composition',
    risk_contribution: 'low',
  });

  // Rule 6: Evidence strength
  const highScoreEvidence = evidence.filter(e => e.finalScore > 0.3).length;
  rules.push({
    rule_id: 'EVD_01',
    name: 'Evidence Strength',
    description:
      highScoreEvidence >= 3
        ? `${highScoreEvidence} high-relevance evidence items found in the knowledge base.`
        : highScoreEvidence >= 1
        ? `${highScoreEvidence} moderately relevant evidence item(s) found.`
        : 'Limited relevant evidence found in the current knowledge base.',
    triggered: true,
    risk_contribution: highScoreEvidence >= 3 ? 'low' : 'medium',
  });

  // Rule 7: Jurisdiction-specific considerations
  rules.push({
    rule_id: 'JRS_01',
    name: 'Jurisdiction Consideration',
    description:
      input.jurisdiction === 'India'
        ? 'Indian jurisdiction routes include Patents Act 1970, Biological Diversity Act 2002, and relevant AYUSH guidelines.'
        : 'Global jurisdiction routes include WIPO treaties, Nagoya Protocol, and TRIPS Agreement.',
    triggered: true,
    risk_contribution: 'low',
  });

  return rules;
}

export function calculateRisk(
  _input: ParsedInput,
  rules: ScreeningRule[],
  verifications: ClaimVerificationResult[],
  evidence: RetrievedEvidence[]
): { level: RiskLevel; reason: string; nextStep: string } {
  let riskScore = 0;

  // Factor 1: Triggered rules
  for (const rule of rules) {
    if (rule.triggered) {
      if (rule.risk_contribution === 'high') riskScore += 3;
      else if (rule.risk_contribution === 'medium') riskScore += 2;
      else riskScore += 1;
    }
  }

  // Factor 2: Verification strength
  const supportedCount = verifications.filter(v => v.status === 'SUPPORTED').length;
  const unsupportedCount = verifications.filter(v => v.status === 'UNSUPPORTED').length;
  const totalVerifications = verifications.length;

  if (totalVerifications > 0) {
    const supportRatio = supportedCount / totalVerifications;
    if (supportRatio >= 0.7) riskScore -= 1; // Strong evidence support
    if (supportRatio < 0.3) riskScore += 2; // Weak evidence support
    if (unsupportedCount > supportedCount) riskScore += 2;
  }

  // Factor 3: Evidence availability
  if (evidence.length < 3) riskScore += 1;
  if (evidence.length === 0) riskScore += 3;

  // Determine risk level
  let level: RiskLevel;
  let reason: string;
  let nextStep: string;

  if (riskScore <= 3) {
    level = 'LOWER_INITIAL_RISK';
    reason = 'Based on the available evidence and screening rules, no major IP/TK concerns were identified in this preliminary screening. However, this does not guarantee patentability or absence of risk.';
    nextStep = 'Proceed with standard IP due diligence. Consider consulting an IP professional for detailed patentability assessment before filing.';
  } else if (riskScore <= 7) {
    level = 'FURTHER_ASSESSMENT';
    reason = 'Some relevant IP/TK considerations were identified that require deeper analysis. The retrieved evidence suggests areas that warrant professional review.';
    nextStep = 'Consult an IP professional specializing in traditional knowledge and pharmaceutical patents. Prepare a detailed prior-art search and novelty analysis.';
  } else {
    level = 'REVIEW_REQUIRED';
    reason = 'Strong IP/TK concerns identified in the preliminary screening. The combination of traditional knowledge involvement and the nature of the innovation requires expert assessment.';
    nextStep = 'Escalate to an IP expert for detailed review. Consider biodiversity compliance requirements and traditional knowledge documentation before proceeding.';
  }

  return { level, reason, nextStep };
}
