# Scripts (TypeScript)

Ayudantes de **setup** y **run** en Windows y Ubuntu (sin WSL). Ejecuta los comandos desde la **raíz del repo**.

## Comandos

| OS | Setup (una vez o tras cambiar deps) | Run (servidor del equipo) |
| --- | --- | --- |
| Windows | `powershell -ExecutionPolicy Bypass -File scripts/windows/setup.ps1` | `powershell -ExecutionPolicy Bypass -File scripts/windows/run.ps1` |
| Ubuntu | `bash scripts/ubuntu/setup.sh` | `bash scripts/ubuntu/run.sh` |

## Qué instala / hace `setup`

| Paso | Windows | Ubuntu |
| --- | --- | --- |
| Runtime | Instala [Bun](https://bun.sh) si no está en PATH (`install.ps1`) | Instala Bun con `curl \| bash` si falta |
| Dependencias | `bun install` | `bun install` |
| Config | `scripts/ensure-env.*` → crea `.env` desde `.env.example` (o valores por defecto) | Igual |

## Qué hace `run`

1. Comprueba que exista `node_modules` (si no, llama a `setup`).
2. Carga variables desde `.env` en el proceso.
3. Ejecuta `bun run dev` (watch en `src/`).

## Requisitos previos (manual)

| Herramienta | Notas |
| --- | --- |
| **Bun** | Lo instala `setup` si falta. Tras instalar en Windows, puede hacer falta abrir una terminal nueva. |
| **Sitio del taller** | Lo levanta el facilitador. Solo configura `MAIN_SERVER_URL` en `.env` con la URL que te den. |
| **Node.js** | Solo si usas `npm run dev:node` en lugar de Bun; no lo usa `scripts/windows/run.ps1`. |

## Archivos

```
scripts/
  README.md
  windows/
    setup.ps1
    run.ps1
  ubuntu/
    setup.sh
    run.sh
```

Los scripts antiguos de WSL/TF en `scripts/*.ps1` y `scripts/*.sh` (fuera de `windows/` / `ubuntu/`) no forman parte de este flujo.
