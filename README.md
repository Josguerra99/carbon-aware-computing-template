# Template del equipo (TypeScript)

Servidor de pronóstico en el puerto **3916**. Entrena al arrancar descargando históricos del **sitio del taller** (lo opera el facilitador) y responde `GET /forecast/:datasetId?start=&end=`.

## Arrancar

1. Ejecuta **`setup`** (crea `.env` desde `.env.example` si no existe) y edita **`MAIN_SERVER_URL`** con la URL del facilitador.
2. Registra tu equipo en el sitio del taller (`/register`) con la IP de tu máquina y el puerto **3916**.
3. Ejecuta **`run`** desde la raíz de este repo:

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/setup.ps1
powershell -ExecutionPolicy Bypass -File scripts/windows/run.ps1
```

**Ubuntu**

```bash
bash scripts/ubuntu/setup.sh
bash scripts/ubuntu/run.sh
```

`setup` crea `.env` (primer paso), instala Bun si falta y ejecuta `bun install`. `run` también crea `.env` si falta, carga variables y arranca `bun run dev` (recarga al guardar en `src/`).

Detalle de requisitos y qué hace cada script: [`scripts/README.md`](scripts/README.md).

## Dónde trabajar

| Ruta | Qué haces |
| --- | --- |
| `src/main.ts` | Implementa `SimplePredictionModel` y exporta `WorkshopModel`. |
| `src/core/` | Infraestructura (caché, histórico, API) — no hace falta tocarla en el taller. |
| `src/server/index.ts` | Servidor HTTP — no hace falta tocarlo. |
| `src/workshop/` | Modelos del taller (opcional, ignorado en git). |

## Datos

| Llamada al sitio | Para qué |
| --- | --- |
| `GET /api/workshop/manifest` | `configId` de la caché |
| `GET /api/historic/ghi` | Lista de datasets del nivel activo |
| `GET /api/historic/ghi/:id/train` | Serie de entrenamiento |
| `GET /api/workshop/datasets/:id/meta` | Solo lat/lon en `/forecast` |

La caché vive en `cache/manifest.json`, `cache/meta/` y `cache/train/`. Se invalida si cambia el nivel (`configId`) o si cambia algún CSV del config activo (`csvBundleHash` en `/api/workshop/manifest`, derivado de size/mtime de cada CSV). `REFRESH_HISTORIC=1` ignora el disco en ese proceso.

Los JSON viejos `cache/<id>.json` ya no se leen.

## Variables de entorno

Copia `.env.example` a `.env` (o deja que `setup` lo haga). Lo importante:

| Variable | Default | Uso |
| --- | --- | --- |
| `MAIN_SERVER_URL` | *(la da el facilitador)* | URL base del sitio del taller (históricos y registro) |
| `PORT` | `3916` | Puerto de tu servidor |
| `TRAIN_DATASETS` | `all` | `all` o lista de ids separados por coma |
| `HISTORIC_CACHE_TTL_MS` | `0` | TTL de caché en ms; `0` = solo invalidar por manifest |
| `REFRESH_HISTORIC` | `0` | `1` = ignorar caché en disco al arrancar |

## Manual (sin scripts)

Requisito: [Bun](https://bun.sh).

```bash
bun install
bun run dev
```

Pruebas: `bun test src`.

Alternativa con Node 20: `npm run dev:node` (requiere dependencias nativas de TF si usas modelos en `src/workshop/`).
