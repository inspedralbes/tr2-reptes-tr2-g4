# transversals
Esquema mínim de carpetes pels projectes transversals

És obligatori seguir aquesta estructura tot i que la podeu ampliar.

## Atenció
Un cop comenceu heu de canviar aquesta explicació amb la corresponent al vostre projecte (utilitzant markdown)

# Aquest fitxer ha de contenir com a mínim:
 * Nom dels integrants
 * Nom del projecte
 * Petita descripció
 * Adreça del gestor de tasques (taiga, jira, trello...)
 * Adreça del prototip gràfic del projecte (Penpot, figma, moqups...)
 * URL de producció (quan la tingueu)
 * Estat: (explicació d'en quin punt està)

---

# Plataforma Intercentre de Traspàs d'Adaptacions Educatives amb IA
**Projecte Pilot – Opció B (Institucional)**

## Descripció General
Aquest projecte consisteix en el desenvolupament d’una **plataforma intercentre** destinada a facilitar el traspàs segur i automatitzat dels **Plans Individualitzats (PI)** i adaptacions educatives entre centres d’ESO i centres de Formació Professional (FP).

La solució aborda una problemàtica real del sistema educatiu actual: la manca d’interoperabilitat i continuïtat de la informació pedagògica quan un alumne canvia de centre. Mitjançant l’ús d’**Intel·ligència Artificial**, el sistema permet estandarditzar, resumir i presentar les adaptacions educatives de manera clara i útil per al professorat del centre receptor.

Aquest projecte es desenvolupa com una **aplicació pilot**, amb finalitats acadèmiques, però amb una orientació clara a un possible entorn institucional real.

---

## Objectiu del Projecte
Crear un **“túnel digital segur” entre centres educatius** que permeti:
- Automatitzar el traspàs d’adaptacions educatives.
- Evitar la pèrdua d’informació rellevant durant el canvi de centre.
- Reduir el temps de detecció de necessitats educatives específiques.
- Garantir el compliment de la normativa de seguretat i protecció de dades (GDPR).

---

## Context i Problema
Actualment:
- Els sistemes de gestió dels centres no estan connectats.
- Els PI sovint queden arxivats en PDFs, documents escanejats o en paper.
- El centre de destí rep l’alumne sense informació prèvia útil.

Conseqüència:
> El tutor del centre de FP ha de començar “a cegues”, perdent setmanes fins a detectar necessitats que ja estaven identificades.

---

## Descripció de la Solució

### Arquitectura General
Model **B2B (Centre a Centre)** amb un **repositori segur intermedi** i un motor d’IA com a middleware.

### A. Mòdul Centre d’Origen (ESO) – *Emissor*
- Identificació unívoca de l’alumne (ID ALU / RALC).
- Pujada de PI (batch o individual).
- Interfície ràpida (drag & drop).
- Gestió del consentiment digital de la família.

### B. Motor d’Intel·ligència Artificial – *Middleware*
- Lectura i processament de documents heterogenis (PDF, Word, XML).
- Anonimització temporal de dades personals.
- Extracció i resum de les adaptacions educatives rellevants.
- Generació d’una estructura estandarditzada (JSON).

### C. Mòdul Centre de Destí (FP) – *Receptor*
- Detecció automàtica de paquets d’adaptacions en confirmar la matrícula.
- Dashboard per al tutor amb una **fitxa executiva clara i concisa**.
- Eliminació de la necessitat de revisar documents extensos.

---

## Seguretat i Requeriments Tècnics
- Compliment estricte del **GDPR**.
- Registre d’accessos (logs) immutables.
- Control d’accés basat en rols (professor, tutor, centre).
- Dades processades en entorns d’IA **locals o privats** (ex. Azure OpenAI privat a Europa).
- Desbloqueig de la informació vinculat a la confirmació de la matrícula.

---

## Lliurables del Projecte
- Diagrama de flux de dades segur.
- Mockup del panell de control per a docents.
- Prova de concepte del motor d’IA:
  - Conversió d’un PI desestructurat en una llista d’adaptacions estructurades (JSON).

---

## Context Acadèmic
Aquest projecte està desenvolupat per alumnes de **2n curs del Cicle Formatiu de Grau Superior en Desenvolupament d’Aplicacions Multiplataforma (DAM)** com a projecte pilot amb orientació realista i institucional.

---

## Equip del Projecte
- **Kim** – [GitHub](https://github.com/a24kimgalgal)
- **Paul**
- **Joel**
- **Enrique** – [GitHub](https://github.com/enriquecayo)

---

## Estat del Projecte
🟡 En fase de definició, disseny i desenvolupament inicial (Proof of Concept).

---

## Llicència
Projecte acadèmic. Ús exclusiu per a finalitats educatives i de demostració.

---
