import { useEffect } from 'react';
import { useAppStore } from '../store';
import { getDocuments } from '../services/pipeline';
import { initKnowledgeBase } from '../services/pipeline';
import {
  Search,
  MessageSquare,
  BookOpen,
  FileText,
  Shield,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const DASHBOARD_STRINGS = [
  'Evidence-grounded preliminary IP & Traditional Knowledge screening assistant for AYUSH innovators and traditional formulation developers.',
  'Formulation Screening Wizard',
  'Assess your AYUSH formulation for preliminary IP/TK risks with evidence-grounded analysis.',
  'Start Screening',
  'Legal Chat Assistant',
  'Ask questions about IP, Traditional Knowledge, and relevant legal provisions.',
  'Ask Legal Assistant',
  'Knowledge Base Chunks',
  'Verified Sources',
  'Screening Sessions',
  'Expert Review Requests',
  'Evidence & Sources',
  'Browse the knowledge base',
  'Reports',
  'View screening reports',
  'Verification Tests',
  'Test the verification engine',
  'Disclaimer:',
  'IP-SAKTI Sahayak provides preliminary IP/TK screening assistance only. It does not constitute legal advice or a patentability opinion. Consult a qualified IP professional for final legal assessment.',
  'Dashboard',
];

export function Dashboard() {
  const { setCurrentScreen, screeningResults, escalationRequests } =
    useAppStore();
  const { t } = useTranslation(DASHBOARD_STRINGS);

  // Initialize KB on first render
  useEffect(() => {
    initKnowledgeBase().catch(() => {});
  }, []);

  const docs = getDocuments();
  const totalChunks = docs.reduce((sum, d) => sum + d.total_chunks, 0);
  const verifiedSources = docs.filter(d => d.source_status === 'Actual Source Document').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center py-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Shield className="w-10 h-10 text-accent" />
          <h1 className="text-3xl font-bold text-primary">
            IP-SAKTI <span className="text-accent">SAHAYAK</span>
          </h1>
        </div>
        <p className="text-text-secondary text-sm max-w-lg mx-auto">
          {t('Evidence-grounded preliminary IP & Traditional Knowledge screening assistant for AYUSH innovators and traditional formulation developers.')}
        </p>

      </div>

      {/* Main cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Screening Wizard */}
        <div className="bg-white rounded-xl border border-border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text mb-1">
                {t('Formulation Screening Wizard')}
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                {t('Assess your AYUSH formulation for preliminary IP/TK risks with evidence-grounded analysis.')}
              </p>
              <button
                onClick={() => setCurrentScreen('screening')}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors cursor-pointer"
              >
                {t('Start Screening')}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Legal Chat */}
        <div className="bg-white rounded-xl border border-border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text mb-1">
                {t('Legal Chat Assistant')}
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                {t('Ask questions about IP, Traditional Knowledge, and relevant legal provisions.')}
              </p>
              <button
                onClick={() => setCurrentScreen('chat')}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors cursor-pointer"
              >
                {t('Ask Legal Assistant')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-primary">{totalChunks}</div>
          <div className="text-xs text-text-secondary mt-1">
            {t('Knowledge Base Chunks')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-success">{verifiedSources}</div>
          <div className="text-xs text-text-secondary mt-1">
            {t('Verified Sources')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-accent">
            {screeningResults.length}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {t('Screening Sessions')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-warning">
            {escalationRequests.length}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {t('Expert Review Requests')}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setCurrentScreen('evidence')}
          className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left"
        >
          <BookOpen className="w-5 h-5 text-accent" />
          <div>
            <div className="text-sm font-medium text-text">{t('Evidence & Sources')}</div>
            <div className="text-xs text-text-secondary">
              {t('Browse the knowledge base')}
            </div>
          </div>
        </button>
        <button
          onClick={() => setCurrentScreen('reports')}
          className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left"
        >
          <FileText className="w-5 h-5 text-accent" />
          <div>
            <div className="text-sm font-medium text-text">{t('Reports')}</div>
            <div className="text-xs text-text-secondary">
              {t('View screening reports')}
            </div>
          </div>
        </button>
        <button
          onClick={() => setCurrentScreen('screening')}
          className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-left"
        >
          <Search className="w-5 h-5 text-accent" />
          <div>
            <div className="text-sm font-medium text-text">
              {t('Verification Tests')}
            </div>
            <div className="text-xs text-text-secondary">
              {t('Test the verification engine')}
            </div>
          </div>
        </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
        <strong>{t('Disclaimer:')}</strong> {t('IP-SAKTI Sahayak provides preliminary IP/TK screening assistance only. It does not constitute legal advice or a patentability opinion. Consult a qualified IP professional for final legal assessment.')}
      </div>
    </div>
  );
}
