# AI Workflow

Details on how the AI processes student documentation.

## 1. Data Ingestion
Documents are uploaded via the Frontend. The Backend stores them temporarily and pushes a task to the RabbitMQ queue.

## 2. Text Extraction
The system extracts raw text from PDF/Word/XML. This text often contains sensitive information.

## 3. AI Processing (Local LLM)
- **Prompting:** Specialized prompts instruct the local model (e.g., Llama 3.1) to identify specific educational adaptations (methodological, evaluative, etc.).
- **Summarization:** The AI creates a concise "Fitxa Executiva" for teachers.
- **Anonymization:** Any personal identifiers found in the text are replaced or removed during this step to ensure GDPR compliance.

## 4. Output Generation
The result is a structured JSON object that is saved to MongoDB and pushed to the Frontend via WebSockets to notify the user that the "Fitxa" is ready.
