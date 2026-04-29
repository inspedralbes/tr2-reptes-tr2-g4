# System Map

Overview of how the project files and services are structured.

```text
tr2-reptes-tr2-g4/
├── doc/                        # Documentation
│   ├── Context/                # Project Context (This directory)
│   ├── assets/                 # Images, icons, banners
│   └── esquemes/               # Diagrams and system flows
├── Incorporacio_PI/            # Main Application
│   ├── backend/                # Node.js Express API
│   │   ├── routes/             # API Endpoints
│   │   ├── controllers/        # Business Logic
│   │   ├── models/             # Mongoose Schemas
│   │   └── services/           # External API wrappers (AI, Email)
│   └── frontend/               # Vue.js 3 Application
│       ├── src/
│       │   ├── components/     # Reusable UI elements
│       │   ├── pages/          # Full page views
│       │   ├── stores/         # Pinia state management
│       │   └── assets/         # Static assets
└── .github/                    # Workflows and CI/CD
```
