# Development Conventions

Standard guidelines to maintain codebase consistency.

## General
- **Language:** Code comments and documentation in Catalan/English.
- **Naming:** CamelCase for variables/functions, PascalCase for components.

## Backend (Node.js)
- **Structure:** Modular routes, controllers, and services.
- **Validation:** Use Joi or similar for request payload validation.
- **Errors:** Standardized JSON error responses with HTTP status codes.

## Frontend (Vue 3)
- **SFC:** Use Single File Components with `<script setup>`.
- **Props:** Clearly defined types and defaults.
- **Styling:** Scoped CSS or Vuetify utility classes.

## Git
- **Branching:** `feature/`, `bugfix/`, `hotfix/` prefixes.
- **Commits:** Descriptive messages (e.g., `feat: add student search functionality`).
