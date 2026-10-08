# Smashr 2026

Marcador de pádel en tiempo real, multitenant. **Mesa de Control** (organizador, con login) + **Pantalla de Score** (TV y público, sin login).

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + Realtime + Storage) · Vercel.

## Rutas
| Ruta | Qué es |
|---|---|
| `/login`, `/registro` | Ingreso y alta de organizadores |
| `/onboarding` | Primer paso: crear la organización (nombre + dirección pública) |
| `/panel` | Partidos en juego / programados / finalizados |
| `/panel/nuevo` | Nuevo partido: datos, parejas, formato |
| `/panel/partido/[id]` | Puntuación + escenas del tablero + vista previa |
| `/panel/sponsors`, `/panel/personalizacion` | Sponsors y look de los tableros |
| `/{org}/{evento}/{cancha}/tablero` | Tablero de una cancha (muestra el partido en juego y pasa solo al siguiente) |
| `/t/[id]` | Tablero de un partido puntual |
| `/{org}/hoy` | Resumen público del día: partidos en juego, terminados hoy y próximos |
| `/panel/usuarios` | Solo superusuarios: usuarios registrados, activar/desactivar, link de registro |

## Estructura
- `lib/scoring/engine.ts` — motor de reglas (puro, con tests en `engine.test.ts`).
- `lib/stage/scenes.ts` — las 7 escenas de la Pantalla de Score (1920×1080), portadas 1:1 del prototipo.
- `lib/data.ts` — lectura/escritura en Supabase, acciones de la mesa de control y suscripciones Realtime.
- `components/Stage.tsx` — monta y escala una escena; `TvBoard.tsx` — tablero público.
- `supabase/migrations/` — esquema, RLS, Realtime y Storage.
- `design/` — prototipo HTML de referencia y backlog.

## Local
```bash
cp .env.example .env.local
npm install
npm run dev     # http://localhost:3000
npm test        # tests del motor y de las escenas
```

## Deploy en Vercel
1. Vercel → **Add New → Project → Import** este repo (framework: Next.js, sin cambios).
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (la URL de Vercel o tu dominio).
3. Supabase → **Authentication → URL Configuration**: *Site URL* = la URL de Vercel; *Redirect URLs* agregar `https://TU-URL/auth/callback`.

## Seguridad (RLS)
Lectura pública de organizaciones, sponsors y partidos (los tableros son públicos). Escritura solo para miembros de la organización. Los eventos de puntos (historial para deshacer) solo los ven los miembros.
