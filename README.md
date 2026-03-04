# Dashboard Ralph

Dashboard de productividad de equipo. Integra datos de **Plane** y **GitHub** para visualizar métricas de tareas, puntos, ciclos, commits y pull requests.

## Stack

- **Backend:** FastAPI (Python 3.12+) + SQLAlchemy async + Alembic
- **Frontend:** Next.js 14 + React + Tailwind CSS + TanStack Query
- **DB:** PostgreSQL 16
- **Cache:** Redis 7
- **Infra:** Docker Compose

## Setup rápido

```bash
# 1. Clonar y entrar al proyecto
git clone <url> && cd dashboardRalph

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus API keys de Plane y GitHub

# 3. Levantar todo con Docker
docker compose up -d --build

# 4. Acceder
# Frontend: http://localhost:3000
# API:      http://localhost:8080
```

## Variables de entorno requeridas

Ver `.env.example` para la lista completa. Las principales:

| Variable | Descripción |
|----------|-------------|
| `PLANE_API_TOKEN` | API token de Plane |
| `PLANE_WORKSPACE_SLUG` | Slug del workspace |
| `GITHUB_TOKEN` | Personal Access Token de GitHub |
| `GITHUB_ORG` | Organización de GitHub |
| `POSTGRES_PASSWORD` | Password de PostgreSQL |

## Desarrollo local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Tests
cd backend && pytest
cd frontend && npx vitest run
```

## Estructura del proyecto

```
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routers/         # FastAPI endpoints
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic
│   ├── alembic/             # DB migrations
│   └── tests/
├── frontend/
│   ├── app/(dashboard)/     # Next.js pages
│   ├── components/          # React components
│   ├── hooks/               # TanStack Query hooks
│   └── contexts/            # React contexts
└── docker-compose.yml
```

## Features

- Métricas de Plane: tareas, puntos, ciclos, bugs, bloqueos cliente
- Métricas de GitHub: commits, PRs, líneas agregadas/eliminadas
- Comparativa entre miembros del equipo
- Gestión de proyectos (cliente / soporte / interno)
- Filtros por proyecto, usuario, fecha y ciclo
- Sincronización manual y automática programable
- Vista por persona con detalle individual
