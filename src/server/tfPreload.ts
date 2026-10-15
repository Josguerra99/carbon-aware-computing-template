/**
 * Load tfjs-node(-gpu) before any `import '@tensorflow/tfjs'` so Node does not print
 * the generic "install our node backend" banner (native bindings register here).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const raw = process.env.TFJS_BACKEND?.trim().toLowerCase();
const wantGpu = raw === "gpu" || (raw !== "cpu" && raw !== "tensorflow" && typeof Bun === "undefined");
const wantNative = raw === "tensorflow" || wantGpu;

if (raw === "cpu") {
  // Pure JS CPU; tfBackend will set backend later.
} else if (wantGpu) {
  try {
    require("@tensorflow/tfjs-node-gpu");
  } catch {
    try {
      require("@tensorflow/tfjs-node");
    } catch {
      // tfBackend falls back to tfjs-backend-cpu.
    }
  }
} else if (wantNative) {
  try {
    require("@tensorflow/tfjs-node");
  } catch {
    // tfBackend falls back.
  }
}
