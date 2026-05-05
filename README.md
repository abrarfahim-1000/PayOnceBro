# PayOnceBro

AI-assisted multi-role food delivery platform built with React, Express, Supabase, and Gemini.

## Overview

PayOnceBro supports four application roles:

- `user`: browse restaurants, add multi-restaurant carts, place and track orders.
- `rider`: manage active deliveries, route view, location/status updates.
- `restaurant_owner`: manage menu and orders, view/respond to reviews.
- `admin`: monitor platform analytics and system intelligence.

The project follows a backend MVC + frontend service-driven structure and was planned through sprint-based feature delivery documented in `Workflow.md`.

**Core requirement:** MVC architecture is mandatory for this project. All backend features must preserve strict `Model -> Service -> Controller -> Route` layering.

## Tech Stack

- **Frontend:** React (Vite), React Router, TailwindCSS, Sonner (shadcn toast)
- **Backend:** Node.js, Express, CORS, Helmet, Morgan
- **Database/Auth/Realtime:** Supabase (PostgreSQL + Auth + Realtime)
- **AI:** Google Gemini API

## Monorepo Structure

```text
PayOnceBro/
├─ backend/       # Express API, MVC layers, business services
├─ frontend/      # React app (Vite)
├─ supabase/      # Supabase-related artifacts (if present)
├─ .env           # Unified root runtime configuration
├─ .env.example   # Safe template
├─ Workflow.md    # Master workflow/specification
└─ package.json   # Workspace scripts
```

## Architecture

### MVC Is Mandatory

For this project, MVC is a hard requirement and part of the grading/evaluation criteria. Any new backend feature or refactor must respect the MVC boundaries below.

### Backend flow

`Route -> Controller -> Service -> Model -> Supabase`

- **Models:** raw data access only
- **Services:** business logic, computation, AI calls
- **Controllers:** request validation/orchestration/response
- **Middleware:** auth, role guard, centralized error handling

### MVC Boundary Rules (Enforced)

- Do not write database queries in controllers.
- Do not put orchestration/request-response logic in models.
- Do not bypass services for business rules or calculations.
- Keep routes thin: map endpoints to controller methods only.
- If a change breaks layering, refactor before merge.

### Frontend flow

`Page/Component -> frontend service -> API -> backend`

- Role-protected routes in `frontend/src/App.jsx`
- Global auth session handling in `frontend/src/context/AuthContext.jsx`
- Shared API client in `frontend/src/services/api.js`
- Global toast notifications routed through hooks/services (Sonner)

## Key Features

- Multi-role auth and role-based route guards
- Smart search and proximity-aware restaurant experiences
- Multi-restaurant cart with cluster-aware fee logic
- Delivery fee engine and ETA support
- End-to-end order lifecycle with status transitions
- Rider route and location tracking
- Restaurant menu/order/review management
- Rider and restaurant rating flows
- Admin analytics dashboard
- Gemini-powered capabilities (recommendations, combo/vibe/tagging paths)

## Current Route Surfaces

### Frontend app routes

- Public/Auth: `/`, `/auth`
- User: `/home`, `/restaurants/:id`, `/cart`, `/orders`, `/orders/:id`
- Rider: `/rider/dashboard`, `/rider/route`, `/rider/earnings`
- Restaurant: `/restaurant/dashboard`, `/restaurant/menu`, `/restaurant/reviews`
- Admin: `/admin/analytics`

### Backend API route prefixes

- `/api/auth`
- `/api/restaurants`
- `/api/public/restaurants`
- `/api/search`
- `/api/delivery`
- `/api/cluster`
- `/api/rider`
- `/api/orders`
- `/api/order-tracking`
- `/api/ratings`
- `/api/recommendations`
- `/api/ai`
- `/api/admin`
- Health check: `/api/health`

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended
- Supabase project (URL, JWT secret, anon/publishable key, service role key)
- Gemini API key

## Environment Setup

The project now uses a **single unified root env** file:

- Runtime file: `.env`
- Template file: `.env.example`

Create runtime config:

```bash
cp .env.example .env
```

Fill all required values in `.env`.

Notes:

- Frontend Vite vars must be prefixed with `VITE_`.
- Backend reads root `.env` directly from backend entry/config files.
- Frontend Vite is configured with `envDir: '..'` to read root env.

## Installation

From project root:

```bash
npm install
```

## Running Locally

### Run both apps (recommended)

```bash
npm run dev
```

This starts:

- frontend (Vite dev server)
- backend (Node watch mode)

### Run apps separately

```bash
npm run dev:frontend
npm run dev:backend
```

## Build

Frontend production build:

```bash
npm run build
```

Or workspace-specific:

```bash
npm run build -w frontend
```

## Workspace Scripts

Root `package.json`:

- `npm run install:all` -> install workspace deps
- `npm run dev` -> run frontend + backend concurrently
- `npm run dev:frontend` -> frontend only
- `npm run dev:backend` -> backend only
- `npm run build` -> frontend production build

Backend `package.json`:

- `npm run dev` -> `node --watch index.js`
- `npm run start` -> start backend
- `npm run test` -> Node test runner

Frontend `package.json`:

- `npm run dev` -> Vite dev
- `npm run build` -> Vite build
- `npm run lint` -> ESLint
- `npm run preview` -> preview built app

## Core Configuration Notes

- CORS allow-list is driven by `FRONTEND_URL` (comma-separated origins) in env.
- Localhost origins are accepted for local development.
- Backend has a demand analysis background job in `backend/app.js`.
- Sonner toaster is mounted globally in `frontend/src/App.jsx`.

## Status Lifecycle (Orders)

Expected status progression:

`pending -> accepted -> preparing -> pickup -> on_the_way -> delivered`

Also supports cancellation paths where applicable.

## Team Workflow Context

`Workflow.md` is the detailed source for:

- sprint planning and ownership model
- feature specs (F1-F20)
- integration touchpoints across domains
- API and architecture conventions

Use it as the primary implementation contract for cross-team changes.

## Recommended Development Practices

- Treat MVC compliance as a merge requirement for backend changes.
- Keep controllers thin; move logic into services.
- Keep direct DB access in models only.
- Reuse existing frontend service modules before adding new API wrappers.
- Keep role names canonical: `user`, `rider`, `restaurant_owner`, `admin`.
- Add safe fallbacks around AI-dependent paths.

## Troubleshooting

- **Frontend cannot hit backend:** verify `VITE_API_URL` or proxy and backend running on expected port.
- **CORS blocked:** add frontend origin to `FRONTEND_URL` env.
- **Auth/role access issues:** verify Supabase JWT config + canonical role values.
- **Env not picked up after changes:** restart dev servers.
- **Gemini errors:** verify `GEMINI_API_KEY` and network access.

## Security Notes

- Never commit real `.env` secrets.
- Keep service-role keys backend-only.
- Use `.env.example` for sharing required variables safely.

## License

See `LICENSE`.
