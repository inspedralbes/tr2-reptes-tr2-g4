# Documentació del Projecte

Aquest document recull la informació tècnica i funcional del projecte. Aquí trobareu explicats els objectius, l'arquitectura, el disseny i les instruccions per al desenvolupament i desplegament.

> **Nota:** Les imatges es troben a la carpeta `esquemes/`.

---

## 1. Objectius

El propòsit principal d'aquesta aplicació és [Descriu aquí breument què fa l'app].

### Casos d'ús
A continuació es mostren les funcionalitats principals que ofereix el sistema als diferents tipus d'usuaris:

![Diagrama de casos d'ús](esquemes/Diagrama%20de%20casos%20d'ús.png)

---

## 2. Arquitectura bàsica

L'arquitectura del sistema es basa en la interconnexió entre el client (Frontend), el servidor (Backend) i la base de dades.

### Esquema de Sistemes
Visió general de com es comuniquen els diferents mòduls:

![Esquema de Sistemes](esquemes/Esquema%20de%20Sistemes.png)

### Tecnologies utilitzades
*   **Backend:** [NodeJS / Laravel / SpringBoot...]
*   **Frontend:** [Vue.js / React...]
*   **Base de Dades:** [MySQL / MongoDB...]
*   **Altres:** [Docker, Axios, etc.]

### Gestió d'Estat (Frontend)
Per a la gestió de l'estat global de l'aplicació s'utilitza **Pinia**. A continuació es detalla l'estructura dels *stores*:

![Diagrama Pinia Version 2](esquemes/DiagramaPiniaVersion2.png)

---

## 3. Disseny i Flux d'Usuari

### Flux de l'Usuari (User Flow)
Aquest diagrama representa el camí que segueix l'usuari a través de l'aplicació per completar les tasques principals:

![Diagrama de flux d'usuari](esquemes/Diagrama%20de%20flux%20d'usuari.png)

### Esquemes de Pantalla (Wireframes)
Esbossos de la disposició dels elements a les pantalles principals:

**Pantalla General:**
![Esquema de pantalla](esquemes/Esquema%20de%20pantalla.png)

**Pantalla PI (Projecte Integrat / Pantalla Inicial):**
![Esquema Pantalla PI](esquemes/Esquema%20Pantalla%20PI.png)

---

## 4. Entorn de desenvolupament

Passos per aixecar el projecte en local:

1.  Clonar el repositori:
    ```bash
    git clone https://github.com/inspedralbes/tr2-reptes-tr2-g4.git
    ```
2.  Instal·lar dependències del Backend:
    ```bash
    cd backend
    npm install
    # o composer install
    ```
3.  Instal·lar dependències del Frontend:
    ```bash
    cd frontend
    npm install
    ```
4.  Configurar variables d'entorn (`.env`).
5.  Executar el projecte.

---

## 5. Desplegament a producció

Explicació de com es puja l'aplicació al servidor de producció (AWS, Vercel, VPS propi, etc.):

*   Pas 1...
*   Pas 2...

---

## 6. API Backend

<<<<<<< HEAD
Llistat d'endpoints disponibles.
=======
Llistat d'endpoints disponibles. 
>>>>>>> cf2e30a1246549b806208ca779b785b7ec56aa18

> _Opcional: Veure documentació Swagger a `/api/docs`_

### Exemple d'Endpoint: `GET /api/exemple`
*   **Descripció:** Retorna un llistat de...
*   **Exemple de petició:**
    ```json
    {
      "id": 1
    }
    ```
*   **Codis de resposta:**
    *   `200 OK`: Èxit.
    *   `404 Not Found`: No trobat.
*   **Exemple de resposta (JSON):**
    ```json
    {
      "status": "success",
      "data": []
    }
    ```

---

## 7. Aplicació Android / Altres elements

<<<<<<< HEAD
- Unity

---
