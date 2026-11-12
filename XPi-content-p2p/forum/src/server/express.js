import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../public");

export function createHttp(port) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(express.static(root));
  return { app, listen: () => app.listen(port, "0.0.0.0") };
}
