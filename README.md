<div align="center">
  <img src="doc/assets/banner.png" alt="Plataforma Intercentre Banner" width="100%">
  <br />
  <img src="doc/assets/logo.png" alt="Logo" width="120">
  <h1>Plataforma Intercentre de Traspàs d'Adaptacions Educatives amb IA</h1>
  <p><strong>Projecte Pilot Institucional per a la Continuïtat Pedagògica</strong></p>

  [![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
</div>

---

## 📝 Descripció General

Aquest projecte consisteix en el desenvolupament d’una **plataforma intercentre** destinada a facilitar el traspàs segur i automatitzat dels **Plans Individualitzats (PI)** i adaptacions educatives entre centres d’ESO i centres de Formació Professional (FP).

La solució aborda una problemàtica real del sistema educatiu actual: la manca d’interoperabilitat i continuïtat de la informació pedagògica quan un alumne canvia de centre. Mitjançant l’ús d’**Intel·ligència Artificial**, el sistema permet estandarditzar, resumir i presentar les adaptacions educatives de manera clara i útil per al professorat del centre receptor.

---

## 🚀 Funcionalitats Clau

- **📁 Gestió de Documents:** Pujada i processament de PI en formats heterogenis (PDF, Word, XML).
- **🤖 Motor d'IA Middleware:** Extracció intel·ligent d'adaptacions i generació de resums executius.
- **🛡️ Seguretat Avançada:** Anonimització temporal de dades i compliment estricte del **GDPR**.
- **📊 Dashboard per a Docents:** Visualització clara i concisa de les necessitats educatives de l'alumne.
- **🔄 Traspàs Automatitzat:** Detecció automàtica de paquets d'adaptacions en confirmar la matrícula.
- **📱 Notificacions i Real-time:** Comunicació en temps real mitjançant WebSockets.

---

## 🏗️ Arquitectura del Sistema

El sistema segueix un model **B2B (Centre a Centre)** amb un repositori segur intermedi i un motor d’IA com a middleware.

### Flux de Dades
1. **Centre d'Origen (ESO):** Puja la documentació i gestiona el consentiment.
2. **Motor d'IA:** Processa, anonimitza i estandarditza la informació en JSON.
3. **Centre de Destí (FP):** Rep la "fitxa executiva" un cop confirmada la matrícula.

![Esquema de Sistemes](doc/esquemes/Esquema%20de%20Sistemes.png)

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Vue 3 + Vite
- **UI Components:** Vuetify
- **State Management:** Pinia
- **Real-time:** Socket.io-client
- **Generació de PDF:** html2pdf.js

### Backend
- **Runtime:** Node.js (Express)
- **Base de Dades:** MongoDB (Mongoose)
- **IA:** OpenAI API (GPT-4 / GPT-3.5)
- **Cues de Treball:** RabbitMQ (amqplib)
- **Gestió de Fitxers:** Multer + Adm-zip
- **Seguretat:** Crypto, Express Rate Limit, reCAPTCHA v2

### Infraestructura & DevOps
- **Contenidors:** Docker & Docker Compose
- **CI/CD:** GitHub Actions
- **Servidor:** VPS (Amb accés SSH)

---

## ⚙️ Instal·lació i Configuració

### Requisits previs
- Node.js v18+
- Docker & Docker Compose
- MongoDB Atlas o Instància local

### Configuració Local

1. **Clonar el repositori:**
   ```bash
   git clone https://github.com/inspedralbes/tr2-reptes-tr2-g4.git
   cd tr2-reptes-tr2-g4
   ```

2. **Configurar variables d'entorn:**
   Crea un fitxer `.env` a `Incorporacio_PI/backend/` i `Incorporacio_PI/frontend/` basant-te en els exemples de la documentació.

3. **Executar amb Docker (Recomanat):**
   ```bash
   cd Incorporacio_PI
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Executar manualment per a desenvolupament:**
   - **Backend:**
     ```bash
     cd Incorporacio_PI/backend
     npm install
     npm run dev
     ```
   - **Frontend:**
     ```bash
     cd Incorporacio_PI/frontend
     npm install
     npm run dev
     ```

---

## 🔒 Seguretat i Privacitat

La plataforma ha estat dissenyada amb la privacitat des del disseny (*Privacy by Design*):
- **GDPR Compliance:** Compliment estricte de la normativa europea.
- **Logs Immutables:** Registre de tots els accessos a la informació sensible.
- **RBAC:** Control d'accés basat en rols (Docent, Tutor, Administrador).
- **IA Segura:** Ús d'instàncies privades per evitar la filtració de dades cap a models públics.

---

## 👥 Equip del Projecte

| Nom | Rol | GitHub |
| :--- | :--- | :--- |
| **Kim** | Desenvolupador | [@a24kimgalgal](https://github.com/a24kimgalgal) |
| **Pau** | Desenvolupador | [@PauGit2134](https://github.com/PauGit2134) |
| **Joel** | Desenvolupador | - |
| **Enrique** | Desenvolupador | [@enriquecayo](https://github.com/enriquecayo) |

---

## 🎓 Context Acadèmic

Projecte desenvolupat per alumnes de **2n curs de DAM (Desenvolupament d'Aplicacions Multiplataforma)** a l'Institut Pedralbes.

---

## 📄 Llicència

Projecte acadèmic. Ús exclusiu per a finalitats educatives i de demostració.

---

<div align="center">
  <sub>Desenvolupat amb ❤️ per l'Equip G4 - Institut Pedralbes</sub>
</div>
