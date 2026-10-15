# Template del equipo (TypeScript)

Servidor de pronóstico del taller (puerto **3916**). El sitio del taller lo opera el facilitador; tú solo levantas este repo.

**Modelos de ejemplo:** van en `src/workshop/` (gitignored, como en las plantillas Python/Java). Copia soluciones ahí en local; en git solo vive `src/main.ts` con `MyPredictionModel`.

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

**`run.cmd`** arranca el servidor. Si el facilitador no alcanza tu PC (timeout ~21 s) pero `http://localhost:3916` sí responde:

```bat
scripts\windows\run.cmd --fix-permissions
```

Pide **UAC**, corrige **Block** de **bun.exe** en red privada y aplica reglas Allow; luego arranca igual. Wi‑Fi **Private**; si Windows pregunta al arrancar, **Permitir** en redes privadas.

## Setup manual

El script de setup hace: crear `.env` si no existe, instalar [Bun](https://bun.sh) si falta y `bun install`.

Si lo haces a mano:

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

## TensorFlow.js en WSL (GPU) + proxy LAN

Para modelos TF del taller (`tfjs-node-gpu`), el servidor Node corre en **WSL**; Windows publica **:3916** con un proxy TCP (el sitio en **:3915** llama a tu PC en ese puerto).

| Pieza | Dónde |
| --- | --- |
| Servidor TF + nodemon | WSL → `scripts/start-wsl-tf.sh` |
| Proxy LAN :3916 → WSL :3917 | Windows → `scripts/win-team-proxy.py` |
| Orquestación (proxy + WSL) | `npm run start:wsl` o `scripts\windows\start-wsl-tf.cmd` |
| Sitio + proxy + WSL | `npm run start:wsl:stack` o `scripts\windows\start-wsl-stack.cmd` |

### Instalar WSL en Windows (primera vez)

Si al instalar Ubuntu (o al correr `npm run setup:wsl`) ves **`WslRegisterDistribution failed with error: 0x80370114`** o *The operation could not be started because a required feature is not installed*, faltan las características opcionales de Windows (**Windows Subsystem for Linux** y **Virtual Machine Platform**).

Desde la raíz del repo, en **PowerShell o CMD como administrador** (o acepta el **UAC** cuando el script lo pida):

```bat
scripts\windows\setup-wsl-features.cmd
```

Equivalente: `npm run setup:wsl:host`

El script:

1. Activa **WSL** y **Virtual Machine Platform**.
2. Si Windows pide **reinicio**, reinicia y luego:

   ```bat
   scripts\windows\setup-wsl-features.cmd -PostReboot
   ```

3. Actualiza WSL, pone la versión por defecto en **2** e instala **Ubuntu** (si aún no tienes ninguna distro).

Opcional:

| Flag | Uso |
| --- | --- |
| `-PostReboot` | Solo después de reiniciar (pasos 3 en adelante). |
| `-NoDistroInstall` | Activa características / actualiza WSL sin instalar Ubuntu. |
| `-Distro Debian` | Instala otra distro en lugar de Ubuntu. |

Cuando `wsl -l -v` muestre tu distro, continúa con el setup del proyecto en WSL (ejecuta en **CMD o PowerShell en Windows**, no hace falta entrar a Ubuntu):

```bat
scripts\windows\setup-wsl-tf.cmd
```

Los `.cmd` usan `powershell -NoProfile` para evitar errores del perfil (p. ej. Terminal-Icons / PowerShell 7 en Windows PowerShell 5.1).

### Setup TensorFlow.js + CUDA 11 en WSL (GPU)

Orden recomendado desde la raíz del repo (**Windows**, CMD o PowerShell):

| Paso | Comando | Qué hace |
| --- | --- | --- |
| 1 | `scripts\windows\setup.cmd` | Bun, `.env`, dependencias del sitio en Windows. |
| 2 | `scripts\windows\setup-wsl-features.cmd` | Solo si WSL aún no funciona (ver arriba). |
| 3 | `scripts\windows\setup-wsl-tf.cmd` | Lanza el setup **dentro de WSL**: Node 20, `tfjs-node-gpu`, **venv pip con CUDA 11 + cuDNN 8** (`.venv-tfjs-cuda`), smoke test, `.env` con `TFJS_BACKEND=gpu`. |

Equivalente npm (también con `-NoProfile`): `npm run setup:wsl`.

**Requisitos de hardware / drivers**

- GPU NVIDIA en el PC.
- **Driver NVIDIA para Windows** con soporte WSL ([documentación NVIDIA](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)). Reinicia Windows tras instalar o actualizar el driver.
- En Ubuntu (WSL), debe funcionar:

  ```bash
  nvidia-smi
  ```

  Si falla, arregla el driver en Windows antes de seguir; `nvidia-smi` en WSL no basta para TensorFlow: hace falta que Node encuentre **CUDA 11** (`libcudart.so.11`) y **cuDNN 8** — el setup del repo los instala en el venv pip.

**Python en WSL:** solo para instalar librerías CUDA vía pip (no ejecutas Python en el taller). El script crea el venv en **`~/.local/share/tfjs-cuda-venv/...`** si el repo está en `/mnt/c/...` (en el disco de Windows los venv de Linux suelen romperse). Si falta `ensurepip`, corre `sudo apt install` (`python3-venv`, `pythonX.Y-venv`). Override: `TFJS_CUDA_VENV=/ruta/venv`.

**CUDA extra o reintento** (descarga grande de wheels NVIDIA):

```bat
scripts\windows\setup-wsl-cuda.cmd
```

Alternativa con toolkit en el sistema (sudo/apt): ver `scripts/wsl-install-cuda11-tfjs.sh`.

**Comprobar que el backend GPU carga** (en WSL, desde la raíz del repo):

```bash
bash scripts/smoke-tfjs-gpu.sh
```

Si el smoke test avisa por `libcudart.so.11`, el entrenamiento sigue en **CPU nativo** (más rápido que Bun/JS, pero sin CUDA). Tras arreglar librerías:

```bash
npm rebuild @tensorflow/tfjs-node-gpu
```

**Importante:** no ejecutes `npm install` / `bun install` de dependencias nativas TF **en Windows** si desarrollas en WSL — sustituye los `.node` de Linux. Instala y rebuild solo en WSL.

Variables útiles en `.env` (el setup WSL las ajusta):

| Variable | Valor típico (GPU) |
| --- | --- |
| `TFJS_BACKEND` | `gpu` (usa `@tensorflow/tfjs-node-gpu`; si falla, cae a CPU nativo) |
| `PORT` | `3916` (equipo en LAN; ver abajo con proxy WSL) |
| `MAIN_SERVER_URL` | URL del sitio del taller (puerto **3915**), resuelta hacia Windows desde WSL |

### Ejecutar con GPU (taller + proxy LAN)

Arquitectura al usar el stack completo:

```text
Sitio taller (:3915, Bun)  ←  MAIN_SERVER_URL
Servidor TF + nodemon      ←  WSL :3917 (GPU/CPU nativo)
Proxy LAN                  ←  Windows :3916 → WSL :3917
Registro / forecast        ←  facilitador llama a tu PC en :3916
```

**Opción recomendada (todo en uno):** sitio del taller + proxy + servidor TF en WSL con recarga al editar `src/`:

```bat
npm run start:wsl:stack
```

o:

```bat
scripts\windows\start-wsl-stack.cmd
```

Busca el repo hermano `carbon-aware-computing-website` al lado de esta plantilla y arranca `bun run dev` si `:3915` no responde. Si está en otra ruta:

```bat
set WORKSHOP_WEBSITE_PATH=C:\ruta\carbon-aware-computing-website
npm run start:wsl:stack
```

**Solo TF + proxy** (el sitio en `:3915` ya está corriendo):

```bat
npm run start:wsl
```

o `scripts\windows\start-wsl-tf.cmd`. Sin recarga automática: `scripts\windows\start-wsl-tf.cmd -NoReload`.

**Solo WSL** (sin proxy; el equipo escucha **3916** dentro de WSL, útil para pruebas locales):

```bash
cd /mnt/c/.../carbon-aware-computing-template   # tu ruta
source ~/.nvm/nvm.sh && nvm use 20
bash scripts/start-wsl-tf.sh
```

En la consola deberías ver `TFJS_BACKEND=gpu` y el puerto (`3917` con proxy Windows, `3916` sin proxy). Nodemon reinicia y reentrena al guardar cambios en `src/` (en repos bajo `/mnt/...` usa polling automático para ver saves desde el editor en Windows).

**Antes de registrarte en el taller**

1. `.env` con `MAIN_SERVER_URL` apuntando al sitio del facilitador (o `http://127.0.0.1:3915` si usas el sitio local).
2. Sitio accesible en **`0.0.0.0:3915`** (no solo `localhost` en Windows si WSL debe conectar).
3. `http://localhost:3916/api/health` responde en tu PC (proxy + servidor TF).
4. Si el facilitador no alcanza tu IP, revisa firewall: `scripts\windows\run.cmd --fix-permissions` (reglas para red privada).

**Resumen (`.cmd` en `scripts\windows\`)**

| Script | Uso |
| --- | --- |
| `setup-wsl-features.cmd` | Activar WSL en Windows |
| `setup-wsl-tf.cmd` | Node 20 + TF GPU + CUDA venv en WSL |
| `setup-wsl-cuda.cmd` | Reinstalar solo wheels CUDA/cuDNN en WSL |
| `start-wsl-stack.cmd` | Sitio :3915 + proxy :3916 + TF GPU en WSL |
| `start-wsl-tf.cmd` | Proxy :3916 + TF GPU (sitio ya arriba) |

Mismos pasos vía npm: `setup:wsl:host`, `setup:wsl`, `setup:wsl:cuda`, `start:wsl:stack`, `start:wsl`.
