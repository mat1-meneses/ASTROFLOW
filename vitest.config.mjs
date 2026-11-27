// Pruebas unitarias del backend Node y del módulo RAG (npm test / pnpm test en la raíz).
// Las del frontend tienen su propia configuración en frontend/vite.config.ts.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/**/*.test.mjs", "rag/**/*.test.mjs"],
    environment: "node",
    pool: "forks", // cada archivo en su propio proceso: las simulaciones de módulos no se mezclan
    fileParallelism: false, // las pruebas con BD comparten la base local
    testTimeout: 20000,
  },
});
