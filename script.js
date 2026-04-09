const PROXY = 'https://rja-proxy-production.up.railway.app/proxy'

window.addEventListener('DOMContentLoaded', () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  showPage('home')
})

// ── Navigation ────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const page = document.getElementById('page-' + id)
  if (page) page.classList.add('active')
  const btn = document.querySelector('[data-page="' + id + '"]')
  if (btn) btn.classList.add('active')
  window.scrollTo(0, 0)
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open')
}

function selectChip(el, hiddenId, value) {
  el.closest('.option-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
  el.classList.add('active')
  document.getElementById(hiddenId).value = value
}

// ── PDF Upload ────────────────────────────────────────────────────────────────
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
  if (meta) {
    meta.style.display = 'flex'
    meta.style.color = 'var(--text2)'
    meta.innerHTML = '⏳ Extracting text from <strong>' + file.name + '</strong>…'
  }
  try {
    const text = await extractPdfText(file)
    const el = document.getElementById(contentId)
    if (el) el.value = text
    if (meta) {
      meta.innerHTML = '✓ <strong>' + file.name + '</strong> · ' + (file.size/1048576).toFixed(1) + ' MB extracted'
      meta.style.color = 'var(--teal)'
    }
  } catch(err) {
    if (meta) {
      meta.innerHTML = '⚠️ Could not extract text — please paste manually'
      meta.style.color = 'var(--red)'
    }
  }
}

async function extractPdfText(file) {
  const ab = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(function(it){ return it.str }).join(' ') + '\n\n'
  }
  return text.trim() || '[No extractable text]'
}

// ── API call ──────────────────────────────────────────────────────────────────
async function callAI(prompt, system) {
  const body = {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000
  }
  if (system) body.system = system

  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await r.json()
  if (data.error) throw new Error(data.error.message)
  return data.content[0].text
}

// ── UI State ──────────────────────────────────────────────────────────────────
function setLoading(tool, on) {
  var empty = document.getElementById(tool + 'Empty')
  var loading = document.getElementById(tool + 'Loading')
  var result = document.getElementById(tool + 'Result')
  var btn = document.getElementById(tool + 'Btn')
  if (empty) empty.style.display = on ? 'none' : 'flex'
  if (loading) loading.style.display = on ? 'block' : 'none'
  if (result) result.style.display = 'none'
  if (btn) btn.disabled = on
}

function showResult(tool) {
  var empty = document.getElementById(tool + 'Empty')
  var loading = document.getElementById(tool + 'Loading')
  var result = document.getElementById(tool + 'Result')
  var btn = document.getElementById(tool + 'Btn')
  if (empty) empty.style.display = 'none'
  if (loading) loading.style.display = 'none'
  if (result) result.style.display = 'block'
  if (btn) btn.disabled = false
}

function showToolError(tool, msg) {
  var loading = document.getElementById(tool + 'Loading')
  var empty = document.getElementById(tool + 'Empty')
  var btn = document.getElementById(tool + 'Btn')
  if (loading) loading.style.display = 'none'
  if (empty) empty.style.display = 'flex'
  if (btn) btn.disabled = false
  alert('Error: ' + msg)
}

// ── Paper Analysis ────────────────────────────────────────────────────────────
async function runAnalysis() {
  var content = (document.getElementById('analyzeContent').value || '').trim()
  if (!content) { alert('Please upload a PDF or paste paper content first.'); return }
  var depth = document.getElementById('analyzeDepth').value
  setLoading('analyze', true)

  var depthMap = {
    standard: 'Provide a structured analysis with sections: 1) Research Objective, 2) Methodology, 3) Key Findings with data, 4) Contributions, 5) Limitations, 6) One-line Verdict.',
    deep: 'Provide exhaustive analysis: 1) Research Objective & Hypothesis, 2) Theoretical Framework, 3) Detailed Methodology, 4) All Key Findings with numerical data, 5) Discussion & Interpretation, 6) Contributions to the field, 7) Limitations & Weaknesses, 8) Future Research Directions, 9) Practical Implications, 10) Critical Verdict.',
    critical: 'Perform critical peer-review: 1) Research Objective clarity, 2) Methodological Rigor critique, 3) Statistical validity check, 4) Discussion quality, 5) Gaps & Weaknesses, 6) Comparison to literature, 7) Reproducibility, 8) Overall Quality Score 1-10 with justification.'
  }

  var prompt = 'You are an expert academic researcher and peer reviewer. ' + depthMap[depth] + '\n\nPaper content:\n' + content.substring(0, 8000)

  try {
    var result = await callAI(prompt)
    document.getElementById('analyzeOutput').textContent = result
    showResult('analyze')
  } catch(e) {
    showToolError('analyze', e.message)
  }
}

// ── AI Detector ───────────────────────────────────────────────────────────────
async function runDetector() {
  var content = (document.getElementById('detectorContent').value || '').trim()
  if (!content) { alert('Please upload a PDF or paste text to analyze.'); return }
  var mode = document.getElementById('detectorMode').value
  setLoading('detector', true)

  var modeMap = {
    standard: 'Standard analysis for general text.',
    academic: 'Focus specifically on academic writing patterns — AI-typical phrases in literature reviews, methodology sections, conclusions.',
    strict: 'Apply strict detection — flag ANY sentence showing AI patterns even if subtle.'
  }

  var prompt = 'You are an expert AI content detection system. Mode: ' + modeMap[mode] + '\n\nAnalyze the following text and provide:\n\n1. OVERALL AI PROBABILITY SCORE: X% (single clear percentage)\n2. CONFIDENCE LEVEL: Low/Medium/High\n3. LIKELY SOURCE: GPT-4 / Claude / Gemini / Human / Mixed\n4. SENTENCE-LEVEL ANALYSIS: Flag suspicious sentences as [HIGH RISK] [MEDIUM RISK] [LOW RISK] [HUMAN]\n5. AI PATTERN SIGNALS DETECTED: List specific patterns found\n6. HUMAN SIGNALS DETECTED: Any human authorship markers\n7. DETAILED VERDICT: Summary and recommendations\n\nText:\n' + content.substring(0, 6000)

  try {
    var result = await callAI(prompt, 'You are an expert AI content detector. Always provide a clear numerical probability score.')
    document.getElementById('detectorOutput').textContent = result

    var match = result.match(/(\d{1,3})\s*%/)
    if (match) animateScore(Math.min(100, parseInt(match[1])))

    showResult('detector')
  } catch(e) {
    showToolError('detector', e.message)
  }
}

function animateScore(score) {
  var numEl = document.getElementById('scoreNum')
  var verdictEl = document.getElementById('scoreVerdict')
  var circle = document.getElementById('scoreCircle')
  var color = score > 70 ? '#ff6b6b' : score > 40 ? '#fbbf24' : '#4ade80'
  numEl.textContent = score + '%'
  numEl.style.color = color
  if (circle) {
    circle.style.stroke = color
    var offset = 251 - (score / 100) * 251
    setTimeout(function() {
      circle.style.transition = 'stroke-dashoffset 1s ease'
      circle.style.strokeDashoffset = offset
    }, 100)
  }
  if (score > 70) { verdictEl.textContent = '⚠️ High AI probability'; verdictEl.style.color = '#ff6b6b' }
  else if (score > 40) { verdictEl.textContent = '⚡ Mixed content'; verdictEl.style.color = '#fbbf24' }
  else { verdictEl.textContent = '✅ Likely human-written'; verdictEl.style.color = '#4ade80' }
}

// ── Humanizer ─────────────────────────────────────────────────────────────────
async function runHumanizer() {
  var content = (document.getElementById('humanizerInput').value || '').trim()
  if (!content) { alert('Please paste text to humanize.'); return }
  var style = document.getElementById('humanizerStyle').value
  var intensity = document.getElementById('humanizerIntensity').value

  document.getElementById('humanizerBtn').disabled = true
  document.getElementById('humanizerEmpty').style.display = 'none'
  document.getElementById('humanizerLoading').style.display = 'block'
  document.getElementById('humanizerResult').style.display = 'none'

  var styleMap = {
    academic: 'formal academic writing with scholarly tone and disciplinary vocabulary',
    conversational: 'conversational yet intelligent, approachable and natural',
    formal: 'highly formal, professional writing for official documents',
    casual: 'relaxed casual tone with contractions and everyday language'
  }
  var intensityMap = {
    moderate: 'Make moderate changes — preserve general structure but humanize language and flow.',
    aggressive: 'Completely rewrite — change structures drastically, reorder ideas, use entirely different phrasing while keeping all facts.'
  }

  var prompt = 'You are an expert academic ghostwriter specializing in making AI text sound human.\n\nStyle: ' + styleMap[style] + '\nIntensity: ' + intensityMap[intensity] + '\n\nRules:\n- Vary sentence length (mix short and long)\n- Use natural transitions instead of formulaic ones\n- Add subtle uncertainty markers (it seems, arguably)\n- Break perfect paragraph symmetry\n- Remove AI tells: "It is worth noting", "In conclusion", "This paper aims to", "Furthermore", "Moreover"\n- Keep ALL facts, numbers, citations 100% intact\n- Return ONLY the rewritten text, no commentary\n\nText:\n' + content

  try {
    var result = await callAI(prompt)
    document.getElementById('humanizerOutput').textContent = result
    document.getElementById('humanizerLoading').style.display = 'none'
    document.getElementById('humanizerResult').style.display = 'block'
    document.getElementById('humanizerBtn').disabled = false
  } catch(e) {
    document.getElementById('humanizerLoading').style.display = 'none'
    document.getElementById('humanizerEmpty').style.display = 'flex'
    document.getElementById('humanizerBtn').disabled = false
    alert('Error: ' + e.message)
  }
}

function runDetectorOnHumanized() {
  var text = document.getElementById('humanizerOutput').textContent
  if (!text) return
  document.getElementById('detectorContent').value = text
  showPage('detector')
  setTimeout(runDetector, 400)
}

// ── References ────────────────────────────────────────────────────────────────
async function runReferences() {
  var content = (document.getElementById('refsContent').value || '').trim()
  if (!content) { alert('Please upload a PDF or paste paper content first.'); return }
  var style = document.getElementById('refStyle').value
  setLoading('refs', true)

  var prompt = 'You are a professional academic librarian and citation expert.\n\nExtract ALL references from the following paper and format each in ' + style + ' style.\n\nReturn a clean numbered list. Include authors, year, title, journal, volume, issue, pages, DOI where available.\n\nContent:\n' + content.substring(0, 8000)

  try {
    var result = await callAI(prompt)
    document.getElementById('refsOutput').textContent = result

    var lines = result.split('\n').filter(function(l){ return /^\d+[\.\)]/.test(l.trim()) })
    document.getElementById('refsCount').textContent = style + ' References (' + lines.length + ')'
    document.getElementById('refsCards').innerHTML = lines.map(function(l, i) {
      var clean = l.replace(/^\d+[\.\)]\s*/, '')
      return '<div class="ref-card"><div class="ref-num">[' + (i+1) + ']</div><div class="ref-text">' + escHtml(clean) + '</div><button class="ref-copy" onclick="copyRefText(this, \'' + escHtml(clean).replace(/'/g,"\\'") + '\')">Copy citation</button></div>'
    }).join('')

    showResult('refs')
  } catch(e) {
    showToolError('refs', e.message)
  }
}

// ── Multi-Paper ───────────────────────────────────────────────────────────────
function addPaperSlot() {
  var container = document.getElementById('multiPapers')
  var count = container.querySelectorAll('.multi-paper-slot').length + 1
  var slot = document.createElement('div')
  slot.className = 'multi-paper-slot'
  slot.innerHTML = '<div class="slot-num">' + String(count).padStart(2,'0') + '</div><textarea placeholder="Paste paper ' + count + ' content or abstract…" rows="5"></textarea><button class="slot-remove" onclick="removePaperSlot(this)">✕</button>'
  container.appendChild(slot)
}

function removePaperSlot(btn) {
  btn.closest('.multi-paper-slot').remove()
  document.querySelectorAll('.multi-paper-slot').forEach(function(s, i) {
    s.querySelector('.slot-num').textContent = String(i+1).padStart(2,'0')
    s.querySelector('textarea').placeholder = 'Paste paper ' + (i+1) + ' content…'
    s.querySelector('.slot-remove').style.display = i < 2 ? 'none' : 'block'
  })
}

async function runMulti() {
  var slots = document.querySelectorAll('#multiPapers textarea')
  var papers = Array.from(slots).map(function(t){ return t.value.trim() }).filter(Boolean)
  if (papers.length < 2) { alert('Please add content for at least 2 papers.'); return }
  var type = document.getElementById('multiType').value
  setLoading('multi', true)

  var typeMap = {
    comprehensive: '1) Overview of all papers, 2) Common Themes, 3) Contrasting Findings, 4) Methodological Comparison, 5) Combined Contribution to the field, 6) Research Gaps, 7) Ready-to-use Literature Review Paragraph (250-300 words), 8) Recommended Citation Order',
    thematic: '1) Identify 3-5 major themes across papers, 2) Which papers address each theme and how, 3) Theme interconnections, 4) Thematic synthesis paragraph ready for literature review',
    comparative: '1) Side-by-side methodology comparison, 2) Results comparison with specific data, 3) Strengths and weaknesses of each paper, 4) Which paper is most rigorous and why, 5) Comparative synthesis paragraph'
  }

  var content = papers.map(function(p, i){ return 'PAPER ' + (i+1) + ':\n' + p.substring(0, 3000) }).join('\n\n---\n\n')
  var prompt = 'You are an expert academic researcher specializing in systematic literature reviews.\n\nSynthesize these ' + papers.length + ' papers with:\n' + typeMap[type] + '\n\nPapers:\n' + content

  try {
    var result = await callAI(prompt)
    document.getElementById('multiOutput').textContent = result
    showResult('multi')
  } catch(e) {
    showToolError('multi', e.message)
  }
}

// ── Copy / Download ───────────────────────────────────────────────────────────
function copyOutput(id) {
  var text = document.getElementById(id).textContent || ''
  navigator.clipboard.writeText(text)
  var btn = event.target
  btn.textContent = '✓ Copied'
  setTimeout(function(){ btn.textContent = 'Copy' }, 2000)
}

function copyRefText(btn, text) {
  navigator.clipboard.writeText(text)
  btn.textContent = '✓ Copied'
  setTimeout(function(){ btn.textContent = 'Copy citation' }, 1500)
}

function downloadOutput(id, name) {
  var text = document.getElementById(id).textContent || ''
  var blob = new Blob([text], { type: 'text/plain' })
  var a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name + '_' + Date.now() + '.txt'
  a.click()
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
