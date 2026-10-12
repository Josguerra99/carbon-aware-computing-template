import { accessSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import * as tf from "@tensorflow/tfjs";

let backendReady: Promise<string> | null = null;

function cuda11RuntimeOnPath(): boolean {
  const ld = process.env.LD_LIBRARY_PATH ?? "";
  for (const dir of ld.split(/[:;]/).filter(Boolean)) {
    try {
      accessSync(join(dir, "libcudart.so.11.0"));
      return true;
    } catch {
      // try next dir
    }
  }
  try {
    const listing = execSync("ldconfig -p 2>/dev/null || true", { encoding: "utf8" });
    return listing.includes("libcudart.so.11");
  } catch {
    return false;
  }
}

function backendPreference(): "gpu" | "tensorflow" | "cpu" {
  const raw = process.env.TFJS_BACKEND?.trim().toLowerCase();
  if (raw === "gpu" || raw === "tensorflow") {
    return raw === "gpu" ? "gpu" : "tensorflow";
  }
  if (raw === "cpu") {
    return "cpu";
  }
  // Default under Node: try GPU package, then CPU native, then pure JS.
  return typeof Bun === "undefined" ? "gpu" : "cpu";
}

async function tryNativeBackend(kind: "gpu" | "tensorflow"): Promise<boolean> {
  try {
    if (kind === "gpu") {
      await import("@tensorflow/tfjs-node-gpu");
    } else {
      await import("@tensorflow/tfjs-node");
    }
    return await tf.setBackend("tensorflow");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`TensorFlow.js native backend (${kind}) unavailable: ${message}`);
    return false;
  }
}

async function tryCpuJsBackend(): Promise<boolean> {
  await import("@tensorflow/tfjs-backend-cpu");
  return await tf.setBackend("cpu");
}

async function activateBackend(): Promise<string> {
  const preference = backendPreference();

  if (preference === "gpu") {
    if (await tryNativeBackend("gpu")) {
      await tf.ready();
      return tf.getBackend();
    }
    if (await tryNativeBackend("tensorflow")) {
      await tf.ready();
      console.warn("TFJS_BACKEND=gpu but tfjs-node-gpu missing; using @tensorflow/tfjs-node (CPU native).");
      return tf.getBackend();
    }
  } else if (preference === "tensorflow") {
    if (await tryNativeBackend("tensorflow")) {
      await tf.ready();
      return tf.getBackend();
    }
  }

  if (preference !== "cpu") {
    console.warn("Falling back to TensorFlow.js pure-CPU backend (slow). Use Node 20 + npm run setup:tf for native speed.");
  }

  if (await tryCpuJsBackend()) {
    await tf.ready();
    return tf.getBackend();
  }

  throw new Error("No TensorFlow.js backend could be initialized");
}

/** Registers tfjs-node(-gpu) when installed; otherwise tfjs-backend-cpu. */
export async function ensureTfBackend(): Promise<string> {
  if (!backendReady) {
    backendReady = activateBackend().then((name) => {
      const pkg =
        process.env.TFJS_BACKEND?.toLowerCase() === "gpu" ||
        (process.env.TFJS_BACKEND == null && typeof Bun === "undefined")
          ? "tfjs-node-gpu"
          : "tfjs-node / tfjs-backend-cpu";
      console.log(
        `TensorFlow.js backend: ${name}${name === "tensorflow" ? " (native C++)" : ""} [${pkg}]`,
      );
      if (name === "tensorflow" && pkg === "tfjs-node-gpu") {
        if (cuda11RuntimeOnPath()) {
          console.log(
            "CUDA 11 runtime on LD_LIBRARY_PATH (pip venv or system). Watch startup logs for 'Created device ... GPU:0' — first run on new GPUs may JIT-compile CUDA kernels (can take a while).",
          );
        } else {
          console.warn(
            "GPU package loaded but CUDA 11 is not on the library path (libcudart.so.11 missing). Training uses native TensorFlow on CPU until you install CUDA 11.8 + cuDNN 8 in WSL: bash scripts/wsl-install-cuda11-tfjs.sh",
          );
        }
      }
      return name;
    });
  }
  return backendReady;
}
