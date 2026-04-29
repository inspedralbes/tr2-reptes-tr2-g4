# Architecture Decisions (ADR)

This document records the key technical decisions made during the project.

## 1. AI Model Selection
- **Decision:** Use Local AI via Ollama (Llama 3.1:8b).
- **Rationale:** Privacy and data sovereignty are critical for student information. Running models locally ensures that sensitive pedagogical data never leaves the institutional infrastructure.

## 2. State Management
- **Decision:** Use Pinia for the Vue frontend.
- **Rationale:** Lighter and more intuitive than Vuex, perfectly suited for the composition API.

## 3. Asynchronous Processing
- **Decision:** Implement RabbitMQ for document parsing.
- **Rationale:** Parsing large PDFs and calling AI APIs can be time-consuming; a queue prevents blocking the main API thread.

## 4. CSS Strategy
- **Decision:** Vuetify for UI components.
- **Rationale:** Speeds up the development of a professional-looking dashboard with pre-built accessible components.
