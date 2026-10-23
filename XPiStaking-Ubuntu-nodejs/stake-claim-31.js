const StellarSdk = require('@stellar/stellar-sdk');
const readline = require('readline');

// ================== CẤU HÌNH ==================
const HORIZON_URL = "https://horizon.stellar.org";
const SOROBAN_RPC_URL = "https://mainnet.sorobanrpc.com";
const CONTRACT_ID = "CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H";
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;
const MIN_STAKE_STROOPS = 314_000_000n; // 31.4 XLM
const FEE = "500000"; // 0.05 XLM inclusion – tăng nếu kẹt

const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const rpc = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function scAddress(pubkey) {
  return StellarSdk.nativeToScVal(pubkey, { type: "address" });
}

function scI128(n) {
  return StellarSdk.nativeToScVal(n, { type: "i128" });
}

/**
 * @param {string} secretKey
 * @param {string} functionName
 * @param {any[]} args - đã là ScVal
 * @param {boolean} readOnly - true = chỉ simulate, không submit
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
    // Trả về kết quả simulate (get_stake / pending)
    return sim;
  }

  const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();
  prepared.sign(keypair);

  const sent = await rpc.sendTransaction(prepared);
  console.log("Tx hash:", sent.hash);

  let status;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    status = await rpc.getTransaction(sent.hash);
    if (status.status !== "NOT_FOUND" && status.status !== "PENDING") break;
  }

  if (status.status === "SUCCESS") {
    console.log("✅ Thành công!");
    return status;
  }
  throw new Error("Giao dịch thất bại: " + status.status + " " + JSON.stringify(status));
}

async function main() {
  console.log("\n===== XPi Lock Staking (contract CDQ4OO3F...) =====\n");
  console.log("Min stake: 31.4 XLM | Reward ~0.0000003 XPi/day per 31 XLM\n");

  const secret = (await ask("Private key (S...): ")).trim();
  const keypair = StellarSdk.Keypair.fromSecret(secret);
  const pubkey = keypair.publicKey();
  console.log("Public Key:", pubkey);

  while (true) {
    console.log("\n1. Stake XLM (>= 31.4)");
    console.log("2. Unstake XLM (trống / 0 = rút hết)");
    console.log("3. Claim thưởng stake");
    console.log("4. Xem get_stake");
    console.log("5. Xem pending (ước tính on-chain)");
    console.log("6. Thoát");

    const choice = (await ask("Chọn (1-6): ")).trim();

    try {
      if (choice === "1") {
        const amountStr = await ask("Số XLM stake (min 31.4): ");
        const amount = BigInt(Math.floor(parseFloat(amountStr) * 10_000_000));
        if (amount < MIN_STAKE_STROOPS) {
          console.log("❌ Tối thiểu 31.4 XLM (314000000 stroops)");
          continue;
        }
        console.log("Đang stake...");
        await invokeContract(secret, "stake", [
          scAddress(pubkey),
          scI128(amount),
        ]);
      } else if (choice === "2") {
        const amountStr = (await ask("Số XLM unstake (Enter/0 = tất cả): ")).trim();
        let amount = 0n;
        if (amountStr !== "" && amountStr !== "0") {
          amount = BigInt(Math.floor(parseFloat(amountStr) * 10_000_000));
        }
        // Contract: amount <= 0 => unstake all
        console.log(amount <= 0n ? "Đang unstake TẤT CẢ..." : `Đang unstake ${amountStr} XLM...`);
        await invokeContract(secret, "unstake", [
          scAddress(pubkey),
          scI128(amount),
        ]);
      } else if (choice === "3") {
        console.log("Đang claim...");
        await invokeContract(secret, "claim", [scAddress(pubkey)]);
      } else if (choice === "4") {
        console.log("Đang get_stake (simulate)...");
        const sim = await invokeContract(secret, "get_stake", [scAddress(pubkey)], true);
        console.log("Simulation result:", JSON.stringify(sim.result ?? sim, null, 2));
      } else if (choice === "5") {
        console.log("Đang pending (simulate)...");
        const sim = await invokeContract(secret, "pending", [scAddress(pubkey)], true);
        console.log("Pending (raw):", JSON.stringify(sim.result ?? sim, null, 2));
      } else if (choice === "6") {
        console.log("Bye!");
        break;
      } else {
        console.log("Không hợp lệ");
      }
    } catch (err) {
      console.error("❌", err.message || err);
    }
  }

  rl.close();
}

main();