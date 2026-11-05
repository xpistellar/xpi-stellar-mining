import { config, signalingWsUrl } from "./utils/config.js";
import { log } from "./utils/logger.js";
import { ensureDisk } from "./storage/disk.js";
import { createHttp } from "./server/express.js";
import { mountRoutes } from "./server/routes.js";

const session = { diskKey: "local-dev-key", keypair: null, publicKey: null, balance: "0" };

ensureDisk(config.diskPath, session.diskKey);

const { app, listen } = createHttp(config.port);
mountRoutes(app, { session });

listen().on("error", (error) => {
  log("node", error.message);
  process.exit(1);
});
log("node", `forum on http://0.0.0.0:${config.port} id=${config.nodeId}`);
log("node", `signaling ${signalingWsUrl()} contract=${config.contractId || "unset"}`);
