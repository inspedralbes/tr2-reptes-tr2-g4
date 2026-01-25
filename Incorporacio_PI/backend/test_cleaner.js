
const fs = require('fs');

// Aquesta és la lògica exacta que he posat a aiService.js
function cleanJSON(fullText) {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            console.log("⚠️ Detectat JSON. Netejant...");
            const jsonStr = jsonMatch[0];
            const json = JSON.parse(jsonStr);
            let md = "";

            // Funció recursiva
            const extractText = (val) => {
                if (!val) return "";
                if (Array.isArray(val)) return val.map(extractText).join("\n");
                if (typeof val === 'string') {
                    val = val.trim();
                    // Detecta JSON dins d'string (el problema de la nina russa)
                    if ((val.startsWith('{') || val.startsWith('[')) && val.length > 2) {
                        try {
                            const innerC = JSON.parse(val);
                            return extractText(innerC);
                        } catch (e) {
                            if (val.includes('":"')) return val;
                            return val.replace(/^["'{}\[\]]+|["'{}\[\]]+$/g, '');
                        }
                    }
                    return textClean(val);
                }
                if (typeof val === 'object') {
                    let res = "";
                    for (const [k, v] of Object.entries(val)) {
                        if (['name', 'parameters', 'type'].includes(k)) {
                            res += extractText(v) + "\n";
                        } else {
                            const content = extractText(v);
                            if (content.length > 20) res += `\n**${k.toUpperCase()}**: ${content}`;
                            else res += `${content} `;
                        }
                    }
                    return res;
                }
                return String(val);
            };

            // Petit helper per treure caràcters lletjos
            const textClean = (t) => t.replace(/['"]/g, '').trim();

            const map = {
                'perfil': "## PERFIL DE L'ALUMNE",
                'perfil_alumne': "## PERFIL DE L'ALUMNE",
                'dificultats': "## PUNTS FORTS I FEBLES",
                'diagnostic': "## PUNTS FORTS I FEBLES",
                'orientacio': "## ORIENTACIONS A L'AULA",
                'recomanacions': "## ORIENTACIONS A L'AULA",
                'adaptacions': "## ADAPTACIONS CURRICULARS",
                'materies': "## ADAPTACIONS CURRICULARS",
                'avaluacio': "## CRITERIS D'AVALUACIÓ"
            };

            for (const [key, val] of Object.entries(json)) {
                // Busquem el títol corresponent (o usem la clau en majúscules)
                let header = map[key.toLowerCase()];
                if (!header) {
                    if (key === 'name' || key === 'parameters') continue;
                    header = `## ${key.toUpperCase()}`;
                }

                // Aquí està la màgia: extreu de forma recursiva
                const content = extractText(val).trim();

                if (content.length > 5) {
                    if (header) md += `\n\n${header}\n`;
                    md += content.split('\n').map(line => line.trim()).filter(l => l).map(l => `- ${l}`).join('\n') + "\n";
                }
            }
            return md;
        } catch (e) {
            return "ERROR: " + e.message;
        }
    }
    return fullText;
}

// EL TEXT "DOLENT" QUE HA PASSAT L'USUARI
const badInput = `
{"perfil": ["{\\"name\\": \\"Pla individualitzat\\", \\"parameters\\": {\\"nom_i_cognoms\\": \\"Nom i cognoms\\", \\"data_de_naixement\\": \\"12-02-2006\\", \\"curs_academific\\": \\"2020-2021\\", \\"estudis\\": \\"1r d’ESO, 2n d’ESO, 3r d’ESO, 4t d’ESO, 1r de batxillerat, 2n de batxillerat\\", \\"cursos_anteriors\\": \\"Sí\\", \\"ha_seguit_pla_individualitzat\\": \\"X\\", \\"dades_professinals\\": \\"Nom i cognoms del director/a xxx, Nom i cognoms del coordinador/a del pla xxx, Membres que han participat en l’elaboració del pla individualitzat (PI) xxx,yyy, Copèrnic, 84 08006 Barcelona telèfon: 93 200 49 13 fax: 93 414 04 34 institutmontserrat@xtec.cat www.institutmontserrat.cat\\", \\"altres_professinals\\": \\"EAP, Motiu xxx Informe NESE: EAP Retard Greu de l’Aprenentatge -xxxxx (06/06/2018) Informe de necessitats educatives específiques derivades de situacions socials desfavorides Certificat dels serveis de valoració i orientació per a persones amb discapacitat (CAD) Decisió del centre educatiu Trastorn d’aprenentatge Observacions/ Justificació xxx presents un baix nivell de rendiment escolar presenta dificultat per entendre moltes de les consignes orals que es donen a l’aula es mostra inquieta, moguda, dispersa, amb manca d’atenció i poc motivada pels aprenentatges té dificultats en la comprensió oral, l’expressió escrita i la comprensió lectora presenta una grafia amb poc control i una organització de la feina escrita poc polida i endreçada en la valoració cognitiva que va fer una psicòloga de consulta privada el 2014 s’observa una intel·ligència preservada però amb mancances a nivell de memòria de treball i velocitat de processament també hi ha factors familiars i emocionals de les seves vivències del passat (nena adoptada) que poden estar interferint en el seu desenvolupament personal, emocional i en conseqüència en la base dels aprenentatges en àmbit matemàtic ha ting\\"],\\"dificultats":[],\\"justificacio":[],\\"adaptacions":[],\\"avaluacio":[],\\"recomanacions":[]}.
`;

console.log("--- INPUT DOLE ---");
console.log(badInput);
console.log("\n--- RESULTAT NETEJA ---");
console.log(cleanJSON(badInput));
