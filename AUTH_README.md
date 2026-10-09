# Módulo de Autenticación - Contabily

Sistema de autenticación dual que soporta:
- **Producción**: Supabase + Google OAuth
- **Desarrollo/Testing**: PostgreSQL local (Docker puerto 5433) + Google OAuth

## 🚀 Inicio Rápido

### 1. Levantar PostgreSQL de testing (puerto 5433)
```bash
./docker-test-db.sh start
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus credenciales de Google OAuth
```

### 3. Iniciar servidor
```bash
pnpm start:dev
```

## 📋 Endpoints Disponibles

### Autenticación Local (Email/Password)
```
POST   /api/v1/auth/register        # Registro (solo modo local)
POST   /api/v1/auth/login           # Login (solo modo local)
POST   /api/v1/auth/refresh         # Renovar access token
POST   /api/v1/auth/refresh/token   # Renovar con body {refreshToken}
POST   /api/v1/auth/logout          # Cerrar sesión actual
POST   /api/v1/auth/logout/all      # Cerrar todas las sesiones
```

### Google OAuth
```
GET    /api/v1/auth/google          # Obtener URL de autorización
GET    /api/v1/auth/google/callback # Callback (modo Supabase)
POST   /api/v1/auth/google/callback # Callback con código (modo local)
```

### Perfil y Contraseña
```
GET    /api/v1/auth/me              # Perfil del usuario autenticado
POST   /api/v1/auth/change-password # Cambiar contraseña (local)
POST   /api/v1/auth/forgot-password # Solicitar recuperación
POST   /api/v1/auth/reset-password  # Restablecer con token
POST   /api/v1/auth/verify-email    # Verificar email
POST   /api/v1/auth/resend-verification # Reenviar verificación
```

### Información
```
GET    /api/v1/auth/mode            # Modo actual (local/supabase)
```

## 🔧 Modos de Operación

### Modo Local (PostgreSQL + Google OAuth)
- **Base de datos**: PostgreSQL en Docker (puerto 5433)
- **Google OAuth**: Flujo completo manejado por la app
- **Usuarios**: Almacenados en tabla `users` local
- **Tokens**: JWT firmados localmente

**Configuración requerida en `.env`:**
```env
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

### Modo Supabase (Producción)
- **Base de datos**: Supabase (PostgreSQL gestionado)
- **Auth**: Supabase Auth + Google OAuth
- **Usuarios**: Gestionados por Supabase
- **Tokens**: JWT de Supabase

**Configuración requerida en `.env`:**
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

**El cambio de modo es automático**: si `SUPABASE_URL` está configurada y válida, usa Supabase; si no, usa local.

## 🐳 Docker Testing Database

```bash
# Iniciar
./docker-test-db.sh start

# Ver logs
./docker-test-db.sh logs

# Detener
./docker-test-db.sh stop

# Reiniciar
./docker-test-db.sh restart

# Limpiar todo (¡pierde datos!)
./docker-test-db.sh clean

# Acceder a psql
./docker-test-db.sh shell
```

**Acceso pgAdmin (opcional):** http://localhost:5051
- Email: `test@contabily.local`
- Password: `test1234`

## 🔐 Google OAuth Setup

### 1. Google Cloud Console
1. Crear proyecto o seleccionar existente
2. APIs & Services → Credentials → Create Credentials → OAuth Client ID
3. Application type: Web application
4. Authorized redirect URIs:
   - `http://localhost:3000/api/v1/auth/google/callback` (desarrollo)
   - `https://tu-dominio.com/api/v1/auth/google/callback` (producción)

### 2. Configurar en Supabase (producción)
1. Authentication → Providers → Google → Enable
2. Pegar Client ID y Client Secret
3. Guardar

### 3. Variables de entorno
```env
# Desarrollo
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# Producción (usa las mismas credenciales en Supabase Dashboard)
```

## 📁 Estructura del Módulo

```
src/auth/
├── auth.controller.ts          # Endpoints REST
├── auth.module.ts              # Módulo principal
├── auth.service.ts             # Servicio orquestador
├── dto/
│   ├── auth.dto.ts             # DTOs de entrada
│   └── response.dto.ts         # DTOs de respuesta
├── entities/
│   └── user.entity.ts          # Entidad User (TypeORM)
├── guards/
│   ├── jwt-auth.guard.ts       # Guard para access token
│   ├── jwt-refresh.guard.ts    # Guard para refresh token
│   └── google-auth.guard.ts    # Guard para Google OAuth
├── services/
│   ├── auth.service.ts         # Servicio principal (modo dual)
│   ├── local-auth.service.ts   # Lógica local (PostgreSQL)
│   └── supabase.service.ts     # Integración Supabase
└── strategies/
    └── jwt.strategy.ts         # Estrategias Passport (JWT, Refresh, Google)
```

## 🧪 Testing

```bash
# Tests unitarios
pnpm test

# Tests e2e
pnpm test:e2e

# Con coverage
pnpm test:cov
```

Variables de test en `.env.test` (puerto 3001, BD separada).

## 🔑 Flujo de Tokens

### Access Token
- Duración: 1 día (configurable `JWT_EXPIRES_IN`)
- Uso: Header `Authorization: Bearer <token>`
- Payload: `{ sub, email, roles }`

### Refresh Token
- Duración: 7 días (configurable `JWT_REFRESH_EXPIRES_IN`)
- Uso: Body `{ "refreshToken": "..." }` en `/auth/refresh`
- Almacenado hasheado en BD (modo local)

## 👥 Roles de Usuario

```typescript
enum UserRole {
  USER = 'user',         // Usuario estándar
  ACCOUNTANT = 'accountant', // Contador
  ADMIN = 'admin',       // Administrador
}
```

## 📝 Notas para Colaboradores

1. **Tu compañero no necesita Supabase** - usa PostgreSQL en Docker (puerto 5433)
2. **Google OAuth funciona en ambos modos** - configurar credenciales en `.env`
3. **Cambio automático de modo** - solo define `SUPABASE_URL` para activar producción
4. **Datos aislados** - cada uno tiene su BD local en Docker

## 🐛 Troubleshooting

### Error: "Supabase not configured"
→ Normal en desarrollo. Verifica que `.env` NO tenga `SUPABASE_URL` o que esté comentada.

### Error: "Google OAuth credentials missing"
→ Configura `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`

### Error: "Connection refused" en DB
→ Ejecuta `./docker-test-db.sh start` y verifica puerto 5433

### Error: "Invalid refresh token"
→ El token expiró o se hizo logout. Haz login de nuevo.

## 📦 Dependencias Principales

- `@nestjs/jwt` - JWT handling
- `@nestjs/passport` - Integración Passport
- `passport-jwt` - Estrategia JWT
- `passport-google-oauth20` - Google OAuth
- `@supabase/supabase-js` - Cliente Supabase
- `typeorm` - ORM para PostgreSQL
- `bcryptjs` - Hash de contraseñas
- `class-validator` - Validación DTOs