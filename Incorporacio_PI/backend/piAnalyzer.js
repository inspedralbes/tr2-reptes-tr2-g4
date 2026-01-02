/**
 * piAnalyzer.js
 * Analitza el text del PI i extreu informació rellevant per al docent
 * basant-se en patrons de llenguatge educatiu.
 */

// Funció per arreglar errors típics de PDF (lligadures trencades com "fi c", "fl u")
// I també uneix paraules tallades per salts de línia
function cleanText(text) {
  return text
    // 1. Reparar paraules tallades amb guionet al final de línia (ex: "di-\nficultat")
    .replace(/-\s*[\n\r]+\s*/g, "")
    
    // 2. Reparar errors típics de PDF (lligadures trencades o lletres que volen)
    .replace(/di\s*fi\s*cultat/gi, "dificultat")
    .replace(/especí\s*[\n\r]*\s*fi\s*c/gi, "específic") // Cas amb 'fi' separat
    .replace(/especí\s*[\n\r]*\s*c/gi, "específic")      // Cas on 'fi' ha desaparegut (com al teu exemple)
    .replace(/especí\s*fi\s*ques/gi, "específiques")
    .replace(/especifi\s*queu/gi, "especifiqueu")
    .replace(/certi\s*fi\s*cat/gi, "certificat")
    .replace(/signi\s*fi\s*ca/gi, "significa")
    .replace(/ortogra\s*[\n\r]*\s*fi\s*a/gi, "ortografia")
    .replace(/ortogra\s*[\n\r]*\s*a/gi, "ortografia")    // Cas on 'fi' ha desaparegut
    .replace(/ortogrà\s*fi\s*ca/gi, "ortogràfica") // FIX: ortogrà fi ca
    .replace(/ortogrà\b/gi, "ortogràfica") // Arregla "ortogrà" tallat
    .replace(/cali\s*fi\s*cació/gi, "qualificació")
    .replace(/plani\s*fi\s*cació/gi, "planificació")
    .replace(/justi\s*fi\s*cació/gi, "justificació")
    .replace(/Justifi\s*fi\s*cació/gi, "Justificació")
    .replace(/dè\s*fi\s*cit/gi, "dèficit")
    .replace(/identi\s*fi\s*cació/gi, "identificació")
    .replace(/cació/gi, "ficació") // Intent de recuperar terminacions orfes si 'fi' ha volat
    .replace(/fl\s*u/gi, "flu")
    .replace(/con\s*fl\s*icte/gi, "conflicte")
    .replace(/··/g, "·") // FIX: Doble punt volat
    .replace(/refl\s*exió/gi, "reflexió")
    .replace(/grafi\s*a/gi, "grafia")
    .replace(/geografi\s*a/gi, "geografia")
    .replace(/fotografi\s*es/gi, "fotografies")
    .replace(/simplifi\s*car/gi, "simplificar")
    .replace(/fi\s*queu-les/gi, "") // Eliminar "fi queu-les" (especifiqueu-les trencat)
    .replace(/fi\s*nalitzar/gi, "finalitzar") // FIX: fi nalitzar
    .replace(/Justifificació/gi, "Justificació") // FIX: Error específic detectat
    .replace(/Cat\s+Adaptacions/gi, "Adaptacions") // Neteja específica que has demanat
    .replace(/Cat\s+Motiu/gi, "Motiu")
    .replace(/Cat\s+/g, "") // Eliminar "Cat" (artefacte del PDF)
    .replace(/Sí\s+No/g, "") // Eliminar capçaleres de "Sí No"
    
    // 3. Netejar artefactes del formulari i talls lletjos que has detectat
    .replace(/D’adaptació\)/gi, "") // Eliminar tancament de parèntesi orfe
    .replace(/\(especi\b/gi, "") // Eliminar "(especi" tallat
    .replace(/Altres dificultats\s*$/gm, "") // Eliminar títols buits
    .replace(/Altres adaptacions\s*\)/gi, "") // FIX: Altres adaptacions )
    .replace(/llegir-li en veu alta les\s*$/gm, "llegir-li en veu alta les preguntes") // Intentar recuperar context
    .replace(/preguntes\s+preguntes/gi, "preguntes") // FIX: preguntes preguntes
    .replace(/xxxxx/gi, "l'alumne") // FIX: xxxxx -> l'alumne
    
    // Remove contact info (noise)
    .replace(/Institut\s*Montserrat/gi, "")
    .replace(/Copèrnic.*Barcelona/gi, "")
    .replace(/telèfon:.*fax:/gi, "")
    .replace(/email:.*cat/gi, "")
    .replace(/\b\d{2,3}\s\d{2,3}\s\d{2}\s\d{2}\b/g, "") // FIX: Phone numbers like 93 414 04 34
    .replace(/\S*@\S*\.\S*/g, "") // FIX: Emails like @xtec.cat
    .replace(/www\.\S+/g, "") // FIX: URLs like www.cat

    // 3b. NETEJA AGRESSIVA DE TÍTOLS DE FORMULARI (Per deixar només la info essencial)
    // Afegim títols d'assignatures per evitar que surtin al resum
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

    // 3c. NETEJA DE NÚMEROS DE PÀGINA (Línies que només tenen números)
    .replace(/^\s*\d+\s*$/gm, "")
    
    // 4. UNIR LÍNIES (Tornem a l'estratègia anterior per evitar frases tallades)
    // Unim amb espai per reconstruir frases com "Si cal, reforçar..."
    .replace(/[\n\r]+/g, " ")
    
    // 5. Netejar espais múltiples generats
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    
    // 6. NETEJA FINAL D'ARTEFACTES (Parentesis solts)
    .replace(/\s\)\s/g, " ") // Parentesis tancat solt al mig
    .replace(/\s\)\./g, ".") // Parentesis tancat abans de punt
    .replace(/^\)\s*/g, "") // Parentesis tancat a l'inici
    .replace(/\(\s*\)/g, ""); // Parentesis buits
}

function capitalizeFirstLetter(string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function analyzePI(text) {
  // PROTECCIÓ: Si el text és buit o no existeix (ex: PDF escanejat), retornem buit sense petar
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

  // 0. Neteja prèvia d'artefactes del PDF
  text = cleanText(text);

  // LOG DE DEBUG: Per veure què està llegint realment
  console.log("----------------------------------------------------");
  console.log("🔍 TEXT EXTRETA (PRIMERS 100 CARÀCTERS):");
  console.log(`"${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
  console.log(`📏 Longitud total: ${text.length} caràcters`);
  console.log("----------------------------------------------------");

  // 1. Neteja i segmentació de frases
  // MILLORA: Afegim la "X" (majúscula envoltada d'espais) com a separador de llista,
  // ja que és el que fa servir aquest PDF per marcar opcions seleccionades.
  // També separem per guionets (-), punts rodons (●), punts volats (·) i llistes numerades (1.)
  const sentences = text
    // El regex (?:\s|^)\d+\.\s+ detecta " 1. " o "2. " com a inici de frase
    .split(/(?<!etc)\.\s+|;|•|●|·|\s+-\s+|\s+X\s+|(?:\s|^)\d+\.\s+/) 
    .map(s => s.trim())
    // Filtrem títols del formulari que no aporten res
    .filter(s => !s.includes("Pla individualitzat:")) 
    .filter(s => !s.includes("Dades de l’alumne"))
    .filter(s => !s.includes("Signatura del"))
    .filter(s => !s.includes("Motiu Dictamen")) // Eliminar capçaleres administratives
    .filter(s => s.length > 20); // Ignorem fragments massa curts (augmentat a 20 per evitar soroll)

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

  // Set per evitar duplicats exactes
  const usedSentences = new Set();

  sentences.forEach(sentence => {
    if (usedSentences.has(sentence)) return; // Si ja l'hem afegit, passem
    const sLower = sentence.toLowerCase();
    const sClean = capitalizeFirstLetter(sentence); // Posem la frase bonica per guardar-la
    let added = false;

    // PERFIL / DIAGNÒSTIC
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

    // DIFICULTATS
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

    // ADAPTACIONS
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

    // AVALUACIÓ
    if (
      sLower.includes("avaluació") ||
      sLower.includes("examen") ||
      sLower.includes("prova")
    ) {
      result.avaluacio.push(sClean);
      added = true;
    }

    // RECOMANACIONS DOCENTS
    if (
      sLower.includes("cal") ||
      sLower.includes("recomanable") ||
      sLower.includes("prioritzar") ||
      sLower.includes("evitar")
    ) {
      result.recomanacions.push(sClean);
      added = true;
    }

    if (added) usedSentences.add(sentence); // Ara sí que 'usedSentences' i 'added' existeixen
  });

  console.log(`📊 Resultats trobats -> Dificultats: ${result.dificultats.length}, Adaptacions: ${result.adaptacions.length}`);

  return result;
}

module.exports = { analyzePI };