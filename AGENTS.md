# Agent Directives: Sterling EventOps MVP

## Tech Stack Rules

- [cite_start]Framework: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui [cite: 16]
- Backend: Firebase v10+ (Auth, Firestore with Offline Persistence, Storage)

## Core Architectural Guardrails

1. Multi-Tenancy: Every single query, document mutation, and storage upload MUST explicitly check and include a valid `workspaceId`. Cross-tenant data leaks are a critical failure.
2. Immutable Audit Trail: Any movement action (CHECKOUT, RETURN, DAMAGE) must generate a non-deletable document inside the `movement_logs` collection.
3. [cite_start]Performance Thresholds: Image processing and QR routing matching states must resolve in under 0.8 seconds to handle fast-paced field operations[cite: 52, 149].
