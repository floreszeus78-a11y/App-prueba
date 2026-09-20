# Plataforma de Reportes Confidenciales (MVP)

Esta es una plataforma web para reportar hechos ilícitos de forma **CONFIDENCIAL**, no anónima.
El objetivo es que quien reporta verifique su identidad una vez, pero los revisores nunca la vean. Los revisores solo interactúan con un seudónimo generado aleatoriamente.

## Arquitectura

- **Frontend:** Next.js (App Router), React, Tailwind CSS.
- **Backend:** Next.js API Routes.
- **Base de Datos:** PostgreSQL.
- **ORM:** Prisma.
- **Autenticación:** NextAuth.js (Credentials Provider para login con seudónimo en MVP).
- **Criptografía:** Módulo nativo `crypto` de Node.js (AES-256-GCM y SHA-256).

### Separación de Datos (Data Separation)
El modelo de base de datos está diseñado para separar estrictamente la identidad real del usuario de sus reportes:
1. `User`: Tabla principal que contiene roles y el `pseudonym`.
2. `Identity`: Tabla vinculada 1:1 a `User`. Almacena los datos PII (nombre, documento, contacto) **cifrados** con AES-256-GCM.
3. `Report` y `Evidence`: Vinculadas a `User`, pero aisladas completamente de `Identity`.

Cuando los revisores consultan los reportes (`/api/reviewer/reports`), Prisma solo selecciona `user.pseudonym`.

## Modelo de Amenazas y Medidas de Seguridad

1. **El denunciado:** Un agresor con poder o acceso físico al dispositivo de la víctima.
   - **Mitigación:** Se utiliza rate limiting y cabeceras de seguridad. (Para producción, se añadirán botones de salida rápida, no caché y mensajería interna sin correos).
2. **Hackers buscando la base de datos:**
   - **Mitigación:** Los datos de identidad y archivos de evidencia están cifrados con AES-256-GCM, separados físicamente de la base de datos y sin claves en la misma, requiriendo de variables de entorno para ser descifrados.
3. **Personas internas (revisores curiosos o sobornados):**
   - **Mitigación:** Los revisores no tienen acceso a la tabla `Identity` ni a la clave de cifrado. Todo acceso a un reporte queda registrado en la tabla inmutable (conceptualmente para MVP) `AuditLog`.
4. **Autoridades que exigen datos por orden legal:**
   - **Mitigación:** La plataforma asegura que los datos existen y son rastreables para órdenes judiciales legítimas, pero para desencriptar se deberá definir un flujo legal (ej. firmas criptográficas múltiples "m-of-n").
5. **Reportantes de mala fe:**
   - **Mitigación:** Advertencia legal clara. Verificación de identidad previa. Límite de reportes falsos o uso abusivo gestionado desde el análisis y priorización (para el futuro).
6. **Fugas de Metadatos en Archivos:**
   - **Mitigación:** Uso de `sharp` para eliminar EXIF y GPS de las imágenes subidas.
7. **Abuso de recursos (OOM):**
   - **Mitigación:** Limitación estricta de tamaño de archivo (10MB) y validación de tipos mágicos (MVP por MIME type).

## Requisitos Previos

- Node.js (v18 o superior).
- PostgreSQL en ejecución.
- Clave de cifrado configurada.

## Configuración y Variables de Entorno (.env)

Debes crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/reports_db?schema=public"
NEXTAUTH_SECRET="tu-secreto-para-nextauth-muy-largo"
# ENCRYPTION_KEY debe ser un string en hexadecimal de exactamente 32 bytes (64 caracteres)
ENCRYPTION_KEY="f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2"
```

## Pendientes para Producción (Fase 2)

1. **Proceso de Revelación de Identidad:**
   - Actualmente no existe un endpoint para descifrar la identidad. Esto debe ser diseñado con un flujo legal estricto (ej. requerimiento de un juez, aprobación múltiple "m-of-n", o firmas criptográficas de autoridades).
2. **Rate Limiting Robusto:** Reemplazar el rate limiting en memoria (`Map`) del `middleware.ts` por una solución distribuida como Redis, ya que el actual se reinicia con el servidor y no escala en múltiples instancias.
3. **Almacenamiento de Evidencia (S3):** En lugar de guardar los archivos cifrados en el disco local (`/uploads`), se debe integrar AWS S3 o similar.
4. **Descifrado de Evidencia bajo Demanda:** Construir el endpoint para que los revisores autorizados puedan descargar y descifrar la evidencia temporalmente.
5. **Autenticación Fuerte:** Implementar 2FA y validación estricta de documentos (KYC/OCR) en el registro en lugar de solo texto plano.

## Comandos

- **Instalar dependencias:** `npm install`
- **Generar Prisma Client:** `npx prisma generate`
- **Correr migraciones:** `npx prisma db push` o `npx prisma migrate dev`
- **Correr tests:** `npm test`
- **Iniciar servidor de desarrollo:** `npm run dev`
