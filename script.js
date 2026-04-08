// ─── State ────────────────────────────────────────────────────────────────────
const DEMO_PAPERS = [
  {
    id: 'demo1', name: 'Basalt Fibre Reinforced Concrete – GPTMS Treatment.pdf',
    size: '2.4 MB', analyzed: true, isDemo: true,
    content: `This study investigates the effect of silane coupling agent GPTMS (3-Glycidoxypropyltrimethoxysilane) surface treatment on basalt fibres in fibre-reinforced concrete (FRC). FTIR spectroscopy confirmed successful silane bonding on fibre surfaces through shifts in the Si–O–Si stretch at 1020 cm⁻¹ and appearance of epoxy ring vibrations at 910 cm⁻¹. Mechanical testing showed treated fibres improved flexural strength by 18.4% and tensile strength by 12.7% compared to untreated controls at 0.5% volume fraction. The silane treatment significantly enhanced fibre-matrix interfacial adhesion, reducing fibre pull-out failure modes observed in SEM imaging. Pull-out load increased by 23% for GPTMS-treated specimens. Results suggest GPTMS-treated basalt fibres are viable sustainable alternatives to steel and synthetic fibres in structural concrete applications. Water absorption reduced by 8.2% indicating denser microstructure. W/C ratio 0.45, 28-day curing at 20°C.`
  },
  {
    id: 'demo2', name: 'PVA Fibre Composites in Cementitious Matrices.pdf',
    size: '1.8 MB', analyzed: true, isDemo: true,
    content: `This paper examines PVA (polyvinyl alcohol) fibres as reinforcement in engineered cementitious composites (ECC). The study focused on fibre dispersion, volume fraction (0.5%, 1.0%, 2.0%), and surface modification effects on mechanical properties. Results demonstrated that 2% volume fraction with ozone surface treatment achieved the highest ductility with deflection hardening behaviour and strain capacity exceeding 3%. FTIR analysis confirmed hydroxyl group interactions at the fibre-cement interface with increased OH stretch at 3300 cm⁻¹. Compressive strength ranged 45–62 MPa while flexural strength reached up to 11.3 MPa at 2% Vf. The ozone treatment improved interfacial bonding by introducing carbonyl groups on fibre surfaces. Multiple cracking behaviour was observed with crack widths controlled below 60 μm.`
  }
];

const PROXY_URL = 'https://rja-proxy.onrender.com/proxy';

let userPapers = [];
let currentTool = 'summary';
let selectedPaperIds = ['demo1'];
let currentResult = '';
let libView = 'grid';

function allPapers() { return [...DEMO_PAPERS, ...userPapers]; }

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  renderPapersList();
  renderPaperSelectList();
  renderLibrary();
  updateCounts();

  // Show API ready since key is in proxy
  document.getElementById('apiStatus').innerHTML =
    '<span class="dot dot-green"></span><span class="hide-mobile">API Ready</span>';
});

// ─── Navigation ───────────────────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
  if (pageId === 'library') renderLibrary();
  if (pageId === 'analyze') renderPaperSelectList();
}

// ─── PDF Upload ───────────────────────────────────────────────────────────────
function handleDragOver(e) { e.preventDefault(); document.getElementById('uploadZone').classList.add('drag'); }
function handleDragLeave() { document.getElementById('uploadZone').classList.remove('drag'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  handleFiles(e.dataTransfer.files);
}
function handleFileSelect(e) { handleFiles(e.target.files); }

async function handleFiles(files) {
  const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return;

  const titleEl = document.getElementById('uploadTitle');
  const progressEl = document.getElementById('extractProgress');
  const fillEl = document.getElementById('progressFill');
  progressEl.style.display = 'block';

  for (let i = 0; i < pdfs.length; i++) {
    const file = pdfs[i];
    titleEl.textContent = `Extracting: ${file.name} (${i+1}/${pdfs.length})`;
    fillEl.style.width = ((i / pdfs.length) * 100) + '%';

    const id = 'u_' + Date.now() + '_' + i;
    const draft = {
      id, name: file.name,
      size: (file.size / 1048576).toFixed(1) + ' MB',
      analyzed: false, isDemo: false, content: ''
    };
    userPapers.push(draft);
    renderPapersList();

    try {
      const text = await extractPdfText(file);
      const idx = userPapers.findIndex(p => p.id === id);
      if (idx !== -1) { userPapers[idx].content = text; userPapers[idx].analyzed = true; }
    } catch {
      const idx = userPapers.findIndex(p => p.id === id);
      if (idx !== -1) userPapers[idx].content = '[Text extraction failed — try a different PDF]';
    }
    renderPapersList();
    updateCounts();
  }

  fillEl.style.width = '100%';
  setTimeout(() => {
    progressEl.style.display = 'none';
    fillEl.style.width = '0%';
    titleEl.textContent = 'Drop PDFs here or click to browse';
  }, 800);

  renderPaperSelectList();
  updateCounts();
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n\n';
  }
  return text.trim() || '[No extractable text — may be a scanned PDF]';
}

// ─── Render Papers List ───────────────────────────────────────────────────────
function renderPapersList() {
  const list = document.getElementById('papersList');
  const papers = allPapers();

  document.getElementById('statsRow').style.display = 'grid';
  document.getElementById('statTotal').textContent = papers.length;
  document.getElementById('statReady').textContent = papers.filter(p => p.analyzed).length;

  list.innerHTML = papers.map(p => `
    <div class="paper-item">
      <span class="paper-icon">📄</span>
      <div class="paper-info">
        <div class="paper-name">${escHtml(p.name)}</div>
        <div class="paper-meta">${p.size}</div>
        ${p.content ? `<div class="paper-preview">${escHtml(p.content.substring(0,120))}…</div>` : ''}
      </div>
      <div class="paper-badges">
        <span class="badge ${p.analyzed ? 'badge-success' : 'badge-warn'}">${p.analyzed ? '✓ Ready' : '○ Pending'}</span>
        ${p.isDemo ? '<span class="badge badge-accent">Demo</span>' : ''}
        ${!p.isDemo ? `<button class="btn btn-danger btn-sm" onclick="removePaper('${p.id}')">✕</button>` : ''}
      </div>
    </div>
  `).join('');
}

function removePaper(id) {
  userPapers = userPapers.filter(p => p.id !== id);
  selectedPaperIds = selectedPaperIds.filter(x => x !== id);
  renderPapersList();
  renderPaperSelectList();
  updateCounts();
}

function updateCounts() {
  document.getElementById('uploadCount').textContent = userPapers.length + ' uploaded';
  document.getElementById('statTotal').textContent = allPapers().length;
  document.getElementById('statReady').textContent = allPapers().filter(p=>p.analyzed).length;
  document.getElementById('libTotal').textContent = allPapers().length;
  document.getElementById('libReady').textContent = allPapers().filter(p=>p.analyzed).length;
  document.getElementById('libUploaded').textContent = userPapers.length;
}

// ─── Tool selection ───────────────────────────────────────────────────────────
function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

  const textCard = document.getElementById('textInputCard');
  const refCard = document.getElementById('refStyleCard');
  const textLabel = document.getElementById('textInputLabel');
  const textInput = document.getElementById('textInput');

  textCard.style.display = (tool==='detector'||tool==='humanizer') ? 'block' : 'none';
  refCard.style.display = (tool==='references') ? 'block' : 'none';

  if (tool==='detector') {
    textLabel.textContent = 'Or paste text to check';
    textInput.placeholder = 'Paste abstract or section here…';
  } else if (tool==='humanizer') {
    textLabel.textContent = 'Text to humanize (required)';
    textInput.placeholder = 'Paste AI-generated text here…';
  }

  const labels = { summary:'Deep Summary', detector:'AI Detector', humanizer:'Humanizer', multisummary:'Multi-Paper Synthesis', references:'References' };
  document.getElementById('runBtn').innerHTML = `🚀 Run ${labels[tool]}`;
  resetResults();
}

// ─── Paper select list ────────────────────────────────────────────────────────
function renderPaperSelectList() {
  const list = document.getElementById('paperSelectList');
  const papers = allPapers();
  if (!papers.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:8px 0">Upload papers on the Papers tab first</p>';
    return;
  }
  list.innerHTML = papers.map(p => `
    <div class="paper-select-item ${selectedPaperIds.includes(p.id)?'selected':''}" onclick="togglePaperSelect('${p.id}')">
      <span>${selectedPaperIds.includes(p.id)?'☑':'☐'}</span>
      <span class="paper-select-name">${escHtml(p.name)}</span>
      ${p.isDemo ? '<span class="badge badge-accent" style="font-size:10px">Demo</span>' : ''}
    </div>
  `).join('');
}

function togglePaperSelect(id) {
  if (selectedPaperIds.includes(id)) {
    selectedPaperIds = selectedPaperIds.filter(x => x !== id);
  } else {
    selectedPaperIds.push(id);
  }
  renderPaperSelectList();
}

// ─── Run Analysis ─────────────────────────────────────────────────────────────
async function runAnalysis() {
  const sel = allPapers().filter(p => selectedPaperIds.includes(p.id));

  if (!sel.length && currentTool !== 'humanizer') { showAnalyzeError('Select at least one paper.'); return; }
  if (currentTool === 'multisummary' && sel.length < 2) { showAnalyzeError('Select at least 2 papers for Multi-Paper Synthesis.'); return; }
  if (currentTool === 'humanizer' && !document.getElementById('textInput').value.trim()) {
    showAnalyzeError('Paste text into the text box to humanize.'); return;
  }

  hideAnalyzeError();
  setLoadingState(true);

  const textInput = document.getElementById('textInput').value.trim();
  const refStyle = document.getElementById('refStyle').value;
  const paperContents = sel.map(p => p.content);
  const paperNames = sel.map(p => p.name);

  try {
    const prompt = buildPrompt(currentTool, paperContents, paperNames, textInput, refStyle);
    const result = await callClaude(prompt);
    currentResult = result;
    showResult(result);
  } catch (e) {
    setLoadingState(false);
    showAnalyzeError('Error: ' + e.message);
  }
}

function buildPrompt(tool, contents, names, textInput, refStyle) {
  switch (tool) {
    case 'summary': {
      const body = contents.map((c,i) => `PAPER ${i+1}: ${names[i]}\n${c}`).join('\n\n---\n\n');
      return `You are an expert academic analyst. Provide a comprehensive deep analysis with these sections:\n\n1. **Research Objective & Hypothesis**\n2. **Methodology** (materials, methods, experimental design)\n3. **Key Findings** (with specific numbers and data points)\n4. **Contributions to the Field**\n5. **Limitations**\n6. **Future Research Directions**\n7. **One-line Verdict**\n\nPaper:\n${body}`;
    }
    case 'detector': {
      const text = textInput || contents.join('\n\n');
      return `You are an expert AI content detector. Analyze the following text:\n\n1. Overall AI probability score (show as X%)\n2. Section-by-section breakdown with individual scores\n3. Specific phrases or patterns that indicate AI writing\n4. Confidence level\n5. Which AI model likely generated it (if detectable)\n\nText:\n${text.substring(0,4000)}`;
    }
    case 'humanizer': {
      return `Rewrite the following text to sound completely human-written for academic publication:\n- Vary sentence length and structure naturally\n- Use contractions and natural academic transitions\n- Add hedging language (seems, suggests, appears to)\n- Remove repetitive AI patterns and filler phrases\n- Keep all facts, numbers, and citations intact\n- Write as a researcher would naturally draft prose\n\nOriginal text:\n${textInput}`;
    }
    case 'multisummary': {
      const body = contents.map((c,i) => `PAPER ${i+1}: ${names[i]}\n${c}`).join('\n\n---\n\n');
      return `Synthesize these ${contents.length} research papers with:\n\n1. **Common Themes** across all papers\n2. **Contrasting Findings** or methodological differences\n3. **Combined Contribution** to the field\n4. **Research Gaps** identified collectively\n5. **Recommended Citation Order** for a literature review\n6. **Synthesis Paragraph** (ready to paste into a literature review section)\n\nPapers:\n${body}`;
    }
    case 'references': {
      const body = contents.map((c,i) => `PAPER: ${names[i]}\n${c}`).join('\n\n');
      return `Extract all references and bibliographic information. Format each as a ${refStyle} citation. Include:\n1. The papers themselves as citable works\n2. Any papers cited within them\n3. Each reference on its own numbered line\n\nContent:\n${body}`;
    }
    default: return '';
  }
}

// ─── API call via proxy ───────────────────────────────────────────────────────
async function callClaude(prompt) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return data.content?.[0]?.text || 'No response received.';
}

// ─── Show results ─────────────────────────────────────────────────────────────
function showResult(text) {
  setLoadingState(false);
  document.getElementById('resultEmpty').style.display = 'none';
  document.getElementById('resultState').style.display = 'block';

  const scoreCard = document.getElementById('scoreCard');
  if (currentTool === 'detector') {
    const match = text.match(/(\d{1,3})\s*%/);
    if (match) {
      const score = Math.min(100, parseInt(match[1]));
      scoreCard.style.display = 'block';
      document.getElementById('scoreNum').textContent = score + '%';
      document.getElementById('scoreNum').style.color = score > 70 ? 'var(--danger)' : score > 40 ? 'var(--warn)' : 'var(--accent4)';
      document.getElementById('scoreBar').style.width = score + '%';
      document.getElementById('scoreBar').style.background = score > 70
        ? 'linear-gradient(90deg,var(--warn),var(--danger))'
        : score > 40 ? 'linear-gradient(90deg,var(--accent4),var(--warn))'
        : 'linear-gradient(90deg,var(--accent),var(--accent4))';
      document.getElementById('scoreLabel').textContent = score > 70
        ? '⚠️ High AI probability — review carefully'
        : score > 40 ? '⚡ Mixed content detected'
        : '✅ Likely human-written';
    }
  } else {
    scoreCard.style.display = 'none';
  }

  document.getElementById('resultBox').innerHTML = `<pre>${escHtml(text)}</pre>`;

  const refsCard = document.getElementById('refsCard');
  if (currentTool === 'references') {
    const lines = text.split('\n').filter(l => /^\d+[\.\)]/.test(l.trim()));
    if (lines.length) {
      refsCard.style.display = 'block';
      const refStyle = document.getElementById('refStyle').value;
      document.getElementById('refsLabel').textContent = `${refStyle} References (${lines.length})`;
      document.getElementById('refsList').innerHTML = lines.map((l, i) => {
        const clean = escHtml(l.replace(/^\d+[\.\)]\s*/, ''));
        return `<div class="ref-item">
          <div class="ref-num">[${i+1}]</div>
          <div class="ref-text">${clean}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="copyText(\`${l.replace(/`/g,"'")}\`)">Copy</button>
        </div>`;
      }).join('');
    }
  } else {
    refsCard.style.display = 'none';
  }
}

function resetResults() {
  document.getElementById('resultEmpty').style.display = 'block';
  document.getElementById('resultState').style.display = 'none';
  document.getElementById('loadingState').style.display = 'none';
  hideAnalyzeError();
}

function setLoadingState(loading) {
  const btn = document.getElementById('runBtn');
  if (loading) {
    document.getElementById('resultEmpty').style.display = 'none';
    document.getElementById('resultState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';
    btn.disabled = true;
    btn.innerHTML = '<span class="dots"><span class="dot-anim"></span><span class="dot-anim"></span><span class="dot-anim"></span></span> Analyzing…';
  } else {
    document.getElementById('loadingState').style.display = 'none';
    btn.disabled = false;
    const labels = { summary:'Deep Summary', detector:'AI Detector', humanizer:'Humanizer', multisummary:'Multi-Paper Synthesis', references:'References' };
    btn.innerHTML = `🚀 Run ${labels[currentTool]}`;
  }
}

function showAnalyzeError(msg) {
  const el = document.getElementById('analyzeError');
  el.style.display = 'block';
  el.textContent = '⚠️ ' + msg;
}
function hideAnalyzeError() {
  document.getElementById('analyzeError').style.display = 'none';
}

// ─── Copy / Download ──────────────────────────────────────────────────────────
function copyResult() {
  navigator.clipboard.writeText(currentResult);
  const btn = event.target;
  btn.textContent = '✓ Copied';
  setTimeout(() => btn.textContent = '📋 Copy', 2000);
}
function copyText(text) {
  navigator.clipboard.writeText(text);
  const btn = event.target;
  btn.textContent = '✓';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}
function downloadResult() {
  const blob = new Blob([currentResult], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `analysis_${currentTool}_${Date.now()}.txt`;
  a.click();
}

// ─── Library ──────────────────────────────────────────────────────────────────
function setLibView(v) {
  libView = v;
  document.getElementById('btnGrid').classList.toggle('btn-primary', v==='grid');
  document.getElementById('btnList').classList.toggle('btn-primary', v==='list');
  document.getElementById('btnGrid').classList.toggle('btn-ghost', v!=='grid');
  document.getElementById('btnList').classList.toggle('btn-ghost', v!=='list');
  renderLibrary();
}

function renderLibrary() {
  updateCounts();
  const search = (document.getElementById('librarySearch')?.value || '').toLowerCase();
  const papers = allPapers().filter(p => p.name.toLowerCase().includes(search));
  const container = document.getElementById('libraryGrid');
  if (!papers.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div>No papers found</div></div>'; return; }

  if (libView === 'grid') {
    container.style.display = 'grid';
    container.innerHTML = papers.map(p => `
      <div class="lib-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <span style="font-size:26px">📄</span>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            <span class="badge ${p.analyzed?'badge-success':'badge-warn'}">${p.analyzed?'✓ Ready':'○ Pending'}</span>
            ${p.isDemo?'<span class="badge badge-accent">Demo</span>':''}
          </div>
        </div>
        <div style="font-weight:600;font-size:13px;line-height:1.4;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(p.name)}</div>
        <div style="font-size:12px;color:var(--text3)">${p.size}</div>
        ${p.content?`<div style="font-size:12px;color:var(--text3);margin-top:8px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escHtml(p.content.substring(0,220))}…</div>`:''}
      </div>
    `).join('');
  } else {
    container.style.display = 'block';
    container.innerHTML = papers.map(p => `
      <div class="lib-list-item">
        <span style="font-size:20px;flex-shrink:0">📄</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.name)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${p.size}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <span class="badge ${p.analyzed?'badge-success':'badge-warn'}">${p.analyzed?'✓ Ready':'○ Pending'}</span>
          ${p.isDemo?'<span class="badge badge-accent">Demo</span>':''}
        </div>
      </div>
    `).join('');
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
