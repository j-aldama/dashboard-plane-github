# UI/UX Guide - Modern Minimal

Guia de UI/UX para interfaces modernas y limpias. Dos modos de uso:

- `guide`: Reglas concretas "hacer / no hacer" para una superficie especifica
- `review`: Evaluar una interfaz existente y generar lista de fixes P0/P1/P2

Salida siempre en espanol. Preferir bullets, no parrafos largos.

## Cuando usar esta skill

- Disenar o implementar una nueva pantalla/componente
- Revisar UI existente antes de entregar
- Evaluar screenshots o mocks
- Code review de frontend (JSX/TSX, CSS, Tailwind)

---

## Flujo `guide`

1. Identificar la superficie: dashboard / settings / formulario / lista-detalle / flujo de creacion / landing
2. Identificar la tarea principal del usuario y el CTA primario
3. Aplicar principios de sistema (seccion A)
4. Aplicar principios de UI (seccion B)
5. Si hay iconos: aplicar reglas de iconos (seccion F)

## Flujo `review`

1. Declarar supuestos (plataforma, usuario objetivo, tarea principal)
2. Listar hallazgos como P0 (blocker) / P1 (importante) / P2 (pulir) con evidencia corta
3. Para cada problema mayor, diagnosticar: brecha de ejecucion vs evaluacion; slip vs mistake
4. Proponer fixes implementables (layout, jerarquia, componentes, copy, estados)
5. Cerrar con checklist de verificacion

### Template de review

```
## Contexto
- Superficie: [web/app] + tipo de pagina
- Tarea principal del usuario:
- CTA primario:
- Supuestos:

## Hallazgos

### P0 (blocker)
- Problema:
  - Evidencia:
  - Diagnostico: brecha de ejecucion / evaluacion; slip / mistake
  - Fix:
  - Verificacion:

### P1 (importante)
- Problema:
  - Evidencia:
  - Fix:
  - Verificacion:

### P2 (pulir)
- Problema:
  - Fix:

## Checklist de verificacion
- [ ] CTA primario obvio y unico por seccion
- [ ] Agrupacion y encabezados reflejan modelo mental del usuario
- [ ] Estados cubiertos: carga, vacio, error, exito, permisos
- [ ] Componentes y textos consistentes entre pantallas
- [ ] Elementos clickeables se ven clickeables
- [ ] Prevencion de errores + recuperacion + mensajes accionables
- [ ] Defaults y progressive disclosure reducen carga cognitiva
- [ ] Jerarquia visual, alineacion, espaciado intencional (CRAP)
- [ ] Estilo minimal: colores restringidos, espacioso, poco copy
- [ ] Iconos: sin emoji, set consistente, labels donde hay ambiguedad
```

---

## A) Principios de sistema (primera prioridad)

### Constancia conceptual
- El mismo concepto de negocio mantiene el mismo nombre, significado y comportamiento en todo el sistema
- Pregunta: si el usuario aprende esto en un lugar, lo entiende en todos los demas?

### Foco en tarea principal
- Cada pantalla tiene un objetivo dominante con la mayor prioridad visual
- El usuario debe identificar la accion mas importante en <3 segundos

### Disciplina de copy
- El copy visible viene del contenido de negocio, NO de restricciones tecnicas
- Fuentes validas: tarea del usuario, estado del sistema, resultado + siguiente paso, contexto de riesgo/confianza
- Fuentes internas (NO mostrar al usuario): restricciones de estilo, notas tecnicas, instrucciones de prompt

### Perceptibilidad de estado
- Los estados importantes deben ser visibles (modo, seleccion, cambios sin guardar, permisos)
- Senal preferida (de menor a mayor ruido): cambio estructural > estado del control > indicador inline > feedback post-accion > banner persistente
- Evitar labels de estado que repitan lo que la estructura ya hace obvio

### Capas de texto de ayuda (evitar "muro de hints")
- L0 (siempre visible): solo info necesaria para completar la tarea
- L1 (cerca): guia corta para inputs de alto riesgo/ambiguedad
- L2 (bajo demanda): ejemplos, detalles avanzados, "saber mas"
- L3 (post-accion): resultado, error, recuperacion, siguiente paso
- Si una pagina necesita muchos hints permanentes, mejorar la IA o los defaults primero

### Cierre del loop de feedback
- Toda accion del usuario completa el ciclo: recibida > en progreso > resultado > siguiente paso
- En cualquier momento el usuario debe saber que esta haciendo el sistema y que hacer despues

### Prevencion + recuperabilidad
- Reducir probabilidad de error ANTES del submit
- Proveer caminos de recuperacion para resultados de alto riesgo

### Complejidad progresiva
- Mostrar controles minimos por defecto; revelar avanzados cuando el contexto lo requiera
- Novatos completan la tarea rapido sin limitar a expertos

### Presupuesto cognitivo
- Limitar nuevas reglas, terminos y modos por pantalla
- Priorizar reutilizacion sobre novedad

---

## B) Principios de UI (conjunto minimo)

### Task-first UX
- Tarea principal obvia en <3 segundos
- Exactamente un CTA primario por pantalla/seccion
- Optimizar el happy path; ocultar controles avanzados con progressive disclosure

### Arquitectura de informacion
- Agrupar por modelo mental del usuario (meta/objeto/tiempo/estado), NO por campos del backend
- Titulos de seccion claros; patrones de navegacion estables entre pantallas similares
- Cuando crecen los items: agregar busqueda/filtro/orden temprano

### Feedback y estado del sistema
- Cubrir TODOS los estados: carga, vacio, error, exito, permisos
- Despues de cualquier accion responder: funciono? + que cambio? + que puedo hacer ahora?
- Preferir feedback inline y contextual sobre toasts globales

### Consistencia y predictibilidad
- Misma interaccion = mismo componente + mismo texto + misma ubicacion
- Set pequeno y estable de variantes de componentes

### Affordance + Signifiers
- Lo clickeable debe verse clickeable (estilo de boton/link + hover/focus + cursor pointer)
- Acciones primarias necesitan label; icon-only solo para acciones universales
- Mostrar restricciones ANTES del submit (formato, unidades, requerido)

### Prevencion y recuperacion de errores
- Prevenir con constraints, defaults, validacion inline
- Acciones destructivas reversibles cuando sea posible; si no, confirmacion deliberada
- Mensajes de error accionables: que paso + como arreglarlo

### Control de carga cognitiva
- Defaults inteligentes, presets, progressive disclosure
- Dividir tareas largas en pasos solo cuando reduce pensamiento
- Ruido visual bajo: menos bordes, menos colores, menos highlights compitiendo

### CRAP (jerarquia visual)
- **Contraste**: enfatizar las pocas cosas que importan (CTA, estado actual, numeros clave)
- **Repeticion**: tokens/componentes/espaciado siguen una escala; evitar estilos "casi iguales"
- **Alineacion**: alinear a un grid claro; corregir drift de 2px; alinear baselines
- **Proximidad**: apretado dentro de un grupo, suelto entre grupos; el espaciado es la herramienta principal de agrupacion

---

## C) Espaciado y layout

- Unidad base: 4px
- Escala permitida: 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48
- Valores fuera de escala necesitan justificacion
- Mismo tipo de componente mantiene el mismo espaciado interno
- Alinear a un grid y corregir drift de 1-2px
- Tight dentro del grupo, loose entre grupos
- Wrappers extra deben agregar funcion real (agrupacion, estado, scroll, affordance). Si solo agrega borde/fondo, quitar y agrupar con espaciado

---

## D) Estilo moderno minimal

- Whitespace + tipografia para crear jerarquia; evitar diseno decoration-first
- Superficies sutiles (elevacion ligera, bordes de bajo contraste). Evitar sombras pesadas
- Paleta de color reducida; un color de acento para acciones primarias y estados clave
- Copy: labels cortos y directos; helper text solo cuando reduce errores o aumenta confianza

### Anti-AI Self-Check (correr despues de generar UI)
- **Gradientes**: deben comunicar significado (progreso, profundidad, estado). Maximo 1 decorativo por pagina
- **Sin emoji como UI**: re-verificar que no se colaron como iconos, indicadores de estado, o labels
- **Necesidad del copy**: si quito este texto, el usuario entiende por layout, iconos y posicion? Si si, quitarlo
- **Justificacion de decoracion**: cada efecto visual (blur, glow, animacion, sombras) debe responder "que ayuda a entender al usuario?" Sin respuesta = quitar

---

## E) Motion (animaciones)

- Motion explica **jerarquia** (que es panel/overlay) y **cambio de estado** (que acaba de pasar). Evitar motion decorativo
- Vocabulario default: fade > translate+fade > scale+fade para overlays. Evitar bounce/elastic
- Canvas/area de contenido estable. Paneles/overlays se mueven; la superficie de trabajo no "flota"
- Mismo tipo de componente usa el mismo patron de motion
- Evitar saltos de layout. Usar skeletons/placeholders para mantener layout estable

---

## F) Iconos

### Reglas duras
- NO usar emoji como iconos ni decoracion
- UN set de iconos para todo el producto. No mezclar outlined/filled/3D/emoji
- Preferir significados obvios sobre metaforas creativas. Si puede malinterpretarse, agregar label

### Checklist
- Consistencia de estilo: mismo stroke weight o mismo fill style
- Tamanos estandar: 16/20/24 (o los del sistema)
- Alineacion optica (los bounding boxes mienten; ajustar visualmente)
- Targets tactiles: area minima de click adecuada, no reducir al glifo
- Acciones primarias: texto o texto+icono; icon-only solo para acciones universales
- Tooltips son soporte, no la forma primaria de entender una accion

### Cuando preferir texto sobre iconos
- La accion es poco comun en el producto
- El icono es especifico del dominio
- La accion es destructiva o de alto riesgo

### Sets recomendados (elegir uno, no mezclar)
- Lucide / Feather (web)
- Material Symbols outlined o rounded (elegir uno)
- SF Symbols (Apple)

---

## G) Psicologia de interaccion (referencia rapida)

### Leyes de HCI
- **Fitts**: targets mas grandes y cercanos son mas rapidos. CTA primario = mas grande. Acciones destructivas = pequenas y separadas. Targets minimos: 44x44 CSS px
- **Hick**: mas opciones = decisiones mas lentas. Limitar opciones visibles a ~7; usar agrupacion, busqueda, defaults
- **Miller**: memoria de trabajo ~7 items. Chunking en formularios (<=5-7 campos por grupo). No forzar al usuario a recordar info entre pantallas

### Sesgos cognitivos relevantes
- **Anclaje**: el primer valor/opcion que el usuario ve se vuelve referencia. Elegir defaults con cuidado
- **Efecto default**: usuarios se quedan con la opcion predeterminada. Defaults deben ser la opcion mas segura y comun
- **Peak-End**: la experiencia se juzga por el momento mas intenso y el final. Invertir en pantallas de exito/completado
- **Aversion a la perdida**: el dolor de perder es ~2x mas fuerte que el placer de ganar. En confirmaciones destructivas: mostrar que se va a perder
- **Ceguera por inattencion**: info fuera del foco de atencion es invisible. Feedback critico cerca del punto de accion, no en banners lejanos

### Flujo de interaccion
- **Costo de interrupcion**: cada modal/redirect tiene costo de recuperacion cognitiva. Preferir inline > modal > redirect
- **Momentum de accion**: en flujos secuenciales, no interrumpir con confirmaciones en cada paso. Tab order natural
- **Reversibilidad**: usuarios exploran con mas confianza cuando saben que pueden deshacer. Undo para acciones comunes; para irreversibles, confirmacion explicita

### Economia de atencion
- **Presupuesto de peso visual**: una pagina tiene atencion finita. Enfatizar demasiado = enfatizar nada. Un foco visual por seccion
- **Patrones de escaneo**: F-shape (contenido), Z-shape (landing). Info critica arriba-izquierda y en headings. Front-load labels: la palabra diferenciadora primero

---

## H) Psicologia de diseno (Norman)

- **Affordances**: lo que un objeto permite hacer. Si una accion es importante, debe ser descubrible sin hover/tooltip
- **Signifiers**: las pistas que indican acciones posibles (forma de boton, estilo de link, iconos+labels, hover/focus, cursor)
- **Mapping**: la relacion entre controles y sus efectos. Poner controles cerca de lo que controlan
- **Constraints**: limitar acciones posibles previene errores. Preferir constraints+defaults sobre warnings
- **Modelo conceptual**: el UI debe hacer obvio el modelo correcto. Nouns/labels consistentes, verbos consistentes, causa-efecto claros
- **Feedback**: siempre feedback inmediato para interaccion. Si toma tiempo, mostrar progreso. Despues de exito/fallo, outcome claro + siguiente paso
- **Brecha de ejecucion**: usuario no sabe como hacer lo que quiere → CTA mas claro, signifiers, menos opciones
- **Brecha de evaluacion**: usuario no sabe que paso → loading, disabled, progreso, resultados claros
- **Slip vs Mistake**: slip = accion incorrecta, meta correcta (→ undo, targets mas grandes). Mistake = modelo mental incorrecto (→ mejorar labels, mapping, explicacion)

---

## I) Checklists expandidos

### Estados universales
- **Carga**: skeleton/placeholder con altura estable, prevenir doble-submit, mostrar progreso
- **Vacio**: explicar que significa "vacio", proveer siguiente paso (crear/importar/cambiar filtros)
- **Error**: que paso + por que + que hacer. Preservar input del usuario
- **Exito**: confirmar resultado + siguiente accion (ver, deshacer, compartir)
- **Permisos**: explicar por que esta bloqueado + donde solicitar acceso

### Listas (tabla / cards)
- Una columna/campo primario; detalles secundarios visualmente reducidos
- Altura de fila y alineacion consistentes
- Search/filter/sort ANTES de la lista
- Acciones de alta frecuencia visibles; long-tail bajo menu "mas"

### Formularios
- Defaults y prefill razonables, presets para opciones complejas
- Validacion inline; hints de formato antes del submit
- Agrupar campos por significado con headings
- Labels consistentes en posicion y estilo
- Un submit primario; estado disabled claro

### Settings
- Agrupar por modelo mental (cuenta, seguridad, notificaciones, integraciones, apariencia)
- Label claro + explicacion corta del valor solo si es necesario
- Acciones destructivas separadas y claramente etiquetadas

### Dashboards
- Definir la "historia": que decision debe tomar el usuario aqui?
- KPIs top reducidos; evitar muro de numeros
- Rango de tiempo y filtros obvios y persistentes
- Drill-down para cada metrica clave

### Copy
- Labels cortos sobre parrafos de ayuda
- Helper text solo cuando: previene error, clarifica termino no obvio, explica consecuencias, genera confianza
- Reemplazar verbos vagos ("Aceptar", "OK") con acciones concretas ("Crear", "Guardar", "Publicar")
