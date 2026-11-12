import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { config, signalingWsUrl, applyNetworkIdentity } from "./utils/config.js";
import { log } from "./utils/logger.js";
import { createHttp } from "./server/express.js";
import { mountRoutes } from "./server/routes.js";
import { writePublicBoard } from "./storage/public-board.js";
import {
  isSetupComplete,
  completeSetup,
  updateSignalingUrls,
} from "./network/identity.js";
import { OFFICIAL_MESH, officialSignalingList } from "./network/defaults.js";

/**
 * Do NOT pre-create the encrypted virtual disk with a placeholder key.
 * Disk is AES-GCM sealed by the Stellar secret at first login.
 */
const session = { diskKey: null, keypair: null, publicKey: null, balance: "0" };

try {
  mkdirSync(dirname(config.diskPath || "./data/network-data.disk"), { recursive: true });
} catch {
  /* */
}

/**
 * First boot: join the official XPi Stellar Forum mesh (hash + public signaling).
 * Skip if network-identity.sealed already exists, or SKIP_DEFAULT_MESH=1.
 * Fork: delete data/network-identity.sealed then use UI “Create network”.
 */
function ensureOfficialMesh() {
  if (isSetupComplete()) return false;
  if (process.env.SKIP_DEFAULT_MESH === "1" || process.env.SKIP_DEFAULT_MESH === "true") {
    log("node", "SKIP_DEFAULT_MESH set — not auto-joining official mesh");
    return false;
  }
  const suffix = randomBytes(2).toString("hex");
  const identity = completeSetup({
    mode: "join",
    nodeName: `${OFFICIAL_MESH.nodeNamePrefix}-${suffix}`,
    networkHash: OFFICIAL_MESH.networkHash,
    networkLabel: OFFICIAL_MESH.networkLabel,
    signalingUrl: officialSignalingList()[0] || OFFICIAL_MESH.signalingUrl,
  });
  let finalId = identity;
  try {
    finalId = updateSignalingUrls(officialSignalingList()) || identity;
  } catch {
    /* primary already set */
  }
  applyNetworkIdentity(finalId);
  log(
    "node",
    `joined official mesh ${identity.networkShort} · signal ${identity.signalingUrl} · node ${identity.nodeName}`
  );
  return true;
}

try {
  ensureOfficialMesh();
} catch (e) {
  log("node", "default mesh: " + (e.message || e));
}

try {
  writePublicBoard();
} catch (e) {
  log("node", "public board: " + (e.message || e));
}

const { app, listen } = createHttp(config.port);
mountRoutes(app, { session });

listen().on("error", (error) => {
  log("node", error.message);
  process.exit(1);
});
log("node", `forum on http://0.0.0.0:${config.port} id=${config.nodeId}`);
log("node", `signaling ${signalingWsUrl()} contract=${config.contractId || "unset"}`);
log(
  "node",
  `mesh ${config.networkShort || OFFICIAL_MESH.networkShort || "?"} · ${OFFICIAL_MESH.networkLabel}`
);
