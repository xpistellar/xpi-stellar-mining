package com.xpi.staking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.soneso.stellar.sdk.Asset
import com.soneso.stellar.sdk.AssetTypeNative
import com.soneso.stellar.sdk.ChangeTrustOperation
import com.soneso.stellar.sdk.MemoText
import com.soneso.stellar.sdk.PaymentOperation
import com.soneso.stellar.sdk.TransactionBuilder
import com.soneso.stellar.sdk.KeyPair
import com.soneso.stellar.sdk.Network
import com.soneso.stellar.sdk.contract.ContractClient
import com.soneso.stellar.sdk.horizon.HorizonServer
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import kotlin.math.max

data class StakingContract(
    val name: String,
    val contractId: String,
    val minStakeXlm: Double
)

object ContractRegistry {
    val contracts = listOf(
        StakingContract(
            name = "XPi Lock (min 31.4 XLM)",
            contractId = "CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H",
            minStakeXlm = 31.4
        )
    )
}

data class TrackedAsset(val code: String, val issuer: String? = null)

object AssetRegistry {
    val assets = listOf(
        TrackedAsset("XLM", null),
        TrackedAsset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
        TrackedAsset("USDX", "GA5G7HKQBJ4PDKIVE53FOZPY3C7YZI5R4QTDQN3UKILQYME7KUL2CKKH"),
        TrackedAsset("XPi", "GDOFJEZ3FUWAC2EVHPRMJPSWPOD3KJF7FTXFZIERFFPB2VMTRQLZFUEF"),
        TrackedAsset("XGold", "GBLY3AFVRMBSLPPRLO5L5MQGH2IXN4BFA6F63IHUBOVOSSLEM2A2RAKO"),
        TrackedAsset("XCu", "GDJDDSR66DY4CUCTBPT7S2PQ2ZGDP5GMBEKT66FOM2QPXX44Y6CZMEGD"),
        TrackedAsset("XAg", "GBFEZWKWLACWPX6LQQEMWVA5JRZYOIGM2QV7XZJM7LXN3D3REQJ5BGIW"),
        TrackedAsset("XLTC", "GD2ZUTTY7KI7MBRQ2WW6KVKJJNF36P2QRSMPZF4F3YKGEWEUIIEVUQHH"),
        TrackedAsset("XDOGE", "GBJ3K5NBPLTTYYA45LC7EY2MSBAJWDG7HP3ARJVDWMVDAD6QEJUU52JF"),
        TrackedAsset("XBTC", "GCKJ2AWYJHF2Y2WHCZYST6QXGNTWQXNZTKUSP5F3HPMJIDD6MY6AAAI3")
    )
}

class StakingViewModel : ViewModel() {

    private val RPC_URL = "https://mainnet.sorobanrpc.com"
    private val HORIZON_URL = "https://horizon.stellar.org"
    private val NETWORK = Network.PUBLIC

    // 31.4 XLM -> 0.0000003 XPi / day  => per second
    private val BASE_XLM = 31.4
    private val BASE_XPI_PER_DAY = 0.0000003

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState

    private var keyPair: KeyPair? = null
    private var publicKey: String? = null

    private val _selectedContract = MutableStateFlow(ContractRegistry.contracts.first())
    val selectedContract: StateFlow<StakingContract> = _selectedContract

    private val _balances = MutableStateFlow<Map<String, String>>(emptyMap())
    val balances: StateFlow<Map<String, String>> = _balances

    private val _pending = MutableStateFlow("—")
    val pending: StateFlow<String> = _pending

    /** Staked XLM from get_stake (stroops -> xlm) for display counter */
    private val _stakedXlm = MutableStateFlow(0.0)
    val stakedXlm: StateFlow<Double> = _stakedXlm

    /** Fake smooth counter for UX */
    private val _displayMined = MutableStateFlow(0.0)
    val displayMined: StateFlow<Double> = _displayMined

    private var tickerJob: Job? = null

    /** Temporary secret shown once after Create wallet */
    private val _createdSecret = MutableStateFlow<String?>(null)
    val createdSecret: StateFlow<String?> = _createdSecret

    private val _qrBitmap = MutableStateFlow<Bitmap?>(null)
    val qrBitmap: StateFlow<Bitmap?> = _qrBitmap

    fun selectContract(c: StakingContract) {
        _selectedContract.value = c
    }

    fun login(secret: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UiState.Loading("...")
                val kp = KeyPair.fromSecretSeed(secret.trim())
                keyPair = kp
                publicKey = kp.getAccountId()
                _uiState.value = UiState.LoggedIn(publicKey!!)
                refreshAll()
                startTicker()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun refreshAll() {
        refreshBalances()
        refreshPending()
        refreshStakeAmount()
    }

    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = viewModelScope.launch {
            while (isActive) {
                val staked = _stakedXlm.value
                if (staked >= BASE_XLM) {
                    val perSecond = (staked / BASE_XLM) * BASE_XPI_PER_DAY / 86400.0
                    _displayMined.value += perSecond
                }
                delay(1000)
            }
        }
    }

    fun refreshBalances() {
        viewModelScope.launch {
            try {
                val pk = publicKey ?: return@launch
                val horizon = HorizonServer(HORIZON_URL)
                val account = horizon.accounts().account(pk)
                val result = linkedMapOf<String, String>()
                for (tracked in AssetRegistry.assets) {
                    val bal = if (tracked.issuer == null) {
                        account.balances.firstOrNull { it.assetType == "native" }?.balance
                    } else {
                        account.balances.firstOrNull {
                            it.assetType != "native" &&
                                it.assetCode == tracked.code &&
                                it.assetIssuer == tracked.issuer
                        }?.balance
                    } ?: "0"
                    val formatted = try {
                        BigDecimal(bal).setScale(6, RoundingMode.DOWN)
                            .stripTrailingZeros().toPlainString()
                    } catch (_: Exception) {
                        bal
                    }
                    if (tracked.code == "XLM" || formatted != "0") {
                        result[tracked.code] = formatted
                    }
                }
                _balances.value = result
                horizon.close()
            } catch (e: Exception) {
                _balances.value = mapOf("Error" to (e.message ?: "?"))
            }
        }
    }

    fun refreshPending() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: return@launch
                val client = contractClient()
                val p = client.invoke<Any?>(
                    functionName = "pending",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                _pending.value = p?.toString() ?: "0"
            } catch (_: Exception) {
                _pending.value = "—"
            }
        }
    }

    fun refreshStakeAmount() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: return@launch
                val client = contractClient()
                val result = client.invoke<Any?>(
                    functionName = "get_stake",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                // Best-effort parse amount from string result
                val text = result?.toString() ?: ""
                val amount = Regex("""amount[^\d-]*(-?\d+)""").find(text)?.groupValues?.get(1)
                    ?: Regex("""(\d{6,})""").find(text)?.groupValues?.get(1)
                if (amount != null) {
                    val stroops = amount.toLongOrNull() ?: 0L
                    _stakedXlm.value = max(0.0, stroops / 10_000_000.0)
                } else if (text.contains("None", true) || text.isBlank()) {
                    _stakedXlm.value = 0.0
                }
            } catch (_: Exception) {
                // keep previous
            }
        }
    }

    fun stake(amountXlm: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val contract = _selectedContract.value
                val amount = parseXlmToStroops(amountXlm)
                val minStroops = BigInteger.valueOf((contract.minStakeXlm * 10_000_000).toLong())
                if (amount < minStroops) throw Exception("Min ${contract.minStakeXlm} XLM")
                _uiState.value = UiState.Loading("Staking...")
                val client = contractClient()
                client.invoke<Unit>(
                    functionName = "stake",
                    arguments = mapOf("user" to kp.getAccountId(), "amount" to amount),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Stake OK")
                refreshAll()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun unstake(amountXlm: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val amount = if (amountXlm.isBlank()) BigInteger.ZERO else parseXlmToStroops(amountXlm)
                _uiState.value = UiState.Loading("Unstaking...")
                val client = contractClient()
                client.invoke<Unit>(
                    functionName = "unstake",
                    arguments = mapOf("user" to kp.getAccountId(), "amount" to amount),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Unstake OK")
                refreshAll()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun claim() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Claiming...")
                val client = contractClient()
                client.invoke<Unit>(
                    functionName = "claim",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _displayMined.value = 0.0
                _uiState.value = UiState.Success("Claim OK")
                refreshAll()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun getStake() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("...")
                val client = contractClient()
                val result = client.invoke<Any?>(
                    functionName = "get_stake",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                refreshStakeAmount()
                _uiState.value = UiState.StakeInfo(result?.toString() ?: "None")
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    private suspend fun contractClient(): ContractClient {
        return ContractClient.forContract(
            contractId = _selectedContract.value.contractId,
            rpcUrl = RPC_URL,
            network = NETWORK
        )
    }

    private fun parseXlmToStroops(xlm: String): BigInteger {
        val value = xlm.trim().toDoubleOrNull() ?: throw Exception("Invalid amount")
        return BigInteger.valueOf((value * 10_000_000).toLong())
    }


    /** Generate a new Stellar keypair (not funded). User must save secret. */
    fun createWallet() {
        viewModelScope.launch {
            try {
                _uiState.value = UiState.Loading("Creating wallet...")
                val kp = KeyPair.random()
                val secret = try {
                    String(kp.secretSeed)
                } catch (_: Exception) {
                    // some SDK builds expose secretSeed differently
                    kp.secretSeed?.let { String(it) } ?: throw Exception("Cannot read secret seed")
                }
                keyPair = kp
                publicKey = kp.getAccountId()
                _createdSecret.value = secret
                _uiState.value = UiState.WalletCreated(
                    publicKey = publicKey!!,
                    secretKey = secret
                )
                generateReceiveQr()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("Create wallet: ${e.message}")
            }
        }
    }

    fun confirmWalletSaved() {
        val pk = publicKey ?: return
        _createdSecret.value = null
        _uiState.value = UiState.LoggedIn(pk)
        refreshAll()
        startTicker()
    }

    fun ensureXpiTrustline() {
        viewModelScope.launch {
            try {
                val key = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Creating XPi trustline...")
                val server = HorizonServer(HORIZON_URL)
                val account = server.loadAccount(key.getAccountId())
                val asset = Asset.createNonNativeAsset(
                    "XPi",
                    "GDOFJEZ3FUWAC2EVHPRMJPSWPOD3KJF7FTXFZIERFFPB2VMTRQLZFUEF"
                )
                val tx = TransactionBuilder(account, NETWORK)
                    .setBaseFee(100_000)
                    .addOperation(ChangeTrustOperation(asset, "922337203685.4775807"))
                    .setTimeout(180)
                    .build()
                tx.sign(key)
                val res = server.submitTransaction(tx.toEnvelopeXdrBase64())
                server.close()
                _uiState.value = UiState.Success("XPi trustline OK: ${res.hash}")
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("Trustline: ${e.message}")
            }
        }
    }

    /**
     * Send native XLM or issued asset.
     * @param assetCode "XLM" or tracked code from AssetRegistry
     */
    fun sendPayment(destination: String, amount: String, assetCode: String = "XLM", memo: String = "") {
        viewModelScope.launch {
            try {
                val key = keyPair ?: throw Exception("Not logged in")
                val dest = destination.trim()
                if (!dest.startsWith("G") || dest.length != 56) {
                    throw Exception("Invalid destination G...")
                }
                val amt = amount.trim().toDoubleOrNull()
                    ?: throw Exception("Invalid amount")
                if (amt <= 0) throw Exception("Amount must be > 0")

                _uiState.value = UiState.Loading("Sending $amt $assetCode...")
                val server = HorizonServer(HORIZON_URL)
                val account = server.loadAccount(key.getAccountId())

                val asset = if (assetCode == "XLM") {
                    AssetTypeNative
                } else {
                    val tracked = AssetRegistry.assets.firstOrNull { it.code == assetCode && it.issuer != null }
                        ?: throw Exception("Unknown asset $assetCode")
                    Asset.createNonNativeAsset(tracked.code, tracked.issuer!!)
                }

                val builder = TransactionBuilder(account, NETWORK)
                    .setBaseFee(100_000)
                    .addOperation(
                        PaymentOperation(
                            destination = dest,
                            asset = asset,
                            amount = String.format(java.util.Locale.US, "%.7f", amt)
                        )
                    )
                    .setTimeout(180)
                val m = memo.trim()
                if (m.isNotEmpty()) {
                    builder.addMemo(MemoText(m.take(28)))
                }
                val tx = builder.build()
                tx.sign(key)
                val res = server.submitTransaction(tx.toEnvelopeXdrBase64())
                server.close()
                _uiState.value = UiState.Success("Sent $amt $assetCode\nTx: ${res.hash}")
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("Send: ${e.message}")
            }
        }
    }

    fun generateReceiveQr() {
        val pk = publicKey ?: return
        try {
            val size = 512
            val hints = mapOf(EncodeHintType.MARGIN to 1)
            val bitMatrix = QRCodeWriter().encode(pk, BarcodeFormat.QR_CODE, size, size, hints)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bmp.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
                }
            }
            _qrBitmap.value = bmp
        } catch (e: Exception) {
            _qrBitmap.value = null
        }
    }


    fun clearMessage() {
        if (_uiState.value is UiState.Success ||
            _uiState.value is UiState.Error ||
            _uiState.value is UiState.StakeInfo
        ) {
            _uiState.value = UiState.LoggedIn(publicKey ?: "")
        }
    }

    fun logout() {
        tickerJob?.cancel()
        keyPair = null
        publicKey = null
        _balances.value = emptyMap()
        _pending.value = "—"
        _stakedXlm.value = 0.0
        _displayMined.value = 0.0
        _uiState.value = UiState.Idle
    }

    sealed class UiState {
        object Idle : UiState()
        data class Loading(val message: String) : UiState()
        data class LoggedIn(val publicKey: String) : UiState()
        data class Success(val message: String) : UiState()
        data class Error(val message: String) : UiState()
        data class StakeInfo(val info: String) : UiState()
    }
}
