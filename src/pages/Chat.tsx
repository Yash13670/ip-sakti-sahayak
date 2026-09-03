import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { runChatPipeline } from '../services/pipeline';
import type { ChatMessage } from '../types';
import { Send, Loader2, Eye, User, Bot, Trash2 } from 'lucide-react';
import { AudioPlayer } from '../components/shared/AudioPlayer';
import { VoiceInput } from '../components/shared/VoiceInput';

export function Chat() {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    jurisdiction,
    language,
    openEvidenceModal,
    isProcessing,
    setIsProcessing,
  } = useAppStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      jurisdiction,
    };

    addChatMessage(userMessage);
    setInput('');
    setIsProcessing(true);

    try {
      const result = await runChatPipeline(input.trim(), jurisdiction, undefined, language);

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: result.generated_answer,
        timestamp: new Date().toISOString(),
        evidence: result.selected_evidence,
        claims: result.claim_verifications,
        jurisdiction,
      };

      addChatMessage(assistantMessage);
    } catch {
      addChatMessage({
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: 'An error occurred while processing your query. Please try again.',
        timestamp: new Date().toISOString(),
        jurisdiction,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, jurisdiction, addChatMessage, setIsProcessing]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-text">Legal Assistant</h2>
          <p className="text-xs text-text-secondary">
            Ask questions about IP, Traditional Knowledge, and relevant provisions.
            Uses the same evidence-grounded retrieval pipeline.
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary border border-border rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-4 mb-4 p-4 bg-white rounded-xl border border-border">
        {chatMessages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-text-secondary">
              Ask a question about IP, Traditional Knowledge, or relevant legal provisions.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                'Is my modified Triphala formulation relevant for IP protection?',
                'What does the Biological Diversity Act say about traditional knowledge?',
                'Are there disclosure requirements for patent applications involving genetic resources?',
                'What are the key provisions of the WIPO Treaty on GR/TK?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-border rounded-full hover:bg-gray-100 cursor-pointer text-text-secondary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl p-4 ${
                msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 border border-border'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return (
                      <h4
                        key={i}
                        className={`text-base font-semibold mt-3 mb-1 ${
                          msg.role === 'user' ? 'text-white' : 'text-primary'
                        }`}
                      >
                        {line.replace('## ', '')}
                      </h4>
                    );
                  }
                  if (line.startsWith('- **')) {
                    const parts = line.replace(/^- /, '').split('**');
                    return (
                      <div key={i} className="ml-3 mb-0.5">
                        {parts.map((p, j) =>
                          j % 2 === 1 ? (
                            <strong key={j}>{p}</strong>
                          ) : (
                            <span key={j}>{p}</span>
                          )
                        )}
                      </div>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <div key={i} className="ml-3 mb-0.5 opacity-80">
                        {line}
                      </div>
                    );
                  }
                  if (line.startsWith('---')) {
                    return <hr key={i} className="my-2 opacity-30" />;
                  }
                  if (line.trim()) {
                    return <p key={i} className="mb-0.5">{line}</p>;
                  }
                  return <br key={i} />;
                })}
              </div>

              {/* Audio player for assistant messages */}
              {msg.role === 'assistant' && (
                <div className="mt-2">
                  <AudioPlayer text={msg.content} />
                </div>
              )}

              {/* Evidence attachments */}
              {msg.evidence && msg.evidence.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs font-medium mb-2 opacity-70">
                    Retrieved Evidence:
                  </div>
                  <div className="space-y-1.5">
                    {msg.evidence.slice(0, 3).map((e) => (
                      <button
                        key={e.chunk.chunk_id}
                        onClick={() => openEvidenceModal({ evidence: e })}
                        className="w-full text-left p-2 bg-white rounded-lg border border-border text-xs hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                      >
                        <Eye className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">
                          {e.chunk.source_name}, {e.chunk.provision}, p.
                          {e.chunk.page_number}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Claim verification badges */}
              {msg.claims && msg.claims.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="text-xs font-medium mb-1 opacity-70">
                    Claim Verification:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.claims.map((c) => (
                      <span
                        key={c.claim_id}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'SUPPORTED'
                            ? 'bg-green-100 text-green-700'
                            : c.status === 'PARTIALLY_SUPPORTED'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {c.status === 'SUPPORTED'
                          ? '✓'
                          : c.status === 'PARTIALLY_SUPPORTED'
                          ? '⚠'
                          : '✕'}{' '}
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary-dark" />
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-50 border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing your query...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        <VoiceInput
          onResult={(text) => setInput(prev => prev ? prev + ' ' + text : text)}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask about IP, Traditional Knowledge, or speak..."
          disabled={isProcessing}
          className="flex-1 px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="px-5 py-3 bg-primary text-white rounded-xl hover:bg-primary-light disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
