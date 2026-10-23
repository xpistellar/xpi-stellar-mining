// ================== CẤU HÌNH ==================
const HORIZON_URL = "https://horizon.stellar.org";
const SOROBAN_RPC_URL = "https://mainnet.sorobanrpc.com";
const CONTRACT_ID = "CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H";
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
const MIN_STAKE_STROOPS = 314000000n; // 31.4 XLM
const FEE = "500000"; // 0.05 XLM

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const rpc = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

// ================== UI HELPERS ==================
const logEl = document.getElementById("log");
const secretInput = document.getElementById("secret");
const amountSection = document.getElementById("amountSection");
const amountInput = document.getElementById("amount");
const amountHint = document.getElementById("amountHint");

let currentAction = null; // "stake" | "unstake"

function log(msg, type = "info") {
  const time = new Date().toLocaleTimeString();
  const line = document.createElement("div");
  line.className = type;
  line.textContent = `[${time}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  logEl.innerHTML = "";
}

function getSecret() {
  const secret = secretInput.value.trim();
  if (!secret.startsWith("S") || secret.length < 50) {
    throw new Error("Private key không hợp lệ (phải bắt đầu bằng S)");
  }
  return secret;
}

function showAmountInput(action) {
  currentAction = action;
  amountSection.style.display = "block";
  amountInput.value = "";
  if (action === "stake") {
    amountHint.textContent = "Tối thiểu 31.4 XLM";
    amountInput.placeholder = "31.4";
  } else {
    amountHint.textContent = "Để trống hoặc 0 = rút hết";
    amountInput.placeholder = "0 = tất cả";
  }
  amountInput.focus();
}

function hideAmountInput() {
  amountSection.style.display = "none";
  currentAction = null;
}

// ================== STELLAR HELPERS ==================
function scAddress(pubkey) {
  return StellarSdk.nativeToScVal(pubkey, { type: "address" });
}

function scI128(n) {
  return StellarSdk.nativeToScVal(n, { type: "i128" });
}

/**
 * Gọi contract (giống bản Node.js)
 */
async function invokeContract(secretKey, functionName, args = [], readOnly = false) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const operation = contract.call(functionName, ...args);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(120)
    .build();

  const sim = await rpc.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error("Simulation failed: " + JSON.stringify(sim.error || sim));
  }

  if (readOnly) {
    return sim;
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const sent = await rpc.sendTransaction(prepared);
  log("Tx hash: " + sent.hash, "info");

  // Đợi kết quả
  let status;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await rpc.getTransaction(sent.hash);
    if (status.status !== "NOT_FOUND" && status.status !== "PENDING") break;
  }

  if (status.status === "SUCCESS") {
    log("✅ Thành công!", "success");
    return status;
  }
  throw new Error("Giao dịch thất bại: " + status.status + " " + JSON.stringify(status));
}

// ================== ACTIONS ==================
async function doStake(amountXlm) {
  const secret = getSecret();
  const amount = BigInt(Math.floor(parseFloat(amountXlm) * 10_000_000));
  if (amount < MIN_STAKE_STROOPS) {
    throw new Error("Tối thiểu 31.4 XLM");
  }
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  log(`Đang stake ${amountXlm} XLM...`, "info");
  await invokeContract(secret, "stake", [
    scAddress(keypair.publicKey()),
    scI128(amount),
  ]);
}

async function doUnstake(amountXlm) {
  const secret = getSecret();
  let amount = 0n;
  if (amountXlm && amountXlm !== "0") {
    amount = BigInt(Math.floor(parseFloat(amountXlm) * 10_000_000));
  }
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  log(amount <= 0n ? "Đang unstake TẤT CẢ..." : `Đang unstake ${amountXlm} XLM...`, "info");
  await invokeContract(secret, "unstake", [
    scAddress(keypair.publicKey()),
    scI128(amount),
  ]);
}

async function doClaim() {
  const secret = getSecret();
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  log("Đang claim...", "info");
  await invokeContract(secret, "claim", [scAddress(keypair.publicKey())]);
}

async function doGetStake() {
  const secret = getSecret();
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  log("Đang get_stake (simulate)...", "info");
  const sim = await invokeContract(secret, "get_stake", [scAddress(keypair.publicKey())], true);
  log("Kết quả get_stake:\n" + JSON.stringify(sim.result ?? sim, null, 2), "success");
}

async function doPending() {
  const secret = getSecret();
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  log("Đang pending (simulate)...", "info");
  const sim = await invokeContract(secret, "pending", [scAddress(keypair.publicKey())], true);
  log("Pending (raw):\n" + JSON.stringify(sim.result ?? sim, null, 2), "success");
}

// ================== EVENT LISTENERS ==================
document.getElementById("toggleSecret").addEventListener("click", () => {
  secretInput.type = secretInput.type === "password" ? "text" : "password";
});

document.getElementById("btnStake").addEventListener("click", () => showAmountInput("stake"));
document.getElementById("btnUnstake").addEventListener("click", () => showAmountInput("unstake"));

document.getElementById("btnClaim").addEventListener("click", async () => {
  try {
    await doClaim();
  } catch (e) {
    log("❌ " + (e.message || e), "error");
  }
});

document.getElementById("btnGetStake").addEventListener("click", async () => {
  try {
    await doGetStake();
  } catch (e) {
    log("❌ " + (e.message || e), "error");
  }
});

document.getElementById("btnPending").addEventListener("click", async () => {
  try {
    await doPending();
  } catch (e) {
    log("❌ " + (e.message || e), "error");
  }
});

document.getElementById("btnConfirm").addEventListener("click", async () => {
  try {
    const val = amountInput.value.trim();
    if (currentAction === "stake") {
      if (!val) throw new Error("Vui lòng nhập số lượng");
      await doStake(val);
    } else if (currentAction === "unstake") {
      await doUnstake(val);
    }
    hideAmountInput();
  } catch (e) {
    log("❌ " + (e.message || e), "error");
  }
});

document.getElementById("btnCancel").addEventListener("click", hideAmountInput);
document.getElementById("btnClearLog").addEventListener("click", clearLog);

// Khởi tạo
log("Sẵn sàng. Nhập Private Key rồi chọn chức năng.", "info");
