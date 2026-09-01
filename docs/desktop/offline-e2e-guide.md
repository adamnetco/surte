# Guía: compilar el .exe y probar el flujo completo offline

Objetivo: dejar un ejecutable de escritorio funcionando y validar
**crear tienda → crear usuario → cobrar → arquear** sin internet, con
sincronización al reconectar.

> El binario es genérico multi-tenant: la identidad de la tienda llega por
> licencia (ver `multitenant-runtime.md`). Nunca se compila un .exe por cliente.

## 1. Requisitos en tu máquina (Windows)

| Runtime | Requisitos |
|---|---|
| **Tauri** (recomendado, ~6 MB) | Rust (`rustup`, toolchain `stable-msvc`), Visual Studio Build Tools con "Desarrollo para escritorio con C++", WebView2 Runtime |
| **Electron** (soportado hoy) | Node 20+, `electron@31.7.7` pinneado en `electron/package.json` |

```powershell
# Rust (una sola vez)
winget install Rustlang.Rustup
rustup default stable-msvc
cargo install tauri-cli --version "^2"
```

## 2. Compilar

```powershell
# En la raíz del repo
npm install

# Opción A — Tauri
cargo tauri build
#  → src-tauri\target\release\bundle\nsis\*.exe  (instalador)
#  → src-tauri\target\release\bundle\msi\*.msi

# Opción B — Electron
cd electron
npm install
npm run package     # genera la carpeta empaquetada en electron/out
```

Antes de compilar, verifica que el bundle web esté sano:

```powershell
npm run build:desktop   # debe terminar sin errores y escribir dist/
```

## 3. Preparar la tienda y el usuario (una vez, CON internet)

Esto vive en el control plane (Supabase) y **requiere conexión**:

1. `admin.sistecpos.com` → **Superadmin → Tiendas → Nueva tienda**
   (`TenantOnboardingWizard`): nombre de tienda, correo del owner y
   **contraseña** definida por ti. Queda usable de inmediato, sin correo previo.
2. **Superadmin → Tienda → Usuarios POS**: `Crear usuario` para cajeros
   (correo + contraseña + rol: `cashier`, `manager`, `waiter`, …) y
   `Definir contraseña` para restablecer sin correo.
3. **Superadmin → Tienda → Licencia**: emite la licencia y copia la clave.
4. Abre el ejecutable y pega la licencia. El runtime guarda cifrado
   `license.dat`, `activation.token` y `tenant_manifest.dat`.

Alcance por admin: cada `owner`/`admin` sólo administra usuarios de **su**
organización — lo aplica `tenant-access-manage` (verifica membresía activa del
llamante) más RLS por `organization_id` en `organization_members`/`user_roles`.
Sólo un superadmin cruza tiendas o toca al `owner`.

## 4. Cargar la tienda para operar offline (última vez con red)

1. Inicia sesión en el POS del ejecutable.
2. Entra a `POS → Vender` y espera el primer sync (catálogo + categorías).
3. Abre **Estado del sistema → Sincronización** y confirma:
   - `Listo para operar sin red: sí`
   - checkpoints de `products` y `categories` con fecha reciente
   - `Pendientes en outbox: 0`

## 5. Prueba offline real

```
1. Desactiva el Wi-Fi / desconecta el cable.
2. POS → Abrir caja (monto inicial, p. ej. 50.000).
3. Agrega productos (F2 buscar, +/- cantidad).
4. F5 Cobrar → efectivo → digita el recibido → confirmar.
   → el ticket se imprime y la venta entra al outbox local.
5. Repite 2–3 ventas.
6. POS → Cerrar caja: cuenta el efectivo y confirma el arqueo.
```

Todo lo anterior se resuelve contra la base local del tenant
(`sistecpos_offline_<organization_id>`), sin llamadas a Supabase.

## 6. Reconectar y verificar sincronización

1. Vuelve a conectar la red.
2. **Estado del sistema → Sincronización → Sincronizar ahora**.
3. Espera `Pendientes en outbox: 0` y `Conflictos: 0`.
4. Contrasta en la nube: **Panel Admin → Caja** debe mostrar la sesión cerrada,
   el arqueo y los saldos por medio de pago idénticos a los del terminal.

Si algo queda en conflicto, aparece en el panel con su motivo
(`outbox_gave_up`, `remote_newer`, `duplicate_close`) y se resuelve desde ahí.

## 7. Impresora térmica

**Panel Admin → Impresoras**:

1. IP fija de la térmica + puerto `9100` → **Probar conexión**.
2. **Ticket de prueba (monto y cambio)** para validar el formato de 80 mm.
3. **Abrir cajón** si el equipo tiene cajón conectado a la impresora.
4. Registra la impresora en "Impresoras de la tienda" y márcala como
   predeterminada para que el POS la use al cobrar.

En Tauri los bytes ESC/POS van directo por comando Rust (sin diálogo de
Windows); en navegador/Electron pasan por el agente local `127.0.0.1:9101`.

## 8. Problemas frecuentes

| Síntoma | Causa / arreglo |
|---|---|
| Pantalla en negro al abrir | bundle sin rutas relativas: recompila con `npm run build:desktop` |
| "Sin agente local" en Impresoras | abre el POS de escritorio; en navegador puro no hay acceso RAW |
| `EBUSY` al empaquetar | cierra el .exe abierto y borra `electron/out` |
| No deja vender sin red | falta el primer sync: reconecta y repite el paso 4 |
| Licencia revocada | el runtime borra credenciales y cierra la app: reemite la licencia |
