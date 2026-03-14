let paperText="";

async function loadPDF(){

let fileInput=document.getElementById("pdfFile");

if(fileInput.files.length===0){
document.getElementById("status").innerText="Select a PDF file";
return;
}

let file=fileInput.files[0];

document.getElementById("status").innerText="Reading paper...";

let reader=new FileReader();

reader.onload=async function(){

let typedarray=new Uint8Array(this.result);

let pdf=await pdfjsLib.getDocument(typedarray).promise;

paperText="";

for(let i=1;i<=pdf.numPages;i++){

let page=await pdf.getPage(i);

let content=await page.getTextContent();

let strings=content.items.map(item=>item.str);

paperText+=strings.join(" ")+" ";

}

document.getElementById("status").innerText="Paper loaded successfully";

analyzePaper();

}

reader.readAsArrayBuffer(file);

}



function analyzePaper(){

let sentences=paperText.split(". ");

let summary=sentences.slice(0,5).join(". ");

let findings=sentences.filter(s=>

s.toLowerCase().includes("result") ||
s.toLowerCase().includes("significant") ||
s.toLowerCase().includes("increase") ||
s.toLowerCase().includes("improve") ||
s.toLowerCase().includes("show")

).slice(0,5).join(". ");

let keywords=extractKeywords(paperText);

let conclusion=findSection("conclusion");

let output="";

output+="SUMMARY\n\n"+summary+"\n\n";

output+="KEY FINDINGS\n\n"+findings+"\n\n";

output+="TOP KEYWORDS\n\n"+keywords+"\n\n";

output+="CONCLUSION SECTION\n\n"+conclusion;

document.getElementById("result").innerText=output;

}



function extractKeywords(text){

let words=text.toLowerCase().replace(/[^a-z\s]/g,"").split(/\s+/);

let stop=["the","and","for","that","with","this","from","are","was","were","have","has","had"];

let freq={};

words.forEach(word=>{

if(word.length>6 && !stop.includes(word)){

freq[word]=(freq[word]||0)+1;

}

});

let sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]);

return sorted.slice(0,10).map(x=>x[0]).join(", ");

}



function findSection(keyword){

let lower=paperText.toLowerCase();

let index=lower.indexOf(keyword);

if(index===-1)return "Not detected.";

return paperText.substring(index,index+600);

}