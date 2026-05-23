# SURTÉ YA Desktop (Electron)

Cliente local reforzado con activación Ed25519, fingerprint de máquina y SQLite cifrado.

## Modelo de licencia

- 1 `license_key` (UUID) por organización con `max_terminals` (cupo de equipos).
- Cada equipo genera un **fingerprint** (`sha256(MAC + CPU + hostname + arch)`).
- `register_activation` rechaza nuevos equipos si se excede el cupo.
- El token Ed25519 expira a los 7 días → el desktop hace **heartbeat** cada 30 min para renovarlo.
- Si la licencia se suspende o el seat se revoca, el siguiente heartbeat cierra la app.

## Build local

```bash
# Variables de entorno requeridas
export SURTEYA_SUPA_URL="https://dimyhjzcwlgfczimqhet.supabase.co"
export SURTEYA_SUPA_ANON="<anon-key>"

# Build del front
npm run build

# Empaquetar (instala devDeps primero)
npm i -D electron @electron/packager
npx @electron/packager . "SurteYaDesktop" \
  --platform=linux --arch=x64 --out=electron-release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'
```

Para macOS: `--platform=darwin`. Para Windows: `--platform=win32`.

Subir el binario empaquetado (`.tar.gz`/`.zip`/`.exe`) al bucket `desktop-releases`
y registrarlo en la tabla `desktop_releases` desde `/licencias` (tab "Instaladores").

## Refuerzo de protección (opcional)

1. `bytenode` para compilar `main.cjs` a V8 bytecode (`.jsc`).
2. `better-sqlite3` + SQLCipher para DB local cifrada con clave derivada del fingerprint.
3. `asar` activado por defecto en `@electron/packager`.
