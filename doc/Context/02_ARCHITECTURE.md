# System Architecture

The platform follows a distributed service model designed for scalability and security.

## High-Level Overview
- **Frontend:** Single Page Application (SPA) built with Vue 3 and Vite.
- **Backend:** REST API powered by Node.js and Express.
- **Database:** MongoDB for flexible storage of student data and document metadata.
- **Messaging:** RabbitMQ for handling asynchronous AI processing tasks.
- **Infrastructure:** Docker containers for consistent development and deployment.

## Key Components
- **AI Middleware:** An internal service that communicates with a local Ollama instance to process uploaded documents.
- **Secure Repository:** A protected layer where PIs are temporarily stored and anonymized.
- **WebSocket Server:** Manages real-time notifications for file processing status and system alerts.

## Infrastructure
- **CI/CD:** Automated testing and deployment via GitHub Actions.
- **Deployment:** Containerized deployment on a VPS.
