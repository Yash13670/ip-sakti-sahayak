/**
 * PDF Text Extractor — IP-SAKTI SAHAYAK
 * Uses pdfjs-dist (Mozilla PDF.js) for Node.js
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PDF_META = {
  'the_patents_act_1970.pdf': {
    document_id: 'PA1970',
    source_name: 'Patents Act, 1970',
    document_title: 'The Patents Act, 1970 (as amended)',
    source_type: 'Statute',
    jurisdiction: 'India',
    source_url: 'https://ipindia.gov.in/patents.htm',
  },
  'the_biological_diversity_act_2002.pdf': {
    document_id: 'BDA2002',
    source_name: 'Biological Diversity Act, 2002',
    document_title: 'The Biological Diversity Act, 2002',
    source_type: 'Statute',
    jurisdiction: 'India',
    source_url: 'https://biodiversityindia.org/',
  },
  'the_patent_rules_2003.pdf': {
    document_id: 'PR2003',
    source_name: 'Patent Rules, 2003',
    document_title: 'The Patent Rules, 2003 (as amended)',
    source_type: 'Statute',
    jurisdiction: 'India',
    source_url: 'https://ipindia.gov.in/patents.htm',
  },
  '1067933857-the-2024-wipo-treaty-on-genetic-resources-dawn-of-a-new-day.pdf': {
    document_id: 'WIPO2024',
    source_name: 'WIPO Treaty on GR/TK 2024',
    document_title: 'WIPO Treaty on IP, Genetic Resources and Associated Traditional Knowledge (2024)',
    source_type: 'Treaty',
    jurisdiction: 'Global',
    source_url: 'https://www.wipo.int/treaties/en/ip/grtkf/',
  },
  'celex_22014a0520(01)_en_txt.pdf': {
    document_id: 'NAGOYA2014',
    source_name: 'Nagoya Protocol',
    document_title: 'Nagoya Protocol on Access to Genetic Resources and Fair and Equitable Sharing of Benefits',
    source_type: 'Treaty',
    jurisdiction: 'Global',
    source_url: 'https://www.cbd.int/abs/nagoya-protocol/',
  },
  '2016drugsandcosmeticsact1940rules1945.pdf': {
    document_id: 'DCA1940',
    source_name: 'Drugs and Cosmetics Act, 1940',
    document_title: 'The Drugs and Cosmetics Act, 1940 and Rules, 1945',
    source_type: 'Statute',
    jurisdiction: 'India',
    source_url: 'https://cdsco.gov.in/',
  },
  '457906275-schedule-t-pdf.pdf': {
    document_id: 'SCHT',
    source_name: 'Schedule T',
    document_title: 'Schedule T — Good Manufacturing Practices for Ayurvedic, Siddha and Unani Medicines',
    source_type: 'Guideline',
    jurisdiction: 'India',
    source_url: 'https://cdsco.gov.in/',
  },
  '529882153-ayush-guidelines.pdf': {
    document_id: 'AYUSH',
    source_name: 'AYUSH Guidelines',
    document_title: 'AYUSH Regulatory and Research Guidelines',
    source_type: 'Guideline',
    jurisdiction: 'India',
    source_url: 'https://www.ayush.gov.in/',
  },
  '359600700-api-vol-9-pdf.pdf': {
    document_id: 'API9',
    source_name: 'Ayurvedic Pharmacopoeia of India Vol. 9',
    document_title: 'Ayurvedic Pharmacopoeia of India, Volume 9',
    source_type: 'Pharmacopoeia',
    jurisdiction: 'India',
    source_url: 'https://www.ayush.gov.in/',
  },
};

async function extractText(filePath) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data, verbosity: 0 }).promise;
  const numPages = doc.numPages;
  const pageTexts = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
    pageTexts.push({ page: i, text });
  }
  return { pages: numPages, pageTexts };
}

function buildChunks(pageTexts, chunkSize = 900) {
  const chunks = [];
  let buffer = '';
  let startPage = 1;

  for (const { page, text } of pageTexts) {
    if (!text) continue;
    if ((buffer + ' ' + text).length > chunkSize && buffer.length > 80) {
      chunks.push({ text: buffer.trim(), page: startPage });
      buffer = text;
      startPage = page;
    } else {
      buffer += (buffer ? ' ' : '') + text;
    }
  }
  if (buffer.trim().length > 50) chunks.push({ text: buffer.trim(), page: startPage });
  return chunks;
}

function detectProvision(text) {
  const patterns = [
    /(?:Section|Sec\.?)\s+\d+[A-Za-z]?(?:\s*\([a-z0-9]+\))*/,
    /(?:Article|Art\.?)\s+\d+[A-Za-z]?(?:\s*\([a-z0-9]+\))*/,
    /Rule\s+\d+[A-Za-z]?/,
    /Schedule\s+[A-Z]+/,
    /§\s*\d+[A-Za-z]?/,
    /Clause\s+\d+[A-Za-z]?/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return 'General';
}

function detectKeywords(text) {
  const lower = text.toLowerCase();
  const kw = [];
  const checks = [
    ['traditional knowledge', 'Traditional Knowledge'],
    ['biological diversity', 'Biological Diversity'],
    ['genetic resources', 'Genetic Resources'],
    ['prior art', 'Prior Art'],
    ['novelty', 'Novelty'],
    ['inventive step', 'Inventive Step'],
    ['patent', 'Patent'],
    ['benefit sharing', 'Benefit Sharing'],
    ['ayurvedic', 'Ayurvedic'],
    ['formulation', 'Formulation'],
    ['prior informed consent', 'PIC'],
    ['good manufacturing', 'GMP'],
    ['not patentable', 'Non-Patentability'],
    ['anticipation', 'Anticipation'],
    ['biodiversity', 'Biodiversity'],
    ['nagoya', 'Nagoya Protocol'],
    ['access and benefit', 'ABS'],
    ['neem', 'Neem'],
    ['turmeric', 'Turmeric'],
    ['triphala', 'Triphala'],
    ['amla', 'Amla'],
    ['haritaki', 'Haritaki'],
    ['disclosure', 'Disclosure'],
  ];
  for (const [k, label] of checks) {
    if (lower.includes(k)) kw.push(label);
  }
  return [...new Set(kw)];
}

async function main() {
  mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });

  const files = readdirSync(ROOT).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDFs\n`);

  const allChunks = [];
  const docSummaries = [];

  for (const file of files) {
    const key = file.toLowerCase();
    const docMeta = PDF_META[key];
    if (!docMeta) {
      console.log(`  ⚠ No metadata: ${file} — skip`);
      continue;
    }
    console.log(`Processing: ${file}`);
    let extracted;
    try {
      extracted = await extractText(join(ROOT, file));
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      continue;
    }
    const { pages, pageTexts } = extracted;
    console.log(`  Pages: ${pages}`);
    const rawChunks = buildChunks(pageTexts);
    console.log(`  Chunks: ${rawChunks.length}`);

    rawChunks.forEach((chunk, idx) => {
      allChunks.push({
        chunk_id: `${docMeta.document_id}-${String(idx + 1).padStart(4, '0')}`,
        document_id: docMeta.document_id,
        source_name: docMeta.source_name,
        document_title: docMeta.document_title,
        source_type: docMeta.source_type,
        jurisdiction: docMeta.jurisdiction,
        provision: detectProvision(chunk.text),
        page_number: String(chunk.page),
        actual_text: chunk.text,
        source_url: docMeta.source_url,
        source_status: 'Actual Source Document',
        keywords: detectKeywords(chunk.text),
        char_count: chunk.text.length,
      });
    });

    docSummaries.push({
      document_id: docMeta.document_id,
      source_name: docMeta.source_name,
      source_type: docMeta.source_type,
      jurisdiction: docMeta.jurisdiction,
      source_url: docMeta.source_url,
      total_pages: pages,
      total_chunks: rawChunks.length,
      source_status: 'Actual Source Document',
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    extraction_method: 'pdfjs-dist (Mozilla PDF.js)',
    total_chunks: allChunks.length,
    total_documents: docSummaries.length,
    documents: docSummaries,
    chunks: allChunks,
  };

  const outPath = join(ROOT, 'src', 'data', 'knowledgeBaseChunks.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✓ ${allChunks.length} chunks → ${outPath}`);
  console.log(`✓ Documents: ${docSummaries.length}`);
}

main().catch(e => { console.error('Fatal:', e.stack); process.exit(1); });
