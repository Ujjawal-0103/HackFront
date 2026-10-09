# ADR-002: Frontend and Backend Framework Selection

- **Identifier:** ADR-002
- **Title:** Next.js (React/TypeScript) and NestJS (Node/TypeScript) Selection
- **Status:** Accepted (Provisional)
- **Date:** 2026-10-09

## Context

The team has direct production experience in TypeScript, React, Next.js, and NestJS. The application requires a responsive, accessible frontend (supporting default light mode and persistent dark mode) and a structured, modular backend capable of handling background jobs, API rate limiting, and database interactions.

## Options Considered

1. **Full-Stack Next.js (App Router Only):** Running API routes and SSR within Next.js.
2. **Next.js Frontend + NestJS Backend:** Decoupled frontend application communicating with a dedicated NestJS backend service.
3. **Vite + React SPA + Express:** Lightweight SPA with minimal Express server.

## Decision Criteria

- Team familiarity and velocity.
- Robustness of backend architecture for enterprise features (dependency injection, validation pipes, BullMQ queues, Swagger/OpenAPI generation).
- Accessibility and responsive rendering on the frontend.

## Decision & Consequences

Select Next.js (App Router, TypeScript) for the web client and NestJS (TypeScript) for the backend API service.

- **Consequences:** NestJS provides modular architectural boundaries for `IngestionModule`, `RetrievalModule`, `AssessmentModule`, and `ReportModule`. Next.js provides excellent developer experience and SSR for fast initial loads.

## Trade-offs

- Two server runtimes to manage in production compared to a single monolithic app.

## Security Implications

- Cross-Origin Resource Sharing (CORS) must be strictly configured between the Next.js frontend and NestJS API.
- All backend routes must validate DTOs with `class-validator`.

## Revisit Conditions

- If operational deployment overhead proves too heavy for the MVP, backend can be temporarily consolidated into Next.js Route Handlers.
