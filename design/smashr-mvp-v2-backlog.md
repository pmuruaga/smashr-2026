# Smashr v2 — MVP broadcast multitenant
**Análisis funcional, arquitectura y backlog por etapas** · Octubre 2026

Archivos que acompañan este documento:
- `prototipo-v2/` → **prototipo vigente**, separado en Mesa de Control y Pantalla de Score (ver §3.1). Abrir `index.html`.
- `smashr-pantallas.html` → primer prototipo (todas las escenas en una sola página). Queda como catálogo visual.
- `cursor-prompt-M1-pantallas.md` → primer prompt para que Cursor porte el motor y las pantallas a Next.js.

---

## 1. Objetivo del MVP

- **Qué es:** un marcador de pádel con estética de transmisión profesional (negro + acento dorado, tipografía condensada itálica, placas metalizadas), que cada organizador ve con su propia marca y sus sponsors desde el primer login.
- **Qué resuelve frente a la competencia:** las apps actuales (capturas de Pro Cup, Ligas APF, Golden Point) son funcionales pero visualmente rústicas, con layouts fijos y fondos pegados a mano. Smashr se diferencia por:
  - pantalla que “se arma sola” a partir de logo + fondo + color;
  - formatos de partido configurables de verdad (star point, super TB a 10/12, set único a 9, muerte súbita);
  - pantallas extra de transmisión (sponsor, ficha, resumen) que nadie ofrece en el segmento amateur.
- **Regla de oro:** el MVP tiene que hacer como mínimo lo que hoy hace smashr.com.ar (ver §2) antes de sumar cualquier cosa nueva.

## 2. Paridad con lo que ya existe (smashr.com.ar)

| Funcionalidad actual | Cómo queda en v2 | Etapa |
|---|---|---|
| Fondos personalizables con marca y sponsors | Upload de fondo + logo + color de acento por organizador, con oscurecimiento ajustable | M1 |
| Operación desde el navegador, sin instalar nada | Consola del operador web (tablet/PC), atajos de teclado | M1 |
| Pantalla de score con 2 banners comerciales abajo | Se mantiene, con rotación automática de N sponsors | M1 |
| Reglas configurables (games por set, super TB) | Motor de reglas genérico con plantillas (§5) | M1 |
| Planes: por partido / por torneo / mensual | Flag manual de plan por organizador en M1; cobro online en M4 | M1 / M4 |
| Formulario de contacto, FAQ, términos | Landing pública (sin cambios funcionales) | M1 |

## 3. Actores y permisos

- **Organizador (owner del tenant):** crea la cuenta con su email, carga marca, sponsors, torneos, jugadores; invita operadores. Es quien paga.
- **Operador / árbitro:** carga puntos desde la consola. Solo ve los partidos de su organización. Puede ser el mismo organizador.
- **Pantalla (display):** TV o PC conectada en el club. No inicia sesión: abre un link con token (`/d/[token]`) y muestra lo que el operador decida.
- **Espectador:** abre el link público o el QR desde el celular y sigue el partido en vivo.
- **Super admin Smashr:** alta/baja de organizaciones, planes, soporte.

### 3.1 Estructura de pantallas (igual que el Smashr actual)

**A. Pantalla de Score** (la TV junto a la cancha y el link para el público)
- URL pública por partido: `smashr.com.ar/{organizador}/{evento}/{cancha}/tablero`. No pide clave.
- Muestra la escena que elija la Mesa de Control y se actualiza sola en tiempo real.
- Tocar la pantalla la pone en pantalla completa; pide al dispositivo que no se apague.

**B. Mesa de Control** (backend con clave, menú superior)
- **Partidos** (home): lista de partidos *En juego*, *Programados* y *Finalizados* de la organización, con el resultado resumido, qué escena está al aire y botones *Controlar*, *Abrir tablero* y *Copiar link público*.
- **Nuevo partido**: datos (evento, cancha, instancia, categoría, horario), parejas (nombre, apellido, foto y datos de ficha opcionales) y formato (plantilla o reglas personalizadas). Muestra el link del tablero antes de crear. Se puede *guardar como programado* o *crear y pasar a puntuación*.
- **Puntuación** (por partido): tocar la pareja que gana el punto, deshacer, cambiar saque, estado (break/set/match point, star point, etc.), vista previa en vivo del tablero y botones de escena (§3.2).
- **Sponsors**: alta, imagen, orden, activo, dónde aparece (banner del marcador / pantalla completa) y segundos de rotación.
- **Personalización** (nuevo): logo, fondo, oscurecido, color principal, color secundario, tipografía del tablero (3 opciones) y mostrar o no fotos de los jugadores. Vista previa de todas las escenas.

**Varios partidos en simultáneo:** cada partido tiene su propio estado, su propio tablero y su propio link de control. Un operador en Cancha 1 con el celular, otro en Cancha 2 con una tablet y otro en otro club pueden trabajar a la vez; cada TV escucha solo su partido.

### 3.2 Escenas que la Mesa de Control manda a la TV

| Botón | Qué aparece en la TV | Cuándo usarlo |
|---|---|---|
| **Marcador** | Pantalla principal con 2 banners | Durante el juego |
| **Calentamiento** (3/5/7/10 min) | Cuenta regresiva grande, parejas VS y sponsor a pantalla completa rotando | Antes de empezar (reemplaza la pantalla actual de calentamiento) |
| **Pausa / cambio de lado** (60/90/120 s) | Sponsor grande + cuenta regresiva + barra de score con la secuencia de puntos | Cambios de lado, pausas médicas |
| **Cara a cara** | Historial entre las dos parejas | Mientras los jugadores no entran |
| **Resumen del set** | Puntos ganados, break points, racha máxima, games, duración, sponsor “presentado por” | Al cerrar un set |
| **Ficha pareja A / B** | Ficha de cada jugador | Presentación |
| **Próximo partido** | “A continuación” con el siguiente partido programado de esa cancha | Entre partidos |

- Los temporizadores se guardan como **hora de fin** (no como segundos restantes): todas las pantallas muestran el mismo tiempo aunque se conecten tarde.
- Botones *+1 min* y *Volver al marcador* mientras corre un temporizador.
- **Al anotar un punto, la TV vuelve sola al Marcador**: el operador no tiene que acordarse.

## 4. Arquitectura multitenant (desde el minuto cero)

- **Tenant = organización** (club, liga u organizador). Un usuario puede pertenecer a varias organizaciones con distinto rol (`memberships`).
- **Aislamiento por RLS:** toda tabla de negocio tiene `org_id`; las policies de Supabase verifican que el usuario sea miembro de esa org. Nada se filtra “a mano” en el frontend.
- **Archivos:** Supabase Storage, bucket `brand-assets` con ruta `orgs/{org_id}/logos|backgrounds|sponsors|players/…`. Policy de Storage por prefijo de org.
- **Rutas:**
  - `/app/[orgSlug]/…` → panel del organizador (protegido).
  - `/d/[displayToken]` → pantalla del club (pública con token, sin login).
  - `/m/[publicToken]` → seguimiento desde el celular (pública).
- **Tiempo real:** Supabase Realtime sobre `match_state` y `display_state`. El display escucha su canal y re-renderiza.
- **Motor de reglas compartido:** el mismo módulo TypeScript (`lib/scoring/engine.ts`) corre en la consola (respuesta instantánea) y en el servidor (validación). Está ya escrito y probado en el prototipo.
- **Eventos de punto (event sourcing liviano):** cada punto es una fila en `match_events`. El estado se recalcula con el motor. Ventajas: deshacer confiable, estadísticas (break points, rachas, duración por set) sin trabajo extra, auditoría ante reclamos.

### 4.1 Modelo de datos propuesto (reemplaza el esquema de PAB-21)

```sql
organizations (id, name, slug UNIQUE, plan text, plan_expires_at, created_at)
memberships   (org_id, user_id, role text CHECK (role IN ('owner','operator')), PRIMARY KEY (org_id,user_id))
brand_themes  (org_id PK, logo_path, background_path, accent_color, bg_dim int, font_preset, updated_at)
sponsors      (id, org_id, name, image_path, aspect text /*banner|fullscreen*/, link_url, active, sort_order, starts_at, ends_at)
courts        (id, org_id, name)
rule_presets  (id, org_id NULL /*NULL = plantilla del sistema*/, name, rules jsonb)
events        (id, org_id, name, category, kind text /*torneo|liga*/, starts_on, ends_on, brand_override jsonb)
players       (id, org_id, first_name, last_name, country, birth_date, side, hand, ranking, ranking_points, photo_path)
teams         (id, org_id, player1_id, player2_id)
matches       (id, org_id, event_id NULL, court_id NULL, round text, team1_id, team2_id,
               rules jsonb /*copia congelada de la plantilla al crear*/, status, scheduled_at, started_at, finished_at,
               public_token UNIQUE)
match_events  (id bigserial, match_id, org_id, seq int, type text /*point|serve_switch|undo|start|end*/, team smallint, created_at, created_by)
match_state   (match_id PK, org_id, state jsonb /*salida del motor*/, updated_at)      -- Realtime ON
displays      (id, org_id, name, token UNIQUE, court_id NULL)
display_state (display_id PK, org_id, screen text, match_id NULL, payload jsonb, updated_at) -- Realtime ON
```

- **Por qué `rules jsonb` congelado en el partido:** si el organizador edita la plantilla a mitad de torneo, los partidos en curso no cambian de reglas.
- **Por qué `display_state`:** el operador elige desde la consola qué muestra la TV (marcador, sponsor, ficha, resumen) como un director de transmisión.

## 5. Motor de reglas (configuración de cada partido)

Configuración (JSON guardado en `matches.rules`):

| Campo | Qué define | Valores |
|---|---|---|
| `setsToWin` | Sets para ganar el partido | 1 (set único), 2 (mejor de 3), 3 (mejor de 5) |
| `gamesPerSet` | Games para ganar un set (con diferencia de 2) | 4 a 12; típico 6, set largo 9 |
| `tiebreak` | Si hay tie-break en iguales | true / false (sin TB = se sigue hasta diferencia de 2) |
| `tiebreakAt` | En qué empate arranca el TB | 6 → 6-6; en set a 9 suele ser 8 |
| `tbPoints` | Puntos del tie-break normal | 7, 10 |
| `tbWinBy2` | Cierre del TB | true = diferencia de 2; false = “muere en” el número |
| `deuce` | Qué pasa en 40-40 | `advantage` (ventaja clásica), `golden` (punto de oro), `star` (Premier: dos ventajas y luego punto decisivo) |
| `decider` | Cómo se juega el set decisivo | `set` completo o `supertb` |
| `superTbPoints` | Puntos del super tie-break | 10, 12, u otro |

Plantillas incluidas en el prototipo:
- **Profesional · Star point:** mejor de 3, sets a 6, TB a 7, star point.
- **Amateur · Punto de oro + Super TB a 10:** el formato más común en ligas.
- **Clásico · Ventaja + TB a 7.**
- **Mejor de 3 · Super TB a 12.**
- **Set único a 9 games:** TB en 8-8.
- **Partido a un super tie-break a 10 (muerte súbita):** exhibiciones y definiciones rápidas.
- **Personalizado:** cualquier combinación; el organizador puede guardarla como plantilla propia.

Qué muestra la pantalla según el estado (calculado por el motor, no a mano):
- **Iguales · ventaja 1 de 2 / 2 de 2** y luego **STAR POINT** (modo star).
- **PUNTO DE ORO** (modo golden en 40-40).
- **TIE-BREAK / SUPER TIE-BREAK**, con la columna de set renombrada a “S. TB”.
- **BREAK POINT / SET POINT / MATCH POINT**, detectados simulando el próximo punto.
- Puntos del perdedor del tie-break como superíndice (7-6⁵), estilo televisión.

Casos ya verificados con el motor del prototipo: star point al tercer iguales, punto de oro, TB en 6-6, super TB al 1-1 en sets, TB en 8-8 en set a 9, muerte súbita a 10 (9-10 gana).

## 6. Pantallas (inspiradas en las transmisiones de Premier Padel)

| # | Pantalla | Para qué sirve | Datos que usa | Etapa |
|---|---|---|---|---|
| 1 | **Marcador** | Pantalla principal del club. Sets, puntos, saque, estado (star point, TB), reloj, tiempo de juego, 2 sponsors rotativos | match_state, brand, sponsors | M1 |
| 2 | **Sponsor + marcador** | Formato “highlight” de la tele: sponsor grande, logo del organizador, sponsor secundario y barra de score con la secuencia de puntos del game | match_state, sponsors | M1 |
| 3 | **Próximo partido** | Entre partidos: “A continuación”, 4 jugadores, VS, instancia, horario y cancha | matches programados, players | M1.5 (manual) / M3 (automático) |
| 4 | **Cuadro** | Camino a la final: cuartos, semis, final con resultados | events, matches | M3 |
| 5 | **Ficha de jugador** | Foto, país, ranking, edad, posición, mano, puntos | players | M2 |
| 6 | **Cara a cara** | Historial entre parejas y últimos dos enfrentamientos | matches finalizados | M2 |
| 7 | **Resumen de set** | Puntos ganados, break points, racha máxima, games, duración; con sponsor “presentado por” | match_events | M1.5 |

Notas de diseño:
- Todas se diseñan en un lienzo fijo 1920×1080 y se escalan a la pantalla. Así se ven idénticas en una TV, un proyector o OBS.
- El color de acento del organizador reemplaza al dorado en todas las placas, bordes y resaltados.
- El fondo subido se oscurece con un control deslizante para que el texto siempre se lea.
- Los sponsors se muestran con “contain + fondo desenfocado” de la misma imagen: cualquier proporción que suba el cliente se ve bien sin recortes.
- Pendiente para M1.5: **variante vertical** (TV en portrait, como el display del estadio) y **overlay para streaming** (fondo transparente para OBS/YouTube).
- Estilo propio: se toma la estética (paleta, placas, tipografía), no logos ni marcas de Premier Padel.

## 7. Etapas y backlog

Convención: se mantienen los IDs de Linear existentes (PAB-xx) donde aplican; lo nuevo va como **NEW-xx** hasta cargarlo en Linear.

### M0 · Fundaciones multitenant (ajusta PAB-6)
- **PAB-19** Proyecto Next.js + TS + Tailwind. *Sin cambios.*
- **PAB-20** Cliente Supabase (`@supabase/ssr`). *Sin cambios.*
- **PAB-21** Esquema de DB → **reemplazar** por el modelo de §4.1 (organizations, memberships, org_id en todo, match_events, display_state).
- **PAB-22** Auth email + magic link. *Agregar:* al primer login se crea la organización y la membresía owner (onboarding de 1 paso: nombre del club/liga).
- **PAB-23** Middleware. *Ajustar rutas:* protegido `/app/*`; públicas `/d/[token]`, `/m/[token]`, `/`, `/login`.
- **PAB-24** Deploy Vercel + CI. *Sin cambios.*
- **NEW-01** RLS por membresía en todas las tablas + tests de aislamiento (usuario de org A no ve nada de org B).
- **NEW-02** Storage `brand-assets` con policies por prefijo `orgs/{org_id}/`.
- **NEW-03** Selector de organización en el header (usuario con más de una org).

### M1 · Marcador broadcast + marca + sponsors (paridad + diferencial)
Épica **Motor de reglas** (absorbe la parte de reglas de PAB-7/8)
- **NEW-10** Portar `engine.ts` del prototipo + tests unitarios de todos los formatos de §5.
- **NEW-11** Plantillas del sistema + plantillas propias del organizador (CRUD).
- **NEW-12** Al crear partido: elegir plantilla o personalizar; se congela en `matches.rules`.

Épica **Consola del operador**
- **NEW-13** Botones grandes Pareja A / Pareja B, deshacer, cambiar saque, reiniciar con confirmación.
- **NEW-14** Atajos de teclado (1, 2, Z) y uso cómodo en tablet.
- **NEW-15** Registro de puntos en `match_events` + recálculo de `match_state` (server action) + respuesta optimista.
- **NEW-16** Botones de escena (§3.2) que escriben en `display_state`; vuelta automática al marcador al anotar.
- **NEW-17** Temporizadores de calentamiento y pausa por hora de fin, con +1 min y cancelar.
- **NEW-18** Home *Partidos*: listado en juego / programados / finalizados con resultado en vivo y escena al aire.
- **NEW-19** Nuevo partido: datos + parejas (foto y ficha opcionales) + formato; guardar programado o pasar a puntuación.

Épica **Pantallas M1**
- **NEW-20** Lienzo 1920×1080 escalable + modo pantalla completa + wake lock.
- **NEW-21** Pantalla 1 Marcador (con estado: star point, TB, break/set/match point, ganadores).
- **NEW-22** Escena Pausa / cambio de lado (sponsor + marcador + cuenta regresiva).
- **NEW-25** Escena Calentamiento (cuenta regresiva + VS + sponsor a pantalla completa).
- **NEW-26** Ruta pública `/{org}/{evento}/{cancha}/tablero`, resolviendo el partido activo de esa cancha.
- **NEW-23** Suscripción Realtime del display; reconexión automática si se corta el wifi.
- **NEW-24** Vista celular `/m/[token]` + QR imprimible (PAB existente de link público).

Épica **Personalización** (adelanta PAB-14 / M2.5)
- **NEW-30** Logo, fondo, oscurecido, color principal y secundario, tipografía (3 opciones), fotos de jugadores sí/no; vista previa de todas las escenas.
- **NEW-31** Override de marca por evento (un torneo con fondo propio).

Épica **Sponsors** (PAB-10/11)
- **NEW-35** CRUD de sponsors con imagen, orden, activo, dónde aparece (banner / pantalla completa), fechas de vigencia.
- **NEW-36** Rotación configurable (segundos) en marcador y pantalla sponsor.
- **NEW-37** Contador de impresiones por sponsor (base para el reporte comercial de M4).

Épica **Planes (manual)**
- **NEW-40** Campo plan (por partido / torneo / mensual) y vencimiento, gestionado por super admin. Bloqueo suave al vencer.

### M1.5 · Pantallas complementarias
- **NEW-50** Escena Resumen de set (datos de `match_events`).
- **NEW-51** Escena Próximo partido (toma el siguiente programado de la cancha).
- **NEW-54** Escenas Cara a cara y Ficha de pareja con datos cargados en el partido.
- **NEW-52** Variante vertical del marcador.
- **NEW-53** Overlay de streaming con fondo transparente (lower third).

### M2 · Jugadores y estadísticas (PAB-12, PAB-13)
- Base de jugadores por organización con foto, país, ranking, posición, mano.
- Pantalla 5 Ficha de jugador.
- Pantalla 6 Cara a cara calculada desde partidos finalizados.
- Estadísticas históricas por jugador/pareja.

### M3 · Torneos y ligas (PAB-15, PAB-16)
- Torneos con zonas y cuadro eliminatorio; ligas con fechas y tabla.
- Pantalla 4 Cuadro alimentada automáticamente.
- “Próximo partido” automático según la programación de canchas.

### M4 · Monetización (PAB-17, PAB-18)
- Cobro online (Mercado Pago) para los 3 planes.
- Plan gratuito con sponsors de Smashr en los espacios publicitarios.
- Reporte de impresiones para que el organizador se lo muestre a sus sponsors (argumento de venta).

## 8. Orden sugerido de trabajo con Cursor

1. M0 completo (fundaciones multitenant). Sin esto, todo lo demás se rehace.
2. NEW-10 motor + tests (es lógica pura, se porta del prototipo).
3. NEW-20/21 marcador leyendo un `match_state` fijo (sin Realtime) para validar el diseño en una TV real.
4. Consola + eventos + Realtime (NEW-13 a 16, 23).
5. Marca y sponsors (NEW-30, 35, 36).
6. Pantalla sponsor, vista celular, QR. → **Release MVP v2 en un club piloto.**

## 9. Preguntas abiertas para Pablo

- **Dominio por cliente:** ¿alcanza con `smashr.com.ar/d/token` o algún cliente va a pedir subdominio propio (`club.smashr.com.ar`)?
- **Operación offline:** si el club pierde internet, ¿el marcador debe seguir funcionando local y sincronizar después? Cambia bastante la arquitectura.
- **Saque:** ¿el operador carga quién saca primero y el sistema lo rota solo (como el prototipo), o se ignora el saque en amateur?
- **Un tablero por cancha o por partido:** el link `/{evento}/{cancha}/tablero` ¿debe pasar solo al siguiente partido de esa cancha cuando termina el actual? (el prototipo usa un link por partido).
- **Datos que hoy existen:** ¿hay clientes y partidos en la versión actual que haya que migrar?
- **Stats manuales (smashes, winners, errores no forzados):** las transmisiones las muestran, pero requieren un segundo operador. ¿Lo dejamos para una etapa posterior?
- **Linear:** no tengo conexión a Linear desde esta sesión. Cuando lo conectes, cargo las NEW-xx como issues.
