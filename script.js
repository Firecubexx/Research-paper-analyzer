// ─── Config ───────────────────────────────────────────────────────────────────
const PROXY = 'https://rja-proxy-production.up.railway.app/proxy'

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  showPage('home')
})

// ─── Navigation ───────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const page = document.getElementById('page-' + id)
  if (page) page.classList.add('active')
  const btn = document.querySelector(`[data-page="${id}"]`)
  if (btn) btn.classList.add('active')
  window.scrollTo(0, 0)
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open')
}

// ─── Chip selector ────────────────────────────────────────────────────────────
function selectChip(el, hiddenId, value) {
  el.closest('.option-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
  el.classList.add('active')
  document.getElementById(hiddenId).value = value
}

// ─── PDF handling ─────────────────────────────────────────────────────────────
function handleDragOver(e, zoneId) {
  e.preventDefault()
  document.getElementById(zoneId).classList.add('drag')
}
function handleDragLeave(zoneId) {
  document.getElementById(zoneId).classList.remove('drag')
}
function handleDrop(e, inputId, zoneId) {
  e.preventDefault()
  document.getElementById(zoneId).classList.remove('drag')
  const file = e.dataTransfer.files[0]
  if (file) processFile(file, inputId, zoneId.replace('Upload', 'Meta'))
}
function handleFileForTool(e, contentId, metaId) {
  const file = e.target.files[0]
  if (file) processFile(file, contentId, metaId)
}

async function processFile(file, contentId, metaId) {
  const meta = document.getElementById(metaId)
  meta.style.display = 'flex'
  meta.innerHTML = `⏳ Extracting text from <strong>${file.name}</strong>…`
  try {
    const text = await extractPdfText(file)
    document.getElementById(contentId).value = text
    meta.innerHTML = `✓ <strong>${file.name}</strong> — ${(file.size/1048576).toFixed(1)} MB · text extracted`
    meta.style.color = 'var(--teal)'
  } catch {
    meta.innerHTML = `⚠️ Could not extract text — please paste manually`
    meta.style.color = 'var(--red)'
  }
}

async function extractPdfText(file) {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n\n'
  }
  return text.trim() || '[No extractable text]'
}

// ─── API call ─────────────────────────────────────────────────────────────────
async function callAI(prompt, system = '') {
  const body = {
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  }
  if (system) body.system = system

  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await r.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.[0]?.text || 'No response received.'
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function setLoading(tool, on) {
  document.getElementById(tool + 'Empty').style.display = on ? 'none' : 'flex'
  document.getElementById(tool + 'Loading').style.display = on ? 'block' : 'none'
  document.getElementById(tool + 'Result').style.display = on ? 'none' : 'block'
  const btn = document.getElementById(tool + 'Btn')
  if (btn) btn.disabled = on
}

function showResult(tool) {
  document.getElementById(tool + 'Empty').style.display = 'none'
  document.getElementById(tool + 'Loading').style.display = 'none'
  document.getElementById(tool + 'Result').style.display = 'block'
}

function showError(tool, msg) {
  document.getElementById(tool + 'Empty').style.display = 'none'
  document.getElementById(tool + 'Loading').style.display = 'none'
  document.getElementById(tool + 'Result').style.display = 'none'
  const btn = document.getElementById(tool + 'Btn')
  if (btn) btn.disabled = false

  // show error in output area
  const output = document.querySelector(`#page-${tool === 'analyze' ? 'analyze' : tool === 'detector' ? 'detector' : tool} .tool-output`) ||
                 document.querySelector(`#page-${tool} .humanizer-output-col`) ||
                 document.querySelector(`#page-${tool} .tool-output`)
  if (!output) return
  let errEl = output.querySelector('.error-msg')
  if (!errEl) { errEl = document.createElement('div'); errEl.className = 'error-msg'; output.appendChild(errEl) }
  errEl.style.display = 'block'
  errEl.textContent = '⚠️ ' + msg
  errEl.style.margin = '20px'
  document.getElementById(tool + 'Empty').style.display = 'flex'
}

function getContent(id) {
  return (document.getElementById(id)?.value || '').trim()
}

// ─── PAPER ANALYSIS ───────────────────────────────────────────────────────────
async function runAnalysis() {
  const content = getContent('analyzeContent')
  if (!content) { alert('Please upload a PDF or paste paper content first.'); return }
  const depth = document.getElementById('analyzeDepth').value

  setLoading('analyze', true)

  const depthPrompts = {
    standard: `Provide a structured analysis with: 1. Research Objective, 2. Methodology, 3. Key Findings (with data), 4. Contributions, 5. Limitations, 6. Verdict`,
    deep: `Provide an exhaustive analysis with: 1. Research Objective & Hypothesis, 2. Theoretical Framework, 3. Detailed Methodology (design, materials, procedures, controls), 4. Key Findings (all numerical data, statistical results), 5. Discussion & Interpretation, 6. Contributions to the field, 7. Limitations & Weaknesses, 8. Future Research Directions, 9. Practical Implications, 10. Critical Verdict`,
    critical: `Perform a critical peer-review style analysis: 1. Research Objective & Clarity, 2. Methodological Rigor (critique experimental design, sample sizes, controls), 3. Results Analysis (validate data, check statistical methods), 4. Discussion Quality, 5. Identify Gaps & Weaknesses, 6. Comparison to existing literature, 7. Reproducibility Assessment, 8. Overall Quality Score (1-10 with justification)`
  }

  const prompt = `You are an expert academic researcher and peer reviewer. ${depthPrompts[depth]}

Paper content:
${content.substring(0, 8000)}`

  try {
    const result = await callAI(prompt)
    document.getElementById('analyzeOutput').textContent = result
    showResult('analyze')
  } catch (e) {
    showError('analyze', e.message)
  }
  document.getElementById('analyzeBtn').disabled = false
}

// ─── AI DETECTOR ─────────────────────────────────────────────────────────────
async function runDetector() {
  const content = getContent('detectorContent')
  if (!content) { alert('Please upload a PDF or paste text to analyze.'); return }
  const mode = document.getElementById('detectorMode').value

  setLoading('detector', true)

  const modeInstructions = {
    standard: 'Standard analysis for general academic text',
    academic: 'Focus specifically on academic writing patterns — look for AI-typical literature review phrases, methodology descriptions, and conclusion patterns common in AI-generated academic papers',
    strict: 'Apply strict detection — flag ANY sentence that shows AI patterns even if subtle. Be aggressive in detection.'
  }

  const prompt = `You are an expert AI content detection system with deep knowledge of linguistic patterns, perplexity analysis, and writing style fingerprinting. Mode: ${modeInstructions[mode]}

Analyze the following text for AI-generated content and provide:

1. OVERALL AI PROBABILITY SCORE: X% (give a single clear percentage)
2. CONFIDENCE LEVEL: (Low/Medium/High)
3. LIKELY SOURCE: (e.g., GPT-4, Claude, Gemini, Human, or Mixed)

4. SENTENCE-LEVEL ANALYSIS:
   - Flag each suspicious sentence/paragraph
   - Label as: [HIGH RISK] [MEDIUM RISK] [LOW RISK] [HUMAN]
   - Explain why

5. AI PATTERN SIGNALS DETECTED:
   - List specific linguistic patterns found (e.g., "excessive hedging", "formulaic transitions", "uniform sentence rhythm", "lack of personal voice", "perfect paragraph structure")

6. HUMAN SIGNALS DETECTED:
   - Any markers suggesting human authorship

7. DETAILED VERDICT:
   - Summary of findings
   - Specific recommendations for the author

Text to analyze:
${content.substring(0, 6000)}`

  try {
    const result = await callAI(prompt, 'You are an expert AI content detector. Always provide a clear numerical probability score.')
    document.getElementById('detectorOutput').textContent = result

    // Extract score
    const match = result.match(/(\d{1,3})\s*%/)
    if (match) {
      const score = Math.min(100, parseInt(match[1]))
      animateScore(score)
    }
    showResult('detector')
  } catch (e) {
    showError('detector', e.message)
  }
  document.getElementById('detectorBtn').disabled = false
}

function animateScore(score) {
  const numEl = document.getElementById('scoreNum')
  const verdictEl = document.getElementById('scoreVerdict')
  const circle = document.getElementById('scoreCircle')

  const color = score > 70 ? '#ff6b6b' : score > 40 ? '#fbbf24' : '#4ade80'
  numEl.textContent = score + '%'
  numEl.style.color = color
  circle.style.stroke = color

  const circumference = 251
  const offset = circumference - (score / 100) * circumference
  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1s ease'
    circle.style.strokeDashoffset = offset
  }, 100)

  if (score > 70) {
    verdictEl.textContent = '⚠️ High AI probability'
    verdictEl.style.color = '#ff6b6b'
  } else if (score > 40) {
    verdictEl.textContent = '⚡ Mixed content'
    verdictEl.style.color = '#fbbf24'
  } else {
    verdictEl.textContent = '✅ Likely human-written'
    verdictEl.style.color = '#4ade80'
  }
}

// ─── HUMANIZER ────────────────────────────────────────────────────────────────
async function runHumanizer() {
  const content = getContent('humanizerInput')
  if (!content) { alert('Please paste text to humanize.'); return }
  const style = document.getElementById('humanizerStyle').value
  const intensity = document.getElementById('humanizerIntensity').value

  document.getElementById('humanizerBtn').disabled = true
  document.getElementById('humanizerEmpty').style.display = 'none'
  document.getElementById('humanizerLoading').style.display = 'block'
  document.getElementById('humanizerResult').style.display = 'none'

  const styleGuide = {
    academic: 'formal academic writing with disciplinary vocabulary, hedging language, and scholarly tone',
    conversational: 'conversational yet intelligent tone, approachable language, natural flow',
    formal: 'highly formal, professional writing suitable for official documents',
    casual: 'relaxed, casual tone with contractions and everyday language'
  }

  const intensityGuide = {
    moderate: 'Make moderate changes — preserve the general structure but humanize language and flow',
    aggressive: 'Completely rewrite — change sentence structures drastically, reorder ideas, use entirely different phrasing while keeping all facts'
  }

  const prompt = `You are an expert academic ghostwriter who specializes in making AI-generated text sound authentically human.

Style: ${styleGuide[style]}
Intensity: ${intensityGuide[intensity]}

Rewriting rules:
- Vary sentence length dramatically (mix very short and long sentences)
- Use natural transitions instead of formulaic ones ("Furthermore" → "What's interesting here is")
- Add subtle uncertainty markers ("it seems", "arguably", "one might argue")
- Include occasional rhetorical questions
- Break perfect paragraph symmetry
- Use active voice more than passive
- Add discipline-specific jargon naturally
- Remove all AI "tells": "It is worth noting", "In conclusion", "This paper aims to", "It is important to"
- Keep ALL facts, numbers, citations, and technical accuracy 100% intact
- Do NOT add any new information

Return ONLY the rewritten text, no commentary or explanation.

Original text:
${content}`

  try {
    const result = await callAI(prompt)
    document.getElementById('humanizerOutput').textContent = result
    document.getElementById('humanizerLoading').style.display = 'none'
    document.getElementById('humanizerResult').style.display = 'block'
  } catch (e) {
    document.getElementById('humanizerLoading').style.display = 'none'
    document.getElementById('humanizerEmpty').style.display = 'flex'
    alert('Error: ' + e.message)
  }
  document.getElementById('humanizerBtn').disabled = false
}

function runDetectorOnHumanized() {
  const text = document.getElementById('humanizerOutput').textContent
  if (!text) return
  document.getElementById('detectorContent').value = text
  showPage('detector')
  setTimeout(() => runDetector(), 300)
}

// ─── REFERENCES ───────────────────────────────────────────────────────────────
async function runReferences() {
  const content = getContent('refsContent')
  if (!content) { alert('Please upload a PDF or paste paper content first.'); return }
  const style = document.getElementById('refStyle').value

  setLoading('refs', true)

  const prompt = `You are a professional academic librarian and citation expert.

Extract ALL references and citations from the following paper content. Format each one in ${style} style.

Requirements:
- Number each reference
- Include: authors, year, title, journal/publisher, volume, issue, pages, DOI if present
- If information is incomplete, include what is available
- Separate each reference with a new line
- Also identify the paper itself as a citable work at the top

Return a clean numbered list only.

Content:
${content.substring(0, 8000)}`

  try {
    const result = await callAI(prompt)
    document.getElementById('refsOutput').textContent = result

    // Parse into cards
    const lines = result.split('\n').filter(l => /^\d+[\.\)]/.test(l.trim()))
    document.getElementById('refsCount').textContent = `${style} References (${lines.length})`
    document.getElementById('refsCards').innerHTML = lines.map((l, i) => {
      const clean = l.replace(/^\d+[\.\)]\s*/, '')
      return `<div class="ref-card">
        <div class="ref-num">[${i+1}]</div>
        <div class="ref-text">${escHtml(clean)}</div>
        <button class="ref-copy" onclick="copyText('${escHtml(clean).replace(/'/g,"\\'")}', this)">Copy citation</button>
      </div>`
    }).join('')

    showResult('refs')
  } catch (e) {
    showError('refs', e.message)
  }
  document.getElementById('refsBtn').disabled = false
}

// ─── MULTI-PAPER ─────────────────────────────────────────────────────────────
function addPaperSlot() {
  const container = document.getElementById('multiPapers')
  const count = container.querySelectorAll('.multi-paper-slot').length + 1
  const slot = document.createElement('div')
  slot.className = 'multi-paper-slot'
  slot.innerHTML = `
    <div class="slot-num">${String(count).padStart(2,'0')}</div>
    <textarea placeholder="Paste paper ${count} content or abstract…" rows="5"></textarea>
    <button class="slot-remove" onclick="removePaperSlot(this)">✕</button>
  `
  container.appendChild(slot)
}

function removePaperSlot(btn) {
  btn.closest('.multi-paper-slot').remove()
  document.querySelectorAll('.multi-paper-slot').forEach((s, i) => {
    s.querySelector('.slot-num').textContent = String(i+1).padStart(2,'0')
    s.querySelector('.slot-remove').style.display = i < 2 ? 'none' : 'block'
  })
}

async function runMulti() {
  const slots = document.querySelectorAll('#multiPapers textarea')
  const papers = Array.from(slots).map(t => t.value.trim()).filter(Boolean)
  if (papers.length < 2) { alert('Please add at least 2 papers.'); return }
  const type = document.getElementById('multiType').value

  setLoading('multi', true)

  const typeInstructions = {
    comprehensive: `Provide a comprehensive synthesis with:
1. OVERVIEW: Brief description of all papers
2. COMMON THEMES: Shared topics, methods, or findings across papers
3. CONTRASTING FINDINGS: Where papers disagree or differ in approach
4. METHODOLOGICAL COMPARISON: How each paper's methods compare
5. COMBINED CONTRIBUTION: What these papers collectively add to the field
6. RESEARCH GAPS: What questions remain unanswered collectively
7. SYNTHESIS PARAGRAPH: A ready-to-use literature review paragraph (250-300 words) citing all papers
8. RECOMMENDED CITATION ORDER: How to cite them in a literature review`,
    thematic: `Group and analyze the papers by themes:
1. Identify 3-5 major themes across all papers
2. For each theme: which papers address it and how
3. How themes interconnect
4. Thematic synthesis paragraph ready for a literature review`,
    comparative: `Direct comparison of all papers:
1. Side-by-side methodology comparison
2. Results comparison (use specific data)
3. Strengths and weaknesses of each
4. Which paper is most rigorous and why
5. Comparative synthesis paragraph`
  }

  const content = papers.map((p, i) => `PAPER ${i+1}:\n${p.substring(0, 3000)}`).join('\n\n---\n\n')
  const prompt = `You are an expert academic researcher specializing in systematic literature reviews.

${typeInstructions[type]}

Papers to synthesize:
${content}`

  try {
    const result = await callAI(prompt)
    document.getElementById('multiOutput').textContent = result
    showResult('multi')
  } catch (e) {
    showError('multi', e.message)
  }
  document.getElementById('multiBtn').disabled = false
}

// ─── Copy / Download ──────────────────────────────────────────────────────────
function copyOutput(id) {
  const text = document.getElementById(id)?.textContent || ''
  navigator.clipboard.writeText(text)
  event.target.textContent = '✓ Copied'
  setTimeout(() => event.target.textContent = 'Copy', 2000)
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text)
  btn.textContent = '✓ Copied'
  setTimeout(() => btn.textContent = 'Copy citation', 1500)
}

function downloadOutput(id, name) {
  const text = document.getElementById(id)?.textContent || ''
  const blob = new Blob([text], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}_${Date.now()}.txt`
  a.click()
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
}
