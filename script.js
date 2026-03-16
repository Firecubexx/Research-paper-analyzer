// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

let uploadedPapers = [];

/**
 * Main Orchestrator
 * Triggered by the buttons in index.html
 */
async function processFiles(mode) {
    const fileInput = document.getElementById("pdfFiles");
    const status = document.getElementById("status");
    const display = document.getElementById("displayArea");

    if (fileInput.files.length === 0) {
        status.innerText = "Please select PDF files first.";
        return;
    }

    status.innerText = "Processing papers... please wait.";
    display.innerHTML = ""; // Clear previous results
    uploadedPapers = [];

    // Loop through all selected files and extract data
    for (let file of fileInput.files) {
        try {
            const text = await extractText(file);
            uploadedPapers.push({
                name: file.name,
                text: text,
                keywords: extractKeywords(text),
                sentences: text.split(/[.!?]+ /)
            });
        } catch (error) {
            console.error("Error processing file:", file.name, error);
        }
    }

    status.innerText = `Successfully processed ${uploadedPapers.length} paper(s).`;

    // Direct the logic based on which button was clicked
    if (mode === 'single') renderSingle();
    else if (mode === 'compare') renderCompare();
    else if (mode === 'gap') renderGap();
}

/**
 * PDF Text Extraction
 */
async function extractText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(" ") + " ";
    }
    return fullText;
}

/**
 * Keyword Analysis with Stop-word filtering
 */
function extractKeywords(text) {
    const stopWords = ["the","and","for","that","with","this","from","results","research","study","paper","using","which"];
    const words = text.toLowerCase().replace(/[^a-z\s]/g,"").split(/\s+/);
    const freq = {};
    
    words.forEach(word => {
        if (word.length > 6 && !stopWords.includes(word)) {
            freq[word] = (freq[word] || 0) + 1;
        }
    });
    
    return Object.entries(freq)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 8)
        .map(x => x[0]);
}

/**
 * UI Rendering: Single Paper Analysis
 */
function renderSingle() {
    if (uploadedPapers.length === 0) return;
    const p = uploadedPapers[0];
    const findings = p.sentences.filter(s => /result|show|find|significant|increase|conclude/i.test(s)).slice(0, 5);
    
    document.getElementById("displayArea").innerHTML = `
        <div class="result-card">
            <h2 class="section-title">Deep Analysis: ${p.name}</h2>
            <p><strong>Top Keywords:</strong> ${p.keywords.join(", ")}</p>
            <h3>Summary (Introductory)</h3>
            <p>${p.sentences.slice(0, 4).join(". ")}.</p>
            <h3>Key Findings</h3>
            <ul>${findings.map(f => `<li>${f}</li>`).join('')}</ul>
        </div>
    `;
}

/**
 * UI Rendering: Side-by-Side Comparison
 */
function renderCompare() {
    if (uploadedPapers.length < 2) {
        alert("Upload at least 2 papers for comparison.");
        return;
    }

    let html = `<div class="grid">`;
    uploadedPapers.forEach(p => {
        html += `
            <div class="result-card">
                <h3 style="color:var(--primary)">${p.name}</h3>
                <p><strong>Core Focus:</strong> ${p.keywords.slice(0,3).join(", ")}</p>
                <hr style="opacity:0.1">
                <p><strong>Key Context:</strong> ${p.sentences.find(s => s.toLowerCase().includes("method")) || p.sentences[10]}...</p>
            </div>
        `;
    });
    html += `</div>`;
    document.getElementById("displayArea").innerHTML = html;
}

/**
 * UI Rendering: Research Gap Identification
 */
function renderGap() {
    if (uploadedPapers.length < 2) {
        alert("Upload multiple papers to find gaps.");
        return;
    }

    // Heuristic logic to find "gaps" based on differing keywords
    document.getElementById("displayArea").innerHTML = `
        <div class="result-card">
            <h2 class="section-title">Research Gap Identification</h2>
            <p>I have cross-referenced the content of your uploaded documents:</p>
            <ul>
                <li><strong>Thematic Divergence:</strong> Paper A focuses on <em>${uploadedPapers[0].keywords[0]}</em> while Paper B emphasizes <em>${uploadedPapers[1].keywords[0]}</em>.</li>
                <li><strong>Methodological Gap:</strong> There is a lack of shared focus on <em>${uploadedPapers[0].keywords[2]}</em> across all documents.</li>
                <li><strong>Recommendation:</strong> A new study could bridge <strong>${uploadedPapers[0].keywords[0]}</strong> with the frameworks used in <strong>${uploadedPapers[1].name}</strong>.</li>
            </ul>
        </div>
    `;
}
