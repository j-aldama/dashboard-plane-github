# Plan de Implementación — Sync Progress Window

**Proyecto**: dashboardRalph
**Branch**: `feature/sync-progress-window`
**PRD**: `ralph/prd.json` (7 stories, 28 story points)
**Fecha**: 2026-02-26

---

## Resumen Ejecutivo

Transformar el flujo actual de sincronización (POST /api/sync → respuesta JSON única) en un flujo con feedback en tiempo real usando Server-Sent Events (SSE). El usuario verá un modal con progreso paso a paso al hacer click en "Sincronizar", con indicadores visuales por cada fase: limpiar caché, obtener métricas de Plane, obtener proyectos, obtener ciclos, y obtener métricas de GitHub.

---

## Análisis del Código Existente

### Backend — Estado actual

**`backend/app/routers/sync.py`**: Endpoint `POST /api/sync` que escanea Redis con patrones `plane:*` y `github:*`, elimina todas las claves encontradas (paginación cursor-based, count=200), y retorna `{"deleted_keys": N, "message": "..."}`.

**Servicios disponibles** (3-tier: Redis → API → PostgreSQL):
- `PlaneService.get_team_metrics()` → TeamMetricsResponse
- `PlaneService.get_projects()` → ProjectsResponse
- `PlaneService.get_cycles()` → CyclesResponse
- `GitHubService.get_team_metrics(period_start, period_end)` → TeamGitHubMetricsResponse

**Instanciación de servicios**: Los routers `plane.py` y `github.py` usan factory functions con `Depends()` que crean instancias con Redis y settings. Para el generador SSE se instanciarán en el handler y se pasarán al generador (StreamingResponse no soporta Depends dentro del generador).

**`backend/app/main.py`**: Registra routers con `app.include_router(sync.router)`. CORS configurado via `settings.allowed_origins_list`.

**`backend/app/config.py`**: Pydantic Settings con `CACHE_TTL=300`, `REDIS_URL`, credenciales de Plane y GitHub.

### Frontend — Estado actual

**`frontend/components/FreshnessIndicator.tsx`**: Componente con dos botones:
1. **Actualizar** (refresh): `queryClient.invalidateQueries()` — solo invalida caché React Query
2. **Sincronizar** (sync): `api.post("/api/sync", {})` → luego `invalidateQueries()` — limpia Redis y refresca

El botón Sincronizar tiene estados `isSyncing` local, icono CloudSyncIcon con `animate-spin`, y `disabled` durante sync.

**`frontend/lib/api.ts`**: Base URL `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`. Wrapper tipado con `api.get<T>()` y `api.post<T>()`.

**`frontend/lib/queryClient.ts`**: staleTime 4 min, retry 2, refetchOnWindowFocus false.

**`frontend/components/icons.tsx`**: SVGs existentes incluyendo RefreshIcon, CloudSyncIcon, y otros.

**Hooks**: Patrón consistente con React Query `useQuery`, query keys como `["plane", "team-metrics"]`, staleTime 4 min, todos usan `api.get<T>()`.

---

## Grafo de Dependencias

```
SYNC-001 (backend SSE)  ──→  SYNC-006 (error handling robusto)
         │
         ├──→  SYNC-003 (hook SSE)  ──→  SYNC-004 (integración)
         │                                      │
SYNC-002 (modal component)  ──────────→  SYNC-004
         │                                      │
         └──→  SYNC-005 (UX/labels)      SYNC-007 (tests)
```

---

## Estrategia de Ejecución Consolidada

SYNC-005 y SYNC-006 no son pasos independientes — son mejoras que se implementan inline con sus stories base. El plan real tiene 4 fases:

| Fase | Stories | SP | Estrategia |
|------|---------|-----|-----------|
| 1 | SYNC-001 + SYNC-006 | 8 | Backend SSE completo con error handling desde el inicio |
| 2 | SYNC-002 + SYNC-003 + SYNC-005 | 12 | Modal + hook + UX en paralelo (frontend puro) |
| 3 | SYNC-004 | 3 | Integración — conectar todo en FreshnessIndicator |
| 4 | SYNC-007 | 5 | Tests backend + frontend |

---

## Fase 1 — Backend: Endpoint SSE con error handling (SYNC-001 + SYNC-006)

**Archivo a modificar**: `backend/app/routers/sync.py`
**SP**: 8 | **Prioridad**: 1

### 1.1 Imports a agregar

```python
import asyncio
import json
import logging
from datetime import date, timedelta

from starlette.responses import StreamingResponse

from app.services.plane_service import PlaneService
from app.services.github_service import GitHubService
from app.config import get_settings
from app.redis_client import get_redis  # o la función que obtiene la instancia Redis
```

### 1.2 Constantes y configuración

```python
logger = logging.getLogger(__name__)
STEP_TIMEOUT = 30  # segundos por paso
```

### 1.3 Definición de los 5 pasos

```python
SYNC_STEPS = [
    {"id": "clear_cache", "message_start": "Limpiando caché...", "progress": 10},
    {"id": "fetch_plane_metrics", "message_start": "Obteniendo métricas del equipo...", "progress": 30},
    {"id": "fetch_plane_projects", "message_start": "Obteniendo proyectos...", "progress": 50},
    {"id": "fetch_plane_cycles", "message_start": "Obteniendo ciclos...", "progress": 70},
    {"id": "fetch_github_metrics", "message_start": "Obteniendo métricas de GitHub...", "progress": 90},
]
```

### 1.4 Endpoint `POST /api/sync/stream`

```python
@router.post("/api/sync/stream")
async def sync_stream():
    # Instanciar servicios aquí (no en el generador) porque Depends no funciona en generators
    settings = get_settings()
    redis = await get_redis()  # obtener instancia del pool
    plane_service = PlaneService(redis=redis, settings=settings)
    github_service = GitHubService(redis=redis, settings=settings)

    return StreamingResponse(
        _sync_generator(redis, plane_service, github_service),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
```

**Nota**: Revisar exactamente cómo `plane.py` y `github.py` instancian los servicios (funciones factory `_get_service`) y replicar el mismo patrón. El servicio necesita `redis` y `settings` como argumentos del constructor.

### 1.5 Generador async `_sync_generator()`

```python
async def _sync_generator(redis, plane_service, github_service):
    successful = 0
    failed = 0

    step_functions = {
        "clear_cache": lambda: _clear_cache_step(redis),
        "fetch_plane_metrics": lambda: asyncio.wait_for(
            plane_service.get_team_metrics(), timeout=STEP_TIMEOUT
        ),
        "fetch_plane_projects": lambda: asyncio.wait_for(
            plane_service.get_projects(), timeout=STEP_TIMEOUT
        ),
        "fetch_plane_cycles": lambda: asyncio.wait_for(
            plane_service.get_cycles(), timeout=STEP_TIMEOUT
        ),
        "fetch_github_metrics": lambda: asyncio.wait_for(
            _fetch_github(github_service), timeout=STEP_TIMEOUT
        ),
    }

    try:
        for step in SYNC_STEPS:
            step_id = step["id"]

            # Emitir: paso iniciando
            yield _sse_event({
                "step": step_id,
                "status": "in_progress",
                "message": step["message_start"],
                "progress": step["progress"],
            })

            try:
                await step_functions[step_id]()
                successful += 1

                yield _sse_event({
                    "step": step_id,
                    "status": "completed",
                    "message": f"Completado",
                    "progress": step["progress"],
                })

            except asyncio.TimeoutError:
                failed += 1
                logger.error(f"Timeout en paso {step_id} ({STEP_TIMEOUT}s)", exc_info=True)
                yield _sse_event({
                    "step": step_id,
                    "status": "error",
                    "message": f"Tiempo de espera agotado ({STEP_TIMEOUT}s)",
                    "progress": step["progress"],
                })

            except Exception as e:
                failed += 1
                logger.error(f"Error en paso {step_id}: {e}", exc_info=True)
                yield _sse_event({
                    "step": step_id,
                    "status": "error",
                    "message": str(e),
                    "progress": step["progress"],
                })

        # Evento final de resumen
        yield _sse_event({
            "type": "complete",
            "successful": successful,
            "failed": failed,
            "total": len(SYNC_STEPS),
        })

    except Exception as e:
        logger.error(f"Error inesperado en sync stream: {e}", exc_info=True)
        yield _sse_event({
            "type": "complete",
            "successful": successful,
            "failed": failed + 1,
            "total": len(SYNC_STEPS),
            "error": str(e),
        })
```

### 1.6 Funciones auxiliares

```python
def _sse_event(data: dict) -> str:
    """Formatea un diccionario como evento SSE."""
    return f"data: {json.dumps(data)}\n\n"


async def _clear_cache_step(redis):
    """Limpia claves plane:* y github:* de Redis (misma lógica del endpoint original)."""
    deleted = 0
    for pattern in ["plane:*", "github:*"]:
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=200)
            if keys:
                await redis.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
    return deleted


async def _fetch_github(github_service):
    """Wrapper para GitHub con fechas default (últimos 30 días)."""
    to_date = date.today()
    from_date = to_date - timedelta(days=30)
    return await github_service.get_team_metrics(from_date, to_date)
```

### 1.7 Mantener endpoint original intacto

El `POST /api/sync` existente no se modifica. La lógica de limpieza de caché se extrae a `_clear_cache_step()` y se puede reutilizar en ambos endpoints si se desea, pero el endpoint original queda como está para no romper nada.

### 1.8 Consideraciones técnicas

- **Buffering**: El header `X-Accel-Buffering: no` previene que nginx buffere el stream. `Cache-Control: no-cache` para proxies intermedios.
- **CORS**: Verificar que el middleware CORS de FastAPI permita `text/event-stream`. Si hay problemas, agregar `Access-Control-Allow-Headers` explícitamente.
- **Event loop**: Insertar `await asyncio.sleep(0)` entre yields si hay problemas de buffering (normalmente no es necesario con FastAPI/uvicorn).
- **Servicios**: Las llamadas a `get_team_metrics()`, `get_projects()`, `get_cycles()` tras limpiar caché forzarán fetch fresco de las APIs externas porque las claves Redis ya no existen.

---

## Fase 2 — Frontend: Modal + Hook + UX (SYNC-002 + SYNC-003 + SYNC-005)

### 2A — Hook useSyncProgress (SYNC-003 + SYNC-005)

**Archivo nuevo**: `frontend/hooks/useSyncProgress.ts`
**SP**: 7

#### Tipos

```typescript
export interface SyncStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message?: string;
  progress: number;
}

export interface UseSyncProgressReturn {
  steps: SyncStep[];
  isSyncing: boolean;
  overallProgress: number;
  error: string | null;
  startSync: () => void;
}
```

#### Constantes de pasos con labels en español (SYNC-005)

```typescript
const INITIAL_STEPS: SyncStep[] = [
  { id: "clear_cache", label: "Limpiando datos en caché", status: "pending", progress: 0 },
  { id: "fetch_plane_metrics", label: "Obteniendo métricas del equipo desde Plane", status: "pending", progress: 0 },
  { id: "fetch_plane_projects", label: "Obteniendo proyectos desde Plane", status: "pending", progress: 0 },
  { id: "fetch_plane_cycles", label: "Obteniendo ciclos de sprint desde Plane", status: "pending", progress: 0 },
  { id: "fetch_github_metrics", label: "Obteniendo métricas de código desde GitHub", status: "pending", progress: 0 },
];
```

#### Mensajes de error amigables (SYNC-005)

```typescript
const FRIENDLY_ERRORS: Record<string, string> = {
  clear_cache: "No se pudo limpiar el caché. Los datos anteriores siguen disponibles.",
  fetch_plane_metrics: "No se pudieron obtener las métricas de Plane. Se usarán los datos anteriores.",
  fetch_plane_projects: "No se pudieron obtener los proyectos de Plane. Se usarán los datos anteriores.",
  fetch_plane_cycles: "No se pudieron obtener los ciclos de Plane. Se usarán los datos anteriores.",
  fetch_github_metrics: "No se pudieron obtener las métricas de GitHub. Se usarán los datos anteriores.",
};
```

#### Implementación del hook

1. **Estado**: `useState` para `steps`, `isSyncing`, `overallProgress`, `error`
2. **AbortController ref**: Para cancelar el fetch si el componente se desmonta
3. **`startSync()` con `useCallback`**:
   - Reset estado a initial
   - `fetch(baseUrl + "/api/sync/stream", { method: "POST", signal })`
   - Usar `response.body.getReader()` + `TextDecoder` para leer el stream
   - Parsear líneas `data: {...}\n\n` del buffer
   - Para cada evento: actualizar el paso correspondiente en `steps`
   - Para evento `type: "complete"`: `setIsSyncing(false)` + `queryClient.invalidateQueries()`
   - Mapear mensajes de error del backend a `FRIENDLY_ERRORS`
4. **Cleanup**: `useEffect` return que aborta el controller
5. **Error de red**: Marcar pasos pendientes/in_progress como error con "Conexión perdida con el servidor"
6. **Acceso a queryClient**: via `useQueryClient()` de `@tanstack/react-query`

#### Por qué fetch + ReadableStream en vez de EventSource

`EventSource` solo soporta GET. Nuestro endpoint es POST. `fetch` + `ReadableStream.getReader()` da control completo.

#### Parseo del buffer SSE

```typescript
// Acumular chunks en buffer, splitear por "\n\n"
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n\n");
buffer = lines.pop() || ""; // último elemento puede ser parcial

for (const line of lines) {
  if (!line.startsWith("data: ")) continue;
  const event = JSON.parse(line.slice(6));
  // procesar evento...
}
```

---

### 2B — Componente SyncProgressModal (SYNC-002 + SYNC-005)

**Archivo nuevo**: `frontend/components/SyncProgressModal.tsx`
**SP**: 7

#### Props

```typescript
interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: SyncStep[];
  overallProgress: number;
  isSyncing: boolean;
}
```

#### Estructura visual

```
┌──────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░  45%     │  ← Barra de progreso (bg-blue-500)
│                                          │
│  🔄 Sincronizando datos...               │  ← Título dinámico
│                                          │
│  ✅  Limpiando datos en caché            │  ← completed (check verde, scale-in)
│  ⟳   Obteniendo métricas del equipo...  │  ← in_progress (spinner animate-spin)
│  ○   Obteniendo proyectos desde Plane    │  ← pending (círculo gris)
│  ○   Obteniendo ciclos de sprint...      │  ← pending
│  ○   Obteniendo métricas de GitHub       │  ← pending
│                                          │
│               [Cerrar]                   │  ← Solo visible al completar
└──────────────────────────────────────────┘
```

#### Implementación detallada

1. **Renderizado condicional**: Si `!isOpen`, retornar `null`

2. **Backdrop**:
   ```
   fixed inset-0 bg-black/50 z-50 flex items-center justify-center
   ```
   - `onClick`: solo `onClose()` si `!isSyncing`

3. **Modal card**:
   ```
   bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4
   ```
   - `onClick={(e) => e.stopPropagation()}` para prevenir cierre al click dentro

4. **Barra de progreso**:
   ```tsx
   <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
     <div
       className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
       style={{ width: `${overallProgress}%` }}
     />
   </div>
   ```

5. **Título dinámico**:
   - `isSyncing` → "Sincronizando datos..."
   - `!isSyncing` y sin errores → "Sincronización completada"
   - `!isSyncing` y todos error → "No se pudo completar la sincronización. Verifica tu conexión e intenta nuevamente."
   - `!isSyncing` y errores parciales → "Sincronización completada con errores"

6. **Lista de pasos** — cada paso es un `div` con `transition-all duration-300`:

   **Icono por estado** (componente interno `StepIcon`):
   - `pending`: `<div className="w-5 h-5 rounded-full border-2 border-slate-300" />`
   - `in_progress`: SVG spinner con `animate-spin` (24x24, color blue-500)
   - `completed`: SVG check-circle con `text-green-500` y `transition-transform duration-300 scale-100` (empieza `scale-0`)
   - `error`: SVG x-circle con `text-red-500`

   **Texto**:
   - Label: `text-sm font-medium text-slate-700`
   - Mensaje de error (si `status === "error"`): `text-xs text-red-400 mt-1`

7. **Botón Cerrar**:
   ```tsx
   {!isSyncing && (
     <button
       onClick={onClose}
       className="mt-6 w-full bg-slate-800 text-white rounded-lg px-6 py-2.5
                  hover:bg-slate-700 transition-colors font-medium"
     >
       Cerrar
     </button>
   )}
   ```

8. **Responsive**: `max-w-md` + `mx-4` asegura funcionalidad desde 768px

#### Iconos necesarios

Revisar `frontend/components/icons.tsx` para ver qué existe. Crear solo los que falten:
- `SpinnerIcon`: SVG circular con `animate-spin` (posiblemente ya exista algo reutilizable)
- `CheckCircleIcon`: Check dentro de círculo (si no existe)
- `XCircleIcon`: X dentro de círculo (si no existe)

Alternativa: usar SVGs inline en el componente StepIcon para evitar cambios en icons.tsx.

---

## Fase 3 — Integración con FreshnessIndicator (SYNC-004)

**Archivo a modificar**: `frontend/components/FreshnessIndicator.tsx`
**SP**: 3 | **Prioridad**: 2 | **Depende de**: Fase 2

### Cambios paso a paso

1. **Agregar imports**:
   ```typescript
   import { SyncProgressModal } from "./SyncProgressModal";
   import { useSyncProgress } from "../hooks/useSyncProgress";
   ```

2. **Reemplazar estado local de sync**:

   **Eliminar**:
   - `const [isSyncing, setIsSyncing] = useState(false);`
   - La función `handleSync` actual (que hace `api.post("/api/sync")` + `invalidateQueries`)

   **Agregar**:
   ```typescript
   const { steps, isSyncing, overallProgress, startSync } = useSyncProgress();
   const [isModalOpen, setIsModalOpen] = useState(false);
   ```

3. **Nueva función handleSync**:
   ```typescript
   const handleSync = () => {
     setIsModalOpen(true);
     startSync();
   };
   ```

4. **Handler de cierre del modal**:
   ```typescript
   const handleCloseModal = () => {
     if (!isSyncing) {
       setIsModalOpen(false);
     }
   };
   ```

5. **Renderizar SyncProgressModal** al final del JSX del componente:
   ```tsx
   <SyncProgressModal
     isOpen={isModalOpen}
     onClose={handleCloseModal}
     steps={steps}
     overallProgress={overallProgress}
     isSyncing={isSyncing}
   />
   ```

6. **Verificar que NO se toca**:
   - El botón "Actualizar" (refresh) y su `handleRefresh()`
   - La lógica de frescura (timestamps, colores verde/amarillo/rojo)
   - El indicador de estado de conexión

7. **Verificar que SÍ funciona**:
   - El `disabled={isSyncing}` del botón Sincronizar (ahora viene del hook)
   - La animación de rotación del `CloudSyncIcon` condicionada a `isSyncing`

---

## Fase 4 — Tests (SYNC-007)

**SP**: 5 | **Prioridad**: 4 | **Depende de**: Fases 1-3

### 4A — Tests Backend

**Archivo nuevo**: `backend/tests/test_sync_stream.py`

**Test 1: SSE content type**
```python
async def test_sync_stream_returns_sse(client):
    response = await client.post("/api/sync/stream")
    assert "text/event-stream" in response.headers["content-type"]
```

**Test 2: Emite eventos para los 5 pasos**
- Mock de PlaneService y GitHubService (AsyncMock que retornan datos vacíos)
- Mock de Redis (scan retorna cursor=0, keys=[])
- Leer el stream completo, parsear eventos SSE
- Verificar: 5 pasos × 2 eventos (in_progress + completed) = 10 eventos + 1 complete = 11 total
- Verificar orden de step ids

**Test 3: Error parcial no aborta**
- Mock de `PlaneService.get_team_metrics` que lanza `Exception("API error")`
- Otros servicios retornan OK
- Verificar: `fetch_plane_metrics` emite `status: "error"`, los demás emiten `status: "completed"`
- Evento complete: `successful: 4, failed: 1`

**Test 4: Endpoint original POST /api/sync intacto**
```python
async def test_original_sync_still_works(client):
    response = await client.post("/api/sync")
    assert response.status_code == 200
    assert "deleted_keys" in response.json()
```

**Herramientas**: pytest-asyncio, httpx.AsyncClient, unittest.mock.AsyncMock, fakeredis

### 4B — Tests Frontend

**Archivo nuevo**: `frontend/__tests__/useSyncProgress.test.ts`

**Test 1: Estado inicial**
- Renderizar hook con `renderHook`
- Verificar: 5 steps en `pending`, `isSyncing: false`, `overallProgress: 0`

**Test 2: Parseo de eventos SSE**
- Mock global de `fetch` que retorna un ReadableStream con eventos SSE simulados:
  ```
  data: {"step":"clear_cache","status":"in_progress","message":"...","progress":10}\n\n
  data: {"step":"clear_cache","status":"completed","message":"...","progress":10}\n\n
  ... (todos los pasos)
  data: {"type":"complete","successful":5,"failed":0,"total":5}\n\n
  ```
- Llamar `startSync()`
- Verificar que los steps se actualizan progresivamente
- Verificar que al final `isSyncing: false` y `overallProgress: 100`

**Test 3: Error de conexión marca pasos como error**
- Mock de `fetch` que rechaza con `TypeError("Failed to fetch")`
- Verificar que pasos pendientes/in_progress se marcan como error

---

**Archivo nuevo**: `frontend/__tests__/SyncProgressModal.test.tsx`

**Test 4: Renderizado de estados**
- Props con steps en distintos estados (1 completed, 1 in_progress, 3 pending)
- Verificar: icono check visible, spinner visible, círculos grises visibles
- Verificar: barra de progreso con width correcto

**Test 5: Botón Cerrar**
- Con `isSyncing: true`: botón no renderizado
- Con `isSyncing: false`: botón visible, click llama `onClose`

**Test 6: FreshnessIndicator integración**
- Renderizar FreshnessIndicator
- Simular click en botón Sincronizar
- Verificar que el modal aparece (buscando texto "Sincronizando datos...")

**Herramientas**: vitest (o jest según configuración existente), @testing-library/react, @testing-library/user-event

---

## Archivos Afectados — Resumen

| Archivo | Acción | Phase |
|---------|--------|-------|
| `backend/app/routers/sync.py` | Modificar (agregar endpoint SSE) | 1 |
| `frontend/hooks/useSyncProgress.ts` | Crear | 2 |
| `frontend/components/SyncProgressModal.tsx` | Crear | 2 |
| `frontend/components/icons.tsx` | Modificar (agregar iconos si faltan) | 2 |
| `frontend/components/FreshnessIndicator.tsx` | Modificar (integrar modal + hook) | 3 |
| `backend/tests/test_sync_stream.py` | Crear | 4 |
| `frontend/__tests__/SyncProgressModal.test.tsx` | Crear | 4 |
| `frontend/__tests__/useSyncProgress.test.ts` | Crear | 4 |

**Archivos que NO se modifican**: `backend/app/main.py`, `backend/app/routers/__init__.py` (el router sync ya está registrado), `frontend/lib/api.ts`, `frontend/lib/queryClient.ts`.

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Proxy/nginx bufferea SSE | Modal no actualiza en tiempo real | Headers `X-Accel-Buffering: no`, `Cache-Control: no-cache` |
| Timeout de servicios > 30s | Paso marcado como error | Timeout configurable, continuar con siguientes pasos |
| CORS bloquea streaming | fetch falla | CORS de FastAPI ya está configurado; verificar que `text/event-stream` funciona |
| Componente se desmonta durante sync | Memory leak | AbortController + cleanup en useEffect |
| Redis no disponible | clear_cache falla | Capturar error, continuar con siguientes pasos |
| GitHub rate limit durante sync | fetch_github_metrics falla | Error capturado, paso marcado como error, datos anteriores disponibles |

---

## Criterios de Done

- [ ] `POST /api/sync/stream` retorna SSE con los 5 pasos en orden
- [ ] Cada paso emite evento `in_progress` y luego `completed` o `error`
- [ ] Error en un paso no aborta los siguientes
- [ ] Timeout de 30s por paso
- [ ] `POST /api/sync` original sigue funcionando sin cambios
- [ ] Modal muestra progreso en tiempo real con barra y estados visuales
- [ ] Labels en español, mensajes de error amigables
- [ ] Modal no se cierra durante sync, botón Cerrar aparece al terminar
- [ ] Dashboard se refresca automáticamente al completar (invalidateQueries)
- [ ] Botón Sincronizar disabled durante sync, icono rotando
- [ ] Botón Actualizar no se ve afectado
- [ ] Tests backend pasan (4+ tests)
- [ ] Tests frontend pasan (5+ tests)
- [ ] No hay regresiones en funcionalidad existente
