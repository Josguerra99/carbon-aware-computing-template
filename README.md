# Template del equipo (TypeScript)

Servidor de pronóstico del taller (puerto **3916**). El sitio del taller lo opera el facilitador; tú solo levantas este repo.

## Setup

Desde la raíz del repo. Crea `.env` si no existe, instala [Bun](https://bun.sh) si falta y ejecuta `bun install`.

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/setup.ps1
```

**Ubuntu**

```bash
bash scripts/ubuntu/setup.sh
```

Después de setup, edita `.env` y pon **`MAIN_SERVER_URL`** con la URL que te dé el facilitador. Regístrate en el sitio del taller (`/register`) con la IP de tu PC y el puerto **3916**.

## Run

Carga `.env` y arranca el servidor (`bun run dev`, recarga al guardar en `src/`).

**Windows**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/run.ps1
```

**Ubuntu**

```bash
bash scripts/ubuntu/run.sh
```

## Setup manual

Si no usas los scripts, instala tú mismo lo siguiente:

| Requisito | Windows | Ubuntu |
| --- | --- | --- |
| **Bun** | [bun.sh](https://bun.sh) o lo instala `setup.ps1` | `curl -fsSL https://bun.sh/install \| bash` o lo instala `setup.sh` |
| **Dependencias del proyecto** | `bun install` | `bun install` |
| **Config** | Copia `.env.example` → `.env` y ajusta `MAIN_SERVER_URL` | Igual |

Arranque manual:

```bash
bun install
bun run dev
```
