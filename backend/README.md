# IChatTime — Backend

API de la red social IChatTime. NestJS + PostgreSQL + Socket.IO.

## Requisitos

- Node 20+
- Docker Desktop (para PostgreSQL)

## Setup rápido

```powershell
# 1) Desde la raíz del repo, levantar Postgres
docker compose up -d

# 2) En backend/, crear .env a partir de .env.example
copy .env.example .env

# 3) Instalar dependencias
npm install

# 4) Arrancar en modo dev (synchronize crea las tablas automáticamente)
npm run start:dev
```

API disponible en `http://localhost:4000/api`.
WebSocket namespace: `http://localhost:4000/realtime`.

## Módulos

- `auth` — register / login / refresh / logout (JWT access + refresh)
- `users` — `GET /users/me`, `GET /users/:username`, `GET /users/search?q=`
- `posts` — CRUD posts (texto + imagen), feed, por usuario, like/unlike
- `comments` — listar, crear, eliminar
- `follows` — follow/unfollow, stats, followers, following
- `notifications` — historial, unread-count, read-all + WebSocket `notification`

## Uploads

Las imágenes se guardan en `./uploads/` y se sirven en `/uploads/<file>`.
Máx 5MB, tipos: jpeg, png, webp, gif.

## Producción

- Cambia `synchronize` a `false` (se hace automáticamente con `NODE_ENV=production`).
- Usa migraciones:
  ```powershell
  npm run build
  npm run migration:generate
  npm run migration:run
  ```
- Genera secretos seguros: `openssl rand -hex 48` para `JWT_*_SECRET`.
- Restringe `CORS_ORIGINS` al dominio del frontend.

## Tests

```powershell
npm test
npm run test:e2e
```

## Probar rápido

```powershell
$body = '{\"username\":\"seba\",\"email\":\"seba@test.com\",\"password\":\"password123\",\"displayName\":\"Seba\"}'
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d $body
```
