# Template del equipo

Servidor de pronóstico en el puerto **3916**. Entrena al arrancar con el histórico del sitio (3915) y responde `GET /forecast/:datasetId?start=&end=`.

## Datos

| Llamada al sitio | Para qué |
| --- | --- |
| `GET /api/workshop/manifest` | `configId` de la caché |
| `GET /api/historic/ghi` | Lista de datasets del nivel activo |
| `GET /api/historic/ghi/:id/train` | Serie de entrenamiento |
| `GET /api/workshop/datasets/:id/meta` | Solo lat/lon en `/forecast` |

La caché vive en `cache/manifest.json`, `cache/meta/` y `cache/train/`. Se invalida si cambia el nivel (`configId`) o si cambia algún CSV del config activo (`csvBundleHash` en `/api/workshop/manifest`, derivado de size/mtime de cada CSV). `REFRESH_HISTORIC=1` ignora el disco en ese proceso.

Los JSON viejos `cache/<id>.json` ya no se leen.

```bash
bun install
bun run dev
```

Ver `.env.example` para `MAIN_SERVER_URL`, `TRAIN_DATASETS`, `HISTORIC_CACHE_TTL_MS` y `REFRESH_HISTORIC`.
