# IChatTime

Una red social moderna inspirada en Instagram, construida con **NestJS** (backend) y **Next.js** (frontend). Incluye publicaciones, historias, mensajería en tiempo real, videos cortos (flashes), sistema de amigos y notificaciones.

---

## Características Principales

### Autenticación y Seguridad
- **Registro de usuarios** con validación de datos
- **Inicio de sesión** con JWT (access + refresh tokens)
- **Cierre de sesión** con invalidación de tokens
- **Recuperación de contraseña** vía email (Resend)
- **Cambio de contraseña** desde configuración
- **Rate limiting** en endpoints sensibles (login, registro, recuperación)

### Gestión de Perfiles
- **Perfil personalizado**: nombre, biografía, ubicación, sitio web
- **Avatar personalizable** con carga de imágenes
- **Nombre de usuario único** (@username)
- **Búsqueda de usuarios** por nombre o username
- **Visibilidad de perfiles** públicos

### Publicaciones (Posts)
- **Crear publicaciones** con texto e imágenes/videos (hasta 10 archivos)
- **Feed personalizado** basado en usuarios seguidos
- **Feed público** para explorar contenido
- **Me gusta** en publicaciones
- **Guardar publicaciones** en favoritos
- **Eliminar** publicaciones propias
- **Filtros** en perfiles: solo texto, solo con multimedia

### Comentarios
- **Comentarios anidados** (respuestas a comentarios)
- **Multimedia en comentarios** (hasta 5 archivos)
- **Eliminar** comentarios propios
- **Listado paginado** de comentarios

### Historias (Stories)
- **Crear historias** con imágenes o videos (24h)
- **Feed de historias** de usuarios seguidos
- **Marcar como vista** al visualizar
- **Me gusta** en historias
- **Ver quién vio** tu historia
- **Responder historias** vía mensaje directo
- **Eliminar** historias propias

### Flashes (Videos Cortos)
- **Subir videos cortos** formato vertical (similar a Reels/TikTok)
- **Feed de flashes** de usuarios seguidos
- **Feed aleatorio** para descubrir contenido
- **Reproducción automática** e interfaz optimizada
- **Me gusta** en flashes
- **Comentarios** con soporte multimedia
- **Eliminar** flashes propios

### Seguidores y Amistad
- **Seguir/Dejar de seguir** usuarios
- **Estadísticas**: seguidores, seguidos, posts
- **Listado de seguidores** y seguidos
- **Solicitudes de amistad**:
  - Enviar/cancelar solicitud
  - Aceptar/rechazar solicitudes entrantes
  - Estado de amistad con cualquier usuario
- **Lista de amigos** con indicador de conexión (online/offline)
- **Eliminar amigos**

### Mensajería (Chat)
- **Chat en tiempo real** con Socket.IO
- **Conversaciones privadas** entre usuarios
- **Mensajes multimedia**: imágenes y videos
- **Indicador de mensajes no leídos**
- **Marcar como leído** al abrir conversación
- **Eliminar mensajes**:
  - "Eliminar para mí" (solo para ti)
  - "Eliminar para todos" (borrado completo con notificación en tiempo real)
- **Respuesta a historias** integrada en chat
- **Estado de conexión** de amigos

### Notificaciones
- **Notificaciones en tiempo real** via Socket.IO
- **Tipos de notificaciones**:
  - Me gusta en tu publicación
  - Comentario en tu publicación
  - Nuevo seguidor
  - Solicitud de amistad
  - Aceptación de amistad
  - Mensaje nuevo
  - Me gusta en tu historia
  - Alguien vio tu historia
- **Contador de no leídas**
- **Marcar todas como leídas**
- **Eliminar notificaciones** (una o todas)

### Explorar y Búsqueda
- **Búsqueda de usuarios** con historial reciente (localStorage)
- **Publicaciones en tendencia**
- **Búsqueda por hashtags/tags**
- **Explorar flashes** aleatorios
- **Panel de búsqueda deslizable** desde la barra lateral

### Configuración y Privacidad
- **Editar perfil**: nombre, biografía, ubicación, sitio web
- **Cambiar contraseña**
- **Actualizar avatar**

---

## Tecnologías Utilizadas

### Backend
| Tecnología | Uso |
|------------|-----|
| **NestJS** | Framework Node.js modular |
| **TypeORM** | ORM para PostgreSQL |
| **PostgreSQL** | Base de datos relacional |
| **Socket.IO** | Comunicación en tiempo real (chat, notificaciones, online status) |
| **JWT** | Autenticación con tokens |
| **bcrypt** | Hash de contraseñas |
| **AWS S3** | Almacenamiento de archivos multimedia |
| **Sharp** | Procesamiento de imágenes |
| **FFmpeg** | Procesamiento de videos |
| **Resend** | Envío de emails |
| **Helmet** | Seguridad HTTP headers |
| **Compression** | Compresión de respuestas |
| **Throttler** | Rate limiting |

### Frontend
| Tecnología | Uso |
|------------|-----|
| **Next.js 14** | Framework React con App Router |
| **React 18** | Biblioteca UI |
| **TypeScript** | Tipado estático |
| **Tailwind CSS** | Estilos utilitarios |
| **Zustand** | Gestión de estado global |
| **Socket.IO Client** | Conexión en tiempo real |
| **Axios** | Cliente HTTP |
| **Framer Motion** | Animaciones |
| **date-fns** | Formateo de fechas |
| **Lucide React** | Iconos |
| **react-hot-toast** | Notificaciones toast |

### Infraestructura
| Tecnología | Uso |
|------------|-----|
| **Docker Compose** | PostgreSQL containerizado |
| **Git** | Control de versiones |

---

## Arquitectura del Backend

### Módulos Principales
```
src/modules/
├── auth/           # Autenticación y JWT
├── users/          # Gestión de usuarios y perfiles
├── posts/          # Publicaciones
├── comments/       # Comentarios en posts
├── likes/          # Sistema de me gusta
├── favorites/      # Guardar publicaciones
├── follows/        # Seguir usuarios
├── friend-requests/# Solicitudes de amistad
├── stories/        # Historias temporales
├── flashes/        # Videos cortos
├── messages/       # Chat y mensajería
├── notifications/  # Notificaciones en tiempo real
├── explore/        # Explorar y trending
├── upload/         # Subida de archivos a S3
└── mail/           # Envío de emails
```

### Características Técnicas
- **Paginación cursor-based** para feeds escalables
- **Guards de autenticación**: JWT obligatorio y opcional
- **Interceptores** para subida de archivos (Multer)
- **Decoradores personalizados** (@CurrentUser)
- **Event emitters** para desacoplar notificaciones
- **WebSocket gateways** para mensajes y notificaciones
- **Soft delete** en mensajes (para mí vs para todos)
- **Validación** con class-validator
- **Transformación** con class-transformer

---

## Estructura del Frontend

### App Router (Next.js 14)
```
src/app/
├── (auth)/         # Grupo: páginas de autenticación
│   ├── login/
│   └── register/
├── (main)/         # Grupo: aplicación principal
│   ├── feed/       # Feed de publicaciones
│   ├── create/     # Crear publicación
│   ├── post/[id]/  # Detalle de publicación
│   ├── profile/    # Perfiles de usuarios
│   ├── search/     # Búsqueda
│   ├── explore/    # Explorar contenido
│   ├── flashes/    # Feed de videos cortos
│   ├── messages/   # Chat y conversaciones
│   ├── notifications/ # Centro de notificaciones
│   └── settings/   # Configuración
└── stories/        # Visualizador de historias
```

### Componentes Reutilizables
- `Sidebar` - Navegación principal con notificaciones/chat
- `SearchPanel` - Búsqueda deslizable con historial
- `Avatar` - Componente de avatar con fallback
- `PostCard` - Tarjeta de publicación con acciones
- `FlashPlayer` - Reproductor de videos cortos
- `StoryViewer` - Visualizador de historias
- `MessageThread` - Conversación de chat
- `NotificationBell` - Campana con contador en tiempo real

---

## Requisitos Previos

- Node.js 18+
- Docker y Docker Compose
- Cuenta AWS (para S3)
- Cuenta Resend (para emails)

---

## Instalación y Configuración

### 1. Clonar el Repositorio
```bash
git clone https://github.com/JKDx97/IChatTime.git
cd IChatTime
```

### 2. Iniciar la Base de Datos
```bash
docker-compose up -d
```
PostgreSQL estará disponible en `localhost:5433`

### 3. Configurar Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales
npm install
npm run start:dev
```

Variables de entorno backend:
```env
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=5433
DB_USER=ichattime
DB_PASS=ichattime_pass
DB_NAME=ichattime
DATABASE_URL=
DB_SSL=false
JWT_ACCESS_SECRET=tu_secreto_access
JWT_REFRESH_SECRET=tu_secreto_refresh
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_key
AWS_SECRET_ACCESS_KEY=tu_secret
AWS_S3_BUCKET=ichattime-media
```

Variables de entorno frontend:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### 4. Configurar Frontend
```bash
cd frontend
npm install
npm run dev
```

El frontend estará en `http://localhost:3000` y el backend en `http://localhost:4000`

---

## Despliegue (Vercel + Railway)

### 1) Backend + PostgreSQL en Railway
1. Crear un proyecto en Railway.
2. Añadir servicio `PostgreSQL`.
3. Añadir servicio del backend apuntando a la carpeta `backend/` del repo.
4. Configurar variables del backend en Railway:
   - `NODE_ENV=production`
   - `PORT=4000`
   - `DATABASE_URL` = URL de PostgreSQL entregada por Railway
   - `DB_SSL=true`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (seguros)
   - `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
   - `CORS_ORIGINS` = dominio de Vercel (ej: `https://tu-app.vercel.app`)
   - Variables AWS/Resend que uses en producción
5. Railway ejecuta build/start con los scripts del backend (`npm run build` + `npm run start:prod`).
6. Guardar el dominio público del backend (ej: `https://api-xxx.up.railway.app`).

### 2) Frontend en Vercel
1. Importar el repo en Vercel y seleccionar la carpeta `frontend/` como Root Directory.
2. Configurar variable en Vercel:
   - `NEXT_PUBLIC_BACKEND_URL=https://api-xxx.up.railway.app`
3. Deploy.

### 3) Validación post-deploy
- Probar login/registro y refresh token.
- Probar carga de imágenes/videos y lectura en feed.
- Probar sockets (`/realtime` y `/chat`).
- Confirmar que `CORS_ORIGINS` solo incluye dominios permitidos.

### 4) Mantener desarrollo local
- Local sigue usando `docker-compose` con PostgreSQL en `localhost:5433`.
- En `backend/.env` local, deja vacío `DATABASE_URL` y usa `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME`.
- En `frontend/.env.local`, usa `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`.
- Ejecuta como siempre: backend `npm run start:dev`, frontend `npm run dev`.

---

## Scripts Disponibles

### Backend
```bash
npm run start:dev      # Desarrollo con hot-reload
npm run build          # Compilar para producción
npm run start:prod     # Iniciar en producción
npm run migration:generate  # Generar migración TypeORM
npm run migration:run    # Ejecutar migraciones
npm run test           # Tests unitarios
```

### Frontend
```bash
npm run dev            # Desarrollo en puerto 3000
npm run build          # Build de producción
npm run start          # Iniciar build de producción
```

---

## API Endpoints Principales

### Autenticación
- `POST /auth/register` - Registro
- `POST /auth/login` - Inicio de sesión
- `POST /auth/refresh` - Refrescar token
- `POST /auth/logout` - Cerrar sesión
- `POST /auth/forgot-password` - Solicitar reset
- `POST /auth/reset-password` - Cambiar contraseña

### Usuarios
- `GET /users/me` - Mi perfil
- `PATCH /users/me` - Actualizar perfil
- `POST /users/me/avatar` - Subir avatar
- `POST /users/me/password` - Cambiar contraseña
- `GET /users/search?q=` - Buscar usuarios
- `GET /users/:username` - Perfil por username

### Publicaciones
- `POST /posts` - Crear publicación
- `GET /posts/feed` - Feed personalizado
- `GET /posts/user/:userId` - Publicaciones de usuario
- `POST /posts/:id/like` - Dar me gusta
- `DELETE /posts/:id/like` - Quitar me gusta
- `DELETE /posts/:id` - Eliminar publicación

### Mensajes (requiere Socket.IO para tiempo real)
- `GET /messages/conversations` - Lista de conversaciones
- `GET /messages/conversation/:userId` - Mensajes con usuario
- `GET /messages/unread-count` - Contador no leídos
- `PATCH /messages/:userId/read` - Marcar como leído
- `POST /messages/upload` - Subir multimedia
- `DELETE /messages/:id/for-me` - Eliminar para mí
- `DELETE /messages/:id/for-all` - Eliminar para todos

### Websocket Events (Socket.IO)
**Chat:**
- `join_room`, `leave_room` - Gestionar sala de chat
- `send_message` - Enviar mensaje
- `new_message` - Recibir mensaje nuevo
- `message_deleted_for_all` - Notificación de borrado

**Notificaciones:**
- `notification` - Nueva notificación

**Presencia:**
- `online` - Marcar como conectado
- `user_status` - Estado de otro usuario cambió

---

## Flujo de Datos en Tiempo Real

### Mensajería
1. Cliente emite `join_room` al abrir chat
2. Al enviar mensaje, servidor guarda y emite `new_message` al destinatario
3. Si está en la sala, recibe inmediatamente; si no, recibe notificación
4. Al eliminar para todos, se notifica a ambos clientes

### Notificaciones
1. Acción (like, comment, follow) genera notificación en BD
2. Servidor emite `notification` al usuario destinatario vía Socket.IO
3. Cliente actualiza contador y muestra toast
4. Historial completo disponible via REST API

### Estado de Conexión
1. Cliente emite `online` al conectar
2. Servidor actualiza estado en FriendRequestsGateway
3. Amigos reciben `user_status` cuando un amigo se conecta/desconecta
4. Lista de amigos muestra indicador online/offline

---

## Decisiones de Diseño

### Cursor-based Pagination
Usada en feeds (posts, flashes, comments) para mejor rendimiento con grandes volúmenes de datos, evitando offset costoso en PostgreSQL.

### Soft Delete en Mensajes
Diferenciación entre "eliminar para mí" (solo oculta para el usuario) y "eliminar para todos" (borra de BD con notificación en tiempo real).

### Socket.IO Namespaces
Separación de concerns: `MessagesGateway` para chat, `NotificationsGateway` para notificaciones y presencia.

### AWS S3 + CloudFront
Almacenamiento de archivos con CDN para entrega rápida de imágenes y videos.

### TypeORM synchronize=true
En desarrollo para iteración rápida. En producción usar migraciones.

---

## Roadmap Futuro

- [ ] **Video calls** (WebRTC)
- [ ] **Grupos de chat** (multipersona)
- [ ] **Live streaming**
- [ ] **Push notifications** (Firebase)
- [ ] **Búsqueda avanzada** (Elasticsearch)
- [ ] **Analíticas** de engagement
- [ ] **Moderación de contenido**
- [ ] **Verificación de cuentas**

---

## Contribuir

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Add: nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

---

## Contacto

- GitHub: [@JKDx97](https://github.com/JKDx97)
- Proyecto: [https://github.com/JKDx97/IChatTime](https://github.com/JKDx97/IChatTime)
