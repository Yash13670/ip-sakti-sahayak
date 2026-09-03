import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { getDocuments } from '../services/pipeline';
import type { KnowledgeChunk } from '../types';
import { Search, Eye, Filter, BookOpen } from 'lucide-react';

// Load chunks from the JSON data
import kbData from '../data/knowledgeBaseChunks.json';

const sourceTypes = ['All', 'Statute', 'Treaty', 'Guideline', 'Pharmacopoeia', 'Case', 'Reference'];
const jurisdictions = ['All', 'India', 'Global'];

export function Evidence() {
  const { openEvidenceModal } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('All');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('All');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const docs = getDocuments();
  const allChunks = kbData.chunks as KnowledgeChunk[];

  // Filter chunks
  const filteredChunks = useMemo(() => {
    let result = allChunks;

    if (selectedDoc) {
      result = result.filter((c) => c.document_id === selectedDoc);
    }

    if (sourceTypeFilter !== 'All') {
      result = result.filter((c) => c.source_type === sourceTypeFilter);
    }

    if (jurisdictionFilter !== 'All') {
      result = result.filter((c) => c.jurisdiction === jurisdictionFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.actual_text.toLowerCase().includes(q) ||
          c.source_name.toLowerCase().includes(q) ||
          c.provision.toLowerCase().includes(q) ||
          c.document_title.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allChunks, searchQuery, sourceTypeFilter, jurisdictionFilter, selectedDoc]);

  // Group by document for overview
  const docStats = useMemo(() => {
    return docs.map((d) => ({
      ...d,
      chunks: allChunks.filter((c) => c.document_id === d.document_id).length,
    }));
  }, [docs, allChunks]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Evidence & Sources</h2>
        <p className="text-xs text-text-secondary mt-1">
          Searchable evidence repository from the knowledge base. Each source has been extracted from uploaded legal documents.
        </p>
      </div>

      {/* Document Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {docStats.map((doc) => (
          <button
            key={doc.document_id}
            onClick={() =>
              setSelectedDoc(selectedDoc === doc.document_id ? null : doc.document_id)
            }
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedDoc === doc.document_id
                ? 'border-primary bg-blue-50 ring-1 ring-primary/20'
                : 'border-border bg-white hover:bg-gray-50'
            }`}
          >
            <div className="text-xs font-medium text-primary mb-1">
              {doc.source_type}
            </div>
            <div className="text-sm font-semibold text-text leading-tight">
              {doc.source_name}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              {doc.chunks} chunks · {doc.jurisdiction}
            </div>
            <div className="text-[10px] text-amber-600 mt-1">
              {doc.source_status}
            </div>
          </button>
        ))}
      </div>

      {selectedDoc && (
        <button
          onClick={() => setSelectedDoc(null)}
          className="text-xs text-primary hover:text-primary-light cursor-pointer"
        >
          Clear document filter
        </button>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search evidence..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
          >
            {sourceTypes.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Types' : t}
              </option>
            ))}
          </select>
        </div>
        <select
          value={jurisdictionFilter}
          onChange={(e) => setJurisdictionFilter(e.target.value)}
          className="px-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          {jurisdictions.map((j) => (
            <option key={j} value={j}>
              {j === 'All' ? 'All Jurisdictions' : j}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-text-secondary">
        Showing {filteredChunks.length} of {allChunks.length} chunks
      </div>

      {/* Evidence List */}
      <div className="space-y-3">
        {filteredChunks.slice(0, 50).map((chunk) => (
          <div
            key={chunk.chunk_id}
            className="bg-white border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary">
                    {chunk.source_name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-text-secondary">
                    {chunk.source_type}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-text-secondary">
                    {chunk.jurisdiction}
                  </span>
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  {chunk.document_title} · {chunk.provision} · Page {chunk.page_number}
                </div>
                <p className="text-xs text-text leading-relaxed line-clamp-3">
                  {chunk.actual_text.substring(0, 300)}...
                </p>
              </div>
              <button
                onClick={() =>
                  openEvidenceModal({
                    evidence: {
                      chunk,
                      bm25Score: 0,
                      semanticScore: 0,
                      finalScore: 0,
                      rank: 0,
                    },
                  })
                }
                className="shrink-0 p-2 text-text-secondary hover:text-primary hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredChunks.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            No evidence chunks found matching your search criteria.
          </p>
        </div>
      )}

      {filteredChunks.length > 50 && (
        <div className="text-center text-xs text-text-secondary py-4">
          Showing first 50 of {filteredChunks.length} results. Use filters to narrow down.
        </div>
      )}
    </div>
  );
}
