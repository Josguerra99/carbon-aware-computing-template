# Template del equipo (TypeScript)

Servidor de pronóstico del taller (puerto **3916**). El sitio del taller lo opera el facilitador; tú solo levantas este repo.

## Setup

Desde la raíz del repo. Crea `.env` si no existe, instala [Bun](https://bun.sh) si falta, ejecuta `bun install` y (Windows) añade una regla de firewall para el puerto del equipo en la **red privada** (solo LAN, no Internet).

**Windows**

```bat
scripts\windows\setup.cmd
```

Si la regla de firewall falla, abre **Símbolo del sistema como administrador** y vuelve a ejecutar setup, o manualmente:

```bat
scripts\windows\open-lan-firewall.cmd 3916
```

**Ubuntu**

```bash
bash scripts/ubuntu/setup.sh
```

Después de setup, edita `.env` y pon **`MAIN_SERVER_URL`** con la URL que te dé el facilitador. Regístrate en el sitio del taller (`/register`) con la IP de tu PC y el puerto **3916**. Marca la Wi‑Fi como red **Privada** en Windows.

## Run

Carga `.env` y arranca el servidor (`bun run dev`, recarga al guardar en `src/`).

**Windows**

```bat
scripts\windows\run.cmd
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
| **Firewall (LAN)** | `scripts\windows\open-lan-firewall.cmd 3916` (admin si hace falta) | Abre el puerto en `ufw` si usas firewall |

Arranque manual:

```bash
bun install
bun run dev
```
