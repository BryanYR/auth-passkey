# Roadmap: Passkeys / WebAuthn (FIDO2) para plataforma ticketera

**Stack:** Nuxt 3 (frontend) + Node.js (backend)  
**Objetivo:** Login masivo resistente a phishing, sin secreto compartido

---

## Contexto de arquitectura

```
Usuario (browser/mobile)
        │
        ▼
  Nuxt 3 (SSR/SPA)          ← UI + composables WebAuthn
        │
        ▼
  Node.js API               ← Validación FIDO2, gestión de credenciales
        │
        ▼
  Base de datos             ← Tabla de credenciales (credential_id, public_key, counter)
```

---

## Fase 0 — Fundamentos y decisiones de diseño (1–2 días)

### 0.1 Entender el flujo FIDO2

Dos operaciones principales:

| Operación | Cuándo ocurre | Qué hace |
|-----------|--------------|----------|
| **Registration** (attestation) | Usuario agrega passkey | Genera par de llaves, almacena public key en server |
| **Authentication** (assertion) | Login | El autenticador firma un challenge, server verifica con public key |

### 0.2 Decisiones a tomar antes de codear

- [ ] ¿Passkey como **único método** o como **alternativa** a password?
- [ ] ¿Soporte a **roaming authenticators** (YubiKey, iPhone) o solo **platform authenticators** (Face ID, Windows Hello)?
- [ ] ¿**Discoverable credentials** (usernameless login) o requieres email primero?
- [ ] ¿Los usuarios pueden tener **múltiples passkeys** por cuenta? (recomendado: sí)
- [ ] ¿**Attestation verification** estricta o ninguna? (para uso masivo: `none` es suficiente)

### 0.3 Dependencias

**Backend (Node.js):**
```bash
npm install @simplewebauthn/server
```

**Frontend (Nuxt 3):**
```bash
npm install @simplewebauthn/browser
```

> `@simplewebauthn` es la librería más madura para Node/browser. Abstrae la complejidad de CBOR, COSE keys y verificación de certificados.

---

## Fase 1 — Base de datos (1 día)

### 1.1 Schema de credenciales

```sql
CREATE TABLE passkey_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id       TEXT NOT NULL UNIQUE,       -- base64url, ID del autenticador
  public_key          BYTEA NOT NULL,             -- llave pública COSE
  counter             BIGINT NOT NULL DEFAULT 0,  -- anti-replay
  aaguid              TEXT,                       -- identifica el tipo de autenticador
  device_type         TEXT,                       -- 'platform' | 'cross-platform'
  backed_up           BOOLEAN DEFAULT FALSE,      -- synced passkey (iCloud, etc.)
  transports          TEXT[],                     -- ['internal', 'hybrid', 'usb', ...]
  friendly_name       TEXT,                       -- "iPhone de Bryan", "MacBook Pro"
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_passkey_user_id ON passkey_credentials(user_id);
CREATE INDEX idx_passkey_credential_id ON passkey_credentials(credential_id);
```

### 1.2 Tabla de challenges (previene replay attacks)

```sql
CREATE TABLE webauthn_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL para registration de usuarios nuevos
  challenge   TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,   -- 'registration' | 'authentication'
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  used        BOOLEAN DEFAULT FALSE
);

-- Limpiar challenges expirados (cron o trigger)
CREATE INDEX idx_challenge_expires ON webauthn_challenges(expires_at);
```

---

## Fase 2 — Backend Node.js (3–4 días)

### 2.1 Configuración base

```javascript
// config/webauthn.js
export const webAuthnConfig = {
  rpName: 'Tu Empresa Ticketera',
  rpID: process.env.WEBAUTHN_RP_ID,          // 'tuempresa.com' (sin https://)
  origin: process.env.WEBAUTHN_ORIGIN,        // 'https://tuempresa.com'
  // Para dev local:
  // rpID: 'localhost'
  // origin: 'http://localhost:3000'
}
```

> **Crítico:** `rpID` es el dominio que "posee" las passkeys. Una passkey registrada en `tuempresa.com` NO funciona en `phishing-clone.com` — este es el mecanismo anti-phishing central.

### 2.2 Endpoints de Registration

#### `POST /auth/passkey/register/begin`
```
Recibe: { userId } (usuario ya autenticado por otro método, o nuevo usuario)
Retorna: PublicKeyCredentialCreationOptions (challenge para el browser)
```

Lógica:
1. Obtener credenciales existentes del usuario (para `excludeCredentials`)
2. Generar challenge aleatorio (mínimo 16 bytes)
3. Guardar challenge en DB con TTL de 5 minutos
4. Retornar opciones al browser

#### `POST /auth/passkey/register/finish`
```
Recibe: { credential } (respuesta del autenticador)
Retorna: { success: true, credentialId }
```

Lógica:
1. Recuperar challenge pendiente de DB
2. Verificar con `@simplewebauthn/server` → `verifyRegistrationResponse()`
3. Guardar public key, counter, transports en DB
4. Marcar challenge como usado
5. Retornar éxito

### 2.3 Endpoints de Authentication

#### `POST /auth/passkey/login/begin`
```
Recibe: { email? } (opcional para discoverable credentials)
Retorna: PublicKeyCredentialRequestOptions
```

Lógica:
1. Si se provee email, buscar credenciales del usuario → `allowCredentials`
2. Si no hay email (usernameless), retornar sin `allowCredentials`
3. Guardar challenge en DB

#### `POST /auth/passkey/login/finish`
```
Recibe: { credential }
Retorna: { token, user }
```

Lógica:
1. Recuperar challenge pendiente
2. Buscar credencial por `credential.id`
3. Verificar con `verifyAuthenticationResponse()`
4. **Validar que counter sea mayor al almacenado** (anti-clone)
5. Actualizar counter en DB
6. Actualizar `last_used_at`
7. Generar JWT/session y retornar

### 2.4 Endpoint de gestión

#### `GET /auth/passkey/credentials` — Listar passkeys del usuario
#### `DELETE /auth/passkey/credentials/:id` — Revocar una passkey
#### `PATCH /auth/passkey/credentials/:id` — Renombrar passkey

---

## Vistas del prototipo (acordado en diseño)

4 rutas cubren todos los flujos de passkey:

| Ruta | Propósito |
|------|-----------|
| `/auth/login` | Email + password + botón "Iniciar con Passkey" (visible si el browser lo soporta) |
| `/auth/register` | Formulario completo → post-registro ofrece setup de passkey inline |
| `/dashboard` | Vista protegida — si no tiene passkeys muestra banner "¿Iniciar más rápido?" |
| `/settings/security` | Gestión de passkeys: listar, agregar, renombrar, revocar |

Flujos demostrados:
1. Usuario nuevo → registra → passkey setup opcional
2. Usuario existente → login con password → banner en dashboard → va a settings → agrega passkey
3. Usuario con passkey → login directo con Face ID / Windows Hello (sin password)
4. Settings → gestión completa de dispositivos registrados

---

## Fase 3 — Frontend Nuxt 3 (3–4 días)

### 3.1 Composable `usePasskey`

```
composables/usePasskey.ts
```

Expone:
- `registerPasskey()` — flujo completo de registro
- `loginWithPasskey()` — flujo completo de autenticación
- `listPasskeys()` — obtener passkeys del usuario
- `deletePasskey(id)` — revocar
- `isSupported` — computed, detecta soporte del browser

Internamente usa `startRegistration()` y `startAuthentication()` de `@simplewebauthn/browser`.

### 3.2 Detección de soporte

```javascript
const isPasskeySupported = async () => {
  return window.PublicKeyCredential !== undefined
    && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
}
```

### 3.3 UX del flujo de login

```
[Pantalla login]
    ├── Email field
    ├── [Continuar con Passkey] ← botón principal si el browser soporta
    └── [Continuar con contraseña] ← fallback

[Si tiene passkeys registradas]
    └── Trigger automático del autenticador (Face ID / Touch ID / Windows Hello)
```

### 3.4 Páginas y componentes

```
pages/
  auth/
    login.vue           ← botón passkey + fallback password
    register.vue        ← después de crear cuenta, ofrecer setup de passkey

components/
  auth/
    PasskeyButton.vue   ← botón "Iniciar sesión con passkey"
    PasskeyManager.vue  ← lista de passkeys + agregar/eliminar (en settings)
```

### 3.5 Server routes (si usas Nitro como BFF)

```
server/api/auth/passkey/
  register.begin.post.ts
  register.finish.post.ts
  login.begin.post.ts
  login.finish.post.ts
```

---

## Fase 4 — Seguridad y edge cases (2 días)

### 4.1 Validaciones críticas en backend

- [ ] Verificar que `origin` en la respuesta coincide exactamente con el configurado
- [ ] Verificar que `rpIdHash` corresponde a tu dominio
- [ ] Validar `userVerification` según política (recommended vs required)
- [ ] Counter debe ser **siempre mayor** al almacenado — si es igual o menor, posible clonación → bloquear y alertar
- [ ] Challenge tiene que estar marcado como no-usado antes de verificar
- [ ] Challenge expira en 5 minutos máximo

### 4.2 Rate limiting

```
POST /auth/passkey/login/begin   → 10 req/min por IP
POST /auth/passkey/login/finish  → 5 req/min por IP
```

### 4.3 Política de `userVerification`

| Escenario | Valor recomendado |
|-----------|------------------|
| Datos sensibles (pagos, admin) | `required` |
| Login general | `preferred` |
| Baja fricción | `discouraged` |

Para ticketera: `preferred` en login general, `required` en checkout/reembolso.

### 4.4 Manejo del counter para synced passkeys

Las passkeys sincronizadas (iCloud Keychain, Google Password Manager) tienen counter en 0 siempre. Detectar por `backed_up: true` y aplicar política distinta si es necesario.

---

## Fase 5 — UX avanzada y adopción masiva (2–3 días)

### 5.1 Estrategia de onboarding progresivo

```
Flujo recomendado para usuarios existentes:
1. Usuario hace login con password normalmente
2. Post-login: banner "¿Quieres activar login con Face ID?" (no bloqueante)
3. Si acepta: flujo de registration inline
4. En settings: sección "Seguridad > Métodos de acceso"
```

### 5.2 Nombre amigable automático

Al registrar, detectar el tipo de autenticador y sugerir nombre:

```javascript
const getDefaultName = (credential) => {
  const { aaguid, deviceType } = credential
  // Mapear AAGUIDs conocidos a nombres: Apple, Google, etc.
  if (deviceType === 'platform') return detectPlatformName() // "iPhone", "MacBook"
  return 'Llave de seguridad'
}
```

### 5.3 Multiple passkeys por usuario

Permitir y **recomendar** múltiples passkeys:
- "iPhone de trabajo"
- "MacBook personal"
- "Llave de seguridad de respaldo"

Mostrar `last_used_at` para que el usuario pueda identificar y revocar dispositivos viejos.

### 5.4 Fallback y recuperación de cuenta

Asegurarse de tener siempre una ruta de recuperación:
- Email magic link como fallback
- Código de recuperación de un solo uso generado al activar passkeys

---

## Fase 6 — Testing (2 días)

### 6.1 Tests unitarios (backend)

- Verificación correcta de registration response
- Rechazo de challenges expirados
- Rechazo de counter inválido (replay attack)
- Rechazo de origin incorrecto

### 6.2 Tests de integración

- Flujo completo register → login en entorno de test
- Usar `@simplewebauthn/testing` para generar credenciales simuladas

### 6.3 Pruebas manuales por plataforma

| Plataforma | Autenticador |
|------------|-------------|
| macOS Safari | Touch ID |
| macOS Chrome | Touch ID |
| iOS Safari | Face ID / Touch ID |
| Android Chrome | Fingerprint |
| Windows Chrome | Windows Hello |
| Cualquiera | YubiKey (cross-platform) |

---

## Fase 7 — Observabilidad y monitoreo (1 día)

### 7.1 Métricas a trackear

```
passkey.registration.success       (contador)
passkey.registration.failure       (contador + motivo)
passkey.auth.success               (contador)
passkey.auth.failure               (contador + motivo)
passkey.counter_anomaly            (alerta — posible clonación)
passkey.adoption_rate              (% usuarios con passkey activa)
```

### 7.2 Alertas críticas

- Counter regression detectado → alerta inmediata al equipo de seguridad
- Spike de failures de autenticación → posible ataque

---

## Fase 8 — Rollout (1 semana)

```
Semana 1: Disponible solo para early adopters / staff interno
Semana 2: Opt-in para usuarios existentes (banner post-login)
Semana 3: Prompt activo para usuarios frecuentes
Semana 4: Considerar passkey como método principal
```

---

## Timeline estimado

| Fase | Duración | Dependencias |
|------|----------|-------------|
| 0. Fundamentos y decisiones | 1–2 días | — |
| 1. Base de datos | 1 día | Fase 0 |
| 2. Backend Node.js | 3–4 días | Fase 1 |
| 3. Frontend Nuxt 3 | 3–4 días | Fase 2 |
| 4. Seguridad y edge cases | 2 días | Fases 2–3 |
| 5. UX avanzada | 2–3 días | Fase 3 |
| 6. Testing | 2 días | Fases 4–5 |
| 7. Observabilidad | 1 día | Fase 6 |
| 8. Rollout | 1 semana | Todo |
| **Total** | **~4 semanas** | |

---

## Referencias y herramientas

- [SimpleWebAuthn Docs](https://simplewebauthn.dev) — librería principal para Node + browser
- [WebAuthn.guide](https://webauthn.guide) — tutorial visual del protocolo
- [passkeys.dev](https://passkeys.dev) — recursos oficiales de la alianza FIDO
- [AAGUID Registry](https://github.com/nicklockwood/AAGUID-Registry) — identificar autenticadores por AAGUID
- Herramienta de prueba: [webauthn.io](https://webauthn.io) — probar flujos en sandbox
