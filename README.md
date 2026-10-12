# Template del equipo (TypeScript)

Servidor de pronóstico del taller (puerto **3916**). El sitio del taller lo opera el facilitador; tú solo levantas este repo.

## Setup

Desde la raíz del repo:

**Windows**

```bat
scripts\windows\setup.cmd
```

**Ubuntu**

```bash
bash scripts/ubuntu/setup.sh
```

Luego edita `.env` y pon **`MAIN_SERVER_URL`** con la URL del facilitador. Regístrate en el taller (`/register`) con la IP de tu PC.

## Run

**Windows**

```bat
scripts\windows\run.cmd
```

**Ubuntu**

```bash
bash scripts/ubuntu/run.sh
```

## Windows y la LAN del taller

**`run.cmd`**: primero el **aviso** (Wi‑Fi privada, Permitir en el popup de Windows), luego **abre el puerto un momento** la primera vez para forzar ese aviso de **Defender**, después corrige **Block** en privada solo si hace falta (**UAC**). Borra `.local\lan-defender-ok` si quieres repetir el aviso forzado.

Opcional (admin): `scripts\windows\open-lan-firewall.cmd 3916`

## Setup manual

El script de setup hace: crear `.env` si no existe, instalar [Bun](https://bun.sh) si falta y `bun install`.

Si lo haces a mano:

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
