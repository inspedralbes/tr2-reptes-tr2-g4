function cleanText(text) {
  return text
    .replace(/-\s*[\n\r]+\s*/g, "")
    
    .replace(/di\s*fi\s*cultat/gi, "dificultat")
    .replace(/especí\s*[\n\r]*\s*fi\s*c/gi, "específic") 
    .replace(/especí\s*[\n\r]*\s*c/gi, "específic")      
    .replace(/especí\s*fi\s*ques/gi, "específiques")
    .replace(/especifi\s*queu/gi, "especifiqueu")
    .replace(/certi\s*fi\s*cat/gi, "certificat")
    .replace(/signi\s*fi\s*ca/gi, "significa")
    .replace(/ortogra\s*[\n\r]*\s*fi\s*a/gi, "ortografia")
    .replace(/ortogra\s*[\n\r]*\s*a/gi, "ortografia")    
    .replace(/ortogrà\s*fi\s*ca/gi, "ortogràfica") 
    .replace(/ortogrà\b/gi, "ortogràfica") 
    .replace(/cali\s*fi\s*cació/gi, "qualificació")
    .replace(/plani\s*fi\s*cació/gi, "planificació")
    .replace(/justi\s*fi\s*cació/gi, "justificació")
    .replace(/Justifi\s*fi\s*cació/gi, "Justificació")
    .replace(/dè\s*fi\s*cit/gi, "dèficit")
    .replace(/identi\s*fi\s*cació/gi, "identificació")
    .replace(/cació/gi, "ficació") 
    .replace(/fl\s*u/gi, "flu")
    .replace(/con\s*fl\s*icte/gi, "conflicte")
    .replace(/··/g, "·") 
    .replace(/refl\s*exió/gi, "reflexió")
    .replace(/grafi\s*a/gi, "grafia")
    .replace(/geografi\s*a/gi, "geografia")
    .replace(/fotografi\s*es/gi, "fotografies")
    .replace(/simplifi\s*car/gi, "simplificar")
    .replace(/fi\s*queu-les/gi, "") 
    .replace(/fi\s*nalitzar/gi, "finalitzar") 
    .replace(/Justifificació/gi, "Justificació") 
    .replace(/Cat\s+Adaptacions/gi, "Adaptacions") 
    .replace(/Cat\s+Motiu/gi, "Motiu")
    .replace(/Cat\s+/g, "") 
    .replace(/Sí\s+No/g, "") 
    
    .replace(/D’adaptació\)/gi, "") 
    .replace(/\(especi\b/gi, "")
    .replace(/Altres dificultats\s*$/gm, "") 
    .replace(/Altres adaptacions\s*\)/gi, "") 
    .replace(/llegir-li en veu alta les\s*$/gm, "llegir-li en veu alta les preguntes")
    .replace(/preguntes\s+preguntes/gi, "preguntes")
    .replace(/xxxxx/gi, "l'alumne") 
    .replace(/Institut\s*Montserrat/gi, "")
    .replace(/Copèrnic.*Barcelona/gi, "")
    .replace(/telèfon:.*fax:/gi, "")
    .replace(/email:.*cat/gi, "")
    .replace(/\b\d{2,3}\s\d{2,3}\s\d{2}\s\d{2}\b/g, "") 
    .replace(/\S*@\S*\.\S*/g, "") 
    .replace(/www\.\S+/g, "") 

    .replace(/Llengua catalana|Llengua castellana|Llengua anglesa|Matemàtiques|Física i química|Ciències de la naturalesa|Ciències socials|Educació visual i plàstica|Música|Tecnologia|Educació física|Optativa/gi, "")
    .replace(/Continguts|Avaluació dels continguts|Assolit|SÍ|NO/g, "")
    
    .replace(/Motiu Dictamen d’escolarització/gi, "")
    .replace(/Informe de necessitats educatives específiques derivades de situacions socials desfavorides/gi, "")
    .replace(/Certificat dels serveis de valoració i orientació per a persones amb discapacitat \(CAD\)/gi, "")
    .replace(/Decisió del centre educatiu/gi, "")
    .replace(/Observacions:/gi, "")
    .replace(/Justificació del trastorns específic de dislèxia/gi, "")
    .replace(/Descripció breu de les característiques de l’alumne\/a/gi, "")
    .replace(/Habilitats acadèmiques afectades/gi, "")
    .replace(/Adaptacions que es proposen per a totes les matèries/gi, "")
    .replace(/Orientacions per ajudar l’alumne\/ a superar les seves dificultats/gi, "")
    .replace(/Pel que fa a les instruccions:/gi, "")
    .replace(/Pel que fa al temps:/gi, "")
    .replace(/Pel que fa a les activitats:/gi, "")
    .replace(/Pel que fa al seguiment i a l’organització:/gi, "")
    .replace(/Pel que fa a l’ortografia:/gi, "")
    .replace(/A les matèries que no siguin les de llengua:/gi, "")
    .replace(/A les matèries de llengua, cal assenyalar totes les faltes d’ortografia però:/gi, "")
    .replace(/Lloc i data:/gi, "")
    .replace(/Signatura del.*/gi, "")

    .replace(/^\s*\d+\s*$/gm, "")
    
    .replace(/[\n\r]+/g, " ")
    
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    
    .replace(/\s\)\s/g, " ") 
    .replace(/\s\)\./g, ".") 
    .replace(/^\)\s*/g, "")
    .replace(/\(\s*\)/g, "");
}

function capitalizeFirstLetter(string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function analyzePI(text) {
  if (!text || typeof text !== 'string') {
    console.log("⚠️ ALERTA: El text rebut per analitzar és buit o invàlid.");
    return {
      perfil: [],
      dificultats: [],
      adaptacions: [],
      avaluacio: [],
      recomanacions: []
    };
  }

  text = cleanText(text);

  console.log("----------------------------------------------------");
  console.log("🔍 TEXT EXTRETA (PRIMERS 100 CARÀCTERS):");
  console.log(`"${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
  console.log(`📏 Longitud total: ${text.length} caràcters`);
  console.log("----------------------------------------------------");

  const sentences = text
    .split(/(?<!etc)\.\s+|;|•|●|·|\s+-\s+|\s+X\s+|(?:\s|^)\d+\.\s+/) 
    .map(s => s.trim())
    .filter(s => !s.includes("Pla individualitzat:")) 
    .filter(s => !s.includes("Dades de l’alumne"))
    .filter(s => !s.includes("Signatura del"))
    .filter(s => !s.includes("Motiu Dictamen")) 
    .filter(s => s.length > 20); 

  const result = {
    perfil: [],
    dificultats: [],
    adaptacions: [],
    avaluacio: [],
    recomanacions: [],
    stats: {
      length: text.length,
      preview: text.substring(0, 150) + "..."
    }
  };

  const usedSentences = new Set();

  sentences.forEach(sentence => {
    if (usedSentences.has(sentence)) return; 
    const sLower = sentence.toLowerCase();
    const sClean = capitalizeFirstLetter(sentence);
    let added = false;

    if (
      sLower.includes("trastorn") ||
      sLower.includes("tdah") ||
      sLower.includes("dislèxia") ||
      sLower.includes("retard") ||
      sLower.includes("nese") ||
      sLower.includes("diagnòstic")
    ) {
      result.perfil.push(sClean);
      added = true;
    }

    if (
      sLower.includes("dificultat") ||
      sLower.includes("manca") ||
      sLower.includes("li costa") ||
      sLower.includes("baixa") ||
      sLower.includes("lentitud")
    ) {
      result.dificultats.push(sClean);
      added = true;
    }

    if (
      sLower.includes("més temps") ||
      sLower.includes("adaptació") ||
      sLower.includes("no penalitzar") ||
      sLower.includes("ús d’ordinador") ||
      sLower.includes("suport oral")
    ) {
      result.adaptacions.push(sClean);
      added = true;
    }

    if (
      sLower.includes("avaluació") ||
      sLower.includes("examen") ||
      sLower.includes("prova")
    ) {
      result.avaluacio.push(sClean);
      added = true;
    }

    if (
      sLower.includes("cal") ||
      sLower.includes("recomanable") ||
      sLower.includes("prioritzar") ||
      sLower.includes("evitar")
    ) {
      result.recomanacions.push(sClean);
      added = true;
    }

    if (added) usedSentences.add(sentence); 
  });

  console.log(`Resultats trobats -> Dificultats: ${result.dificultats.length}, Adaptacions: ${result.adaptacions.length}`);

  return result;
}

module.exports = { analyzePI };