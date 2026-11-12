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
import com.soneso.stellar.sdk.ManageBuyOfferOperation
import com.soneso.stellar.sdk.ManageSellOfferOperation
import com.soneso.stellar.sdk.Price
import org.json.JSONObject
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
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

/**
 * Contract addresses after upgrade (single source of truth = original Staking).
 * Updated from deployment:
 * VAULT / DIST / STAKING / REWARD / CONTENT / CLAIM_DEV / STAKING_LENDING
 */
object ContractAddresses {
    const val VAULT = "CBITFBHST6O5QCKVJ3T7G3FL4B76FHFRZXHRDNGMMIKBML7USIFXBXAT"
    const val DIST = "CC6NOS2KVU3FJMYRWERZED3DVJPJ3OGOZ67UZLE5LSCGUQQY5MERAMKI"
    const val STAKING = "CCFA55AIBV5JDU3T3D3GTKG5FVMNO2KFQYU56C52JR45I5IDSYBFMCHF"
    const val REWARD = "CBRHAIILS22DLJNHF2CMK7MLF6BVV27SXRT2SOFFCS3ZKJZJ5NMYCMZL"
    const val CONTENT = "CCENQ25MNJUENBZ3JTD7PESKYTCUT6E3XR535734VTKLN6AFJ473IQBV"
    const val CLAIM_DEV = "CC5K5A262IL2UQ77AV5CSF6MIXKAY3VYPIBRXHLBVLRSH23S7BTSN4MP"
    const val STAKING_LENDING = "CCB7IHYOBU4ZTRMATPKWFZDUZLHQ4R2RJCRXRRSR5HFK662U66HVJQ6Y"
}

object ContractRegistry {
    val contracts = listOf(
        StakingContract(
            name = "XPi Lock (min 31.4 XLM)",
            contractId = ContractAddresses.STAKING,
            minStakeXlm = 31.4
        )
    )
}

data class TrackedAsset(val code: String, val issuer: String? = null)

data class OrderLevel(val price: String, val amount: String)

data class OrderBookSnapshot(
    val bids: List<OrderLevel> = emptyList(),
    val asks: List<OrderLevel> = emptyList()
)

data class Candle(
    val time: Long,
    val open: Double,
    val high: Double,
    val low: Double,
    val close: Double,
    val volume: Double = 0.0
)

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

    /** asset code -> issuer account (null for XLM) */
    private val _assetIssuers = MutableStateFlow<Map<String, String?>>(emptyMap())
    val assetIssuers: StateFlow<Map<String, String?>> = _assetIssuers

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

    private val _referrer = MutableStateFlow<String?>("—")
    val referrer: StateFlow<String?> = _referrer

    private val _pendingReferral = MutableStateFlow("0")
    val pendingReferral: StateFlow<String> = _pendingReferral

    private val _qrBitmap = MutableStateFlow<Bitmap?>(null)
    val qrBitmap: StateFlow<Bitmap?> = _qrBitmap

    private val _orderBook = MutableStateFlow(OrderBookSnapshot())
    val orderBook: StateFlow<OrderBookSnapshot> = _orderBook

    private val _candles = MutableStateFlow<List<Candle>>(emptyList())
    val candles: StateFlow<List<Candle>> = _candles

    private val _chartTf = MutableStateFlow("1d")
    val chartTf: StateFlow<String> = _chartTf

    private val _chartStatus = MutableStateFlow("—")
    val chartStatus: StateFlow<String> = _chartStatus

    private val _dexPair = MutableStateFlow("XPi")
    val dexPair: StateFlow<String> = _dexPair

    private val _dexMidPrice = MutableStateFlow("—")
    val dexMidPrice: StateFlow<String> = _dexMidPrice

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
        refreshCanTrigger()
        refreshSavings()
        refreshXpiStaked()
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
                val issuers = linkedMapOf<String, String?>()
                // Always include native if present
                account.balances.firstOrNull { it.assetType == "native" }?.let {
                    result["XLM"] = it.balance
                    issuers["XLM"] = null
                }
                for (tracked in AssetRegistry.assets) {
                    if (tracked.issuer == null) continue
                    val bal = account.balances.firstOrNull {
                        it.assetType != "native" &&
                            it.assetCode == tracked.code &&
                            it.assetIssuer == tracked.issuer
                    }?.balance
                    if (bal != null) {
                        result[tracked.code] = bal
                        issuers[tracked.code] = tracked.issuer
                    }
                }
                // Any other balances on account
                for (b in account.balances) {
                    if (b.assetType == "native") continue
                    val code = b.assetCode ?: continue
                    if (code !in result) {
                        result[code] = b.balance
                        issuers[code] = b.assetIssuer
                    }
                }
                // Format numbers
                val formatted = linkedMapOf<String, String>()
                for ((k, v) in result) {
                    formatted[k] = try {
                        java.math.BigDecimal(v).setScale(6, java.math.RoundingMode.DOWN)
                            .stripTrailingZeros().toPlainString()
                    } catch (_: Exception) {
                        v
                    }
                }
                _balances.value = formatted
                _assetIssuers.value = issuers
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
                // New contract no longer has a separate pending() — pending is inside StakeInfo from get_stake
                val result = client.invoke<Any?>(
                    functionName = "get_stake",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                val text = result?.toString() ?: ""
                // Parse pending field from StakeInfo (amount, start_time, last_claim, pending)
                val pendingVal = Regex("""pending[^\d-]*(-?\d+)""", RegexOption.IGNORE_CASE)
                    .find(text)?.groupValues?.get(1)
                    ?: Regex("""pending[:=\s]+(-?\d+)""", RegexOption.IGNORE_CASE)
                        .find(text)?.groupValues?.get(1)
                if (pendingVal != null) {
                    val units = pendingVal.toLongOrNull() ?: 0L
                    // XPi uses 7 decimals (stroops-like): 1 XPi = 10_000_000 units
                    _pending.value = if (units == 0L) "0" else String.format(java.util.Locale.US, "%.7f", units / 10_000_000.0)
                } else if (text.contains("None", true) || text.isBlank()) {
                    _pending.value = "0"
                } else {
                    _pending.value = text.take(40)
                }
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
        return contractClientFor(_selectedContract.value.contractId)
    }

    private suspend fun contractClientFor(contractId: String): ContractClient {
        return ContractClient.forContract(
            contractId = contractId,
            rpcUrl = RPC_URL,
            network = NETWORK
        )
    }

    private fun parseXlmToStroops(xlm: String): BigInteger {
        val value = xlm.trim().toDoubleOrNull() ?: throw Exception("Invalid amount")
        return BigInteger.valueOf((value * 10_000_000).toLong())
    }

    /** XPi / most Stellar assets use 7 decimals */
    private fun parseXpiToUnits(xpi: String): BigInteger {
        val value = xpi.trim().toDoubleOrNull() ?: throw Exception("Invalid amount")
        return BigInteger.valueOf((value * 10_000_000).toLong())
    }

    // ---------- Distributor: Lucky lottery ----------
    private val _canTriggerToday = MutableStateFlow(false)
    val canTriggerToday: StateFlow<Boolean> = _canTriggerToday

    fun refreshCanTrigger() {
        viewModelScope.launch {
            try {
                val client = contractClientFor(ContractAddresses.DIST)
                val r = client.invoke<Any?>(
                    functionName = "can_trigger_today",
                    arguments = emptyMap(),
                    source = publicKey ?: return@launch,
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                val t = r?.toString().orEmpty()
                _canTriggerToday.value = t.contains("true", true) || t == "1"
            } catch (_: Exception) {
                _canTriggerToday.value = false
            }
        }
    }

    fun triggerDaily() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Triggering daily lottery...")
                val client = contractClientFor(ContractAddresses.DIST)
                client.invoke<Unit>(
                    functionName = "trigger_daily",
                    arguments = mapOf("caller" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Lottery OK — you may receive 0.0000031 XPi (if fund is sufficient & after day 0)")
                refreshCanTrigger()
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    // ---------- StakingLending: Banking / Savings ----------
    private val _savingsInfo = MutableStateFlow("—")
    val savingsInfo: StateFlow<String> = _savingsInfo

    fun refreshSavings() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: return@launch
                val client = contractClientFor(ContractAddresses.STAKING_LENDING)
                val r = client.invoke<Any?>(
                    functionName = "get_savings",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                _savingsInfo.value = r?.toString() ?: "None"
            } catch (_: Exception) {
                _savingsInfo.value = "—"
            }
        }
    }

    fun depositSavings(amountXpi: String, termDays: Int) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val amount = parseXpiToUnits(amountXpi)
                if (amount <= BigInteger.ZERO) throw Exception("Amount > 0")
                _uiState.value = UiState.Loading("Depositing savings...")
                val client = contractClientFor(ContractAddresses.STAKING_LENDING)
                client.invoke<Unit>(
                    functionName = "deposit_xpi_savings",
                    arguments = mapOf(
                        "user" to kp.getAccountId(),
                        "xpi_amount" to amount,
                        "term_days" to termDays
                    ),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Deposit savings OK ($termDays days)")
                refreshSavings()
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun withdrawSavings() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Withdrawing savings...")
                val client = contractClientFor(ContractAddresses.STAKING_LENDING)
                client.invoke<Unit>(
                    functionName = "withdraw_xpi_savings",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Withdraw savings OK")
                refreshSavings()
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun compoundSavings() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Compounding...")
                val client = contractClientFor(ContractAddresses.STAKING_LENDING)
                client.invoke<Unit>(
                    functionName = "compound_savings",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Compound OK")
                refreshSavings()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    // ---------- Content + Staking XPi: Node / Forum ----------
    private val _xpiStaked = MutableStateFlow(0.0)
    val xpiStaked: StateFlow<Double> = _xpiStaked

    fun refreshXpiStaked() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: return@launch
                val client = contractClientFor(ContractAddresses.STAKING)
                val r = client.invoke<Any?>(
                    functionName = "get_xpi_staked",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = null,
                    parseResultXdrFn = { it.toString() }
                )
                client.close()
                val text = r?.toString().orEmpty()
                val num = Regex("""(-?\d+)""").find(text)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
                _xpiStaked.value = max(0.0, num / 10_000_000.0)
            } catch (_: Exception) { /* keep */ }
        }
    }

    fun stakeXpi(amountXpi: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val amount = parseXpiToUnits(amountXpi)
                if (amount <= BigInteger.ZERO) throw Exception("Amount > 0")
                _uiState.value = UiState.Loading("Staking XPi...")
                val client = contractClientFor(ContractAddresses.STAKING)
                client.invoke<Unit>(
                    functionName = "stake_xpi",
                    arguments = mapOf("user" to kp.getAccountId(), "amount" to amount),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Stake XPi OK")
                refreshXpiStaked()
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun unstakeXpi(amountXpi: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val amount = parseXpiToUnits(amountXpi)
                if (amount <= BigInteger.ZERO) throw Exception("Amount > 0")
                _uiState.value = UiState.Loading("Unstaking XPi...")
                val client = contractClientFor(ContractAddresses.STAKING)
                client.invoke<Unit>(
                    functionName = "unstake_xpi",
                    arguments = mapOf("user" to kp.getAccountId(), "amount" to amount),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Unstake XPi OK")
                refreshXpiStaked()
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun claimNode() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Claiming node reward...")
                val client = contractClientFor(ContractAddresses.CONTENT)
                client.invoke<Unit>(
                    functionName = "claim_node",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Claim node OK — +0.0000031 XPi")
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    // ---------- ClaimDev: Games ----------
    fun bindDeveloper(developerG: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val dev = developerG.trim()
                if (!dev.startsWith("G") || dev.length < 50) throw Exception("Invalid developer address")
                _uiState.value = UiState.Loading("Binding developer...")
                val client = contractClientFor(ContractAddresses.CLAIM_DEV)
                client.invoke<Unit>(
                    functionName = "bind_developer",
                    arguments = mapOf("user" to kp.getAccountId(), "developer" to dev),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Bind developer OK (once only)")
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun claimGame() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Claiming game reward...")
                val client = contractClientFor(ContractAddresses.CLAIM_DEV)
                client.invoke<Unit>(
                    functionName = "claim_game",
                    arguments = mapOf("user" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Claim game OK — +0.0000003 XPi")
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }

    fun claimForDeveloper() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                _uiState.value = UiState.Loading("Claiming developer rewards...")
                val client = contractClientFor(ContractAddresses.CLAIM_DEV)
                client.invoke<Unit>(
                    functionName = "claim_for_developer",
                    arguments = mapOf("developer" to kp.getAccountId()),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Claim for developer OK")
                refreshBalances()
            } catch (e: Exception) {
                _uiState.value = UiState.Error("${e.message}")
            }
        }
    }


    /** Generate a new Stellar keypair (not funded). User must save secret. */

    fun refreshReferrer() {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: return@launch
                val client = contractClient()
                val ref = try {
                    client.invoke<Any?>(
                        functionName = "get_referrer",
                        arguments = mapOf("user" to kp.getAccountId()),
                        source = kp.getAccountId(),
                        signer = kp,
                        parseResultXdrFn = null
                    )
                } catch (_: Exception) {
                    null
                }
                val text = ref?.toString()?.trim().orEmpty()
                _referrer.value = when {
                    text.isBlank() || text == "null" || text.contains("None") || text == "()" -> "Not bound"
                    else -> text.trim('"', ' ', '[', ']')
                }
                val pending = try {
                    client.invoke<Any?>(
                        functionName = "get_pending_referral",
                        arguments = mapOf("user" to kp.getAccountId()),
                        source = kp.getAccountId(),
                        signer = kp,
                        parseResultXdrFn = null
                    )
                } catch (_: Exception) {
                    null
                }
                client.close()
                val raw = pending?.toString()?.filter { it.isDigit() || it == '-' } ?: "0"
                val units = raw.toLongOrNull() ?: 0L
                _pendingReferral.value = String.format(
                    java.util.Locale.US,
                    "%.7f",
                    units / 10_000_000.0
                )
            } catch (_: Exception) {
                // keep previous values
            }
        }
    }

    /** Bind referrer once (on-chain). */
    fun bindReferrer(referrerG: String) {
        viewModelScope.launch {
            try {
                val kp = keyPair ?: throw Exception("Not logged in")
                val ref = referrerG.trim()
                if (!ref.startsWith("G") || ref.length != 56) {
                    throw Exception("Invalid referrer G… address")
                }
                if (ref == kp.getAccountId()) throw Exception("Cannot bind yourself")
                _uiState.value = UiState.Loading("Binding referrer...")
                val client = contractClient()
                client.invoke<Unit>(
                    functionName = "bind_referrer",
                    arguments = mapOf(
                        "user" to kp.getAccountId(),
                        "referrer" to ref
                    ),
                    source = kp.getAccountId(),
                    signer = kp,
                    parseResultXdrFn = null
                )
                client.close()
                _uiState.value = UiState.Success("Referrer bound")
                refreshReferrer()
            } catch (e: Exception) {
                _uiState.value = UiState.Error(
                    "Bind referrer: ${e.message ?: e.javaClass.simpleName}"
                )
            }
        }
    }


    fun createWallet() {
        viewModelScope.launch {
            try {
                _uiState.value = UiState.Loading("Creating wallet...")
                val kp = KeyPair.random()
                val secret = kp.getSecretSeed()?.concatToString()
                    ?: throw Exception("Cannot read secret seed")
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

                val code = assetCode.trim()
                val asset = if (code.equals("XLM", ignoreCase = true)) {
                    AssetTypeNative
                } else {
                    val issuer = _assetIssuers.value[code]
                        ?: _assetIssuers.value.entries.firstOrNull { it.key.equals(code, true) }?.value
                        ?: AssetRegistry.assets.firstOrNull { it.code.equals(code, true) }?.issuer
                    if (issuer.isNullOrBlank()) {
                        throw Exception("Unknown issuer for $code — refresh balances first")
                    }
                    Asset.createNonNativeAsset(code, issuer)
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



    fun setChartTf(tf: String) {
        _chartTf.value = tf
        refreshDex()
    }

    private fun tradePriceXlmPerBase(baseAmt: Double, counterAmt: Double): Double {
        if (!(baseAmt > 0) || !(counterAmt > 0)) return 0.0
        var xlmPer = baseAmt / counterAmt
        if (xlmPer > 1.0) xlmPer = counterAmt / baseAmt
        return xlmPer
    }

    private fun aggregateCandles(
        trades: List<Triple<Long, Double, Double>>,
        tf: String
    ): List<Candle> {
        val prices = trades.map { it.second }.filter { it > 0 }
        if (prices.isEmpty()) return emptyList()
        val sortedP = prices.sorted()
        val med = sortedP[sortedP.size / 2]
        val loBound = med / 20.0
        val hiBound = med * 20.0
        val bucketMs = when (tf) {
            "1h" -> 3_600_000L
            "4h" -> 14_400_000L
            "1w" -> 604_800_000L
            "1m" -> 2_592_000_000L
            else -> 86_400_000L
        }
        class Acc(var open: Double, var high: Double, var low: Double, var close: Double, var vol: Double)
        val map = linkedMapOf<Long, Acc>()
        for ((time, price, vol) in trades.sortedBy { it.first }) {
            if (price <= 0 || price < loBound || price > hiBound) continue
            val bucket = (time / bucketMs) * bucketMs
            val acc = map[bucket]
            if (acc == null) {
                map[bucket] = Acc(price, price, price, price, vol)
            } else {
                acc.high = maxOf(acc.high, price)
                acc.low = minOf(acc.low, price)
                acc.close = price
                acc.vol += vol
            }
        }
        return map.entries.sortedBy { it.key }.map { (t, a) ->
            Candle(t, a.open, a.high, a.low, a.close, a.vol)
        }
    }

    fun setDexPair(code: String) {
        _dexPair.value = code
    }

    /** Load order book + chart. Never sets UiState.Error (must not block login). */
    fun refreshDex() {
        viewModelScope.launch {
            try {
                loadOrderBookAndChart(_dexPair.value)
            } catch (_: Exception) {
                _orderBook.value = OrderBookSnapshot()
                _candles.value = emptyList()
                _dexMidPrice.value = "—"
                _chartStatus.value = "—"
            }
        }
    }


    private fun assetParams(code: String, role: String): String {
        if (code == "XLM") return "${role}_asset_type=native"
        val tracked = AssetRegistry.assets.firstOrNull { it.code == code && it.issuer != null }
            ?: throw Exception("Unknown asset $code")
        val t = if (tracked.code.length <= 4) "credit_alphanum4" else "credit_alphanum12"
        return "${role}_asset_type=$t&${role}_asset_code=${tracked.code}&${role}_asset_issuer=${tracked.issuer}"
    }

    private fun toSdkAsset(code: String): Asset {
        if (code == "XLM") return AssetTypeNative
        val tracked = AssetRegistry.assets.firstOrNull { it.code == code && it.issuer != null }
            ?: throw Exception("Unknown asset $code")
        return Asset.createNonNativeAsset(tracked.code, tracked.issuer!!)
    }

    private fun httpGet(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000
        conn.readTimeout = 20000
        conn.requestMethod = "GET"
        conn.setRequestProperty("Accept", "application/json")
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) {
                conn.inputStream
            } else {
                conn.errorStream ?: conn.inputStream
            }
            if (stream == null) throw Exception("HTTP $code empty body")
            val body = BufferedReader(InputStreamReader(stream)).readText()
            if (code !in 200..299) throw Exception("HTTP $code: ${body.take(180)}")
            return body
        } finally {
            conn.disconnect()
        }
    }

    private suspend fun loadOrderBookAndChart(baseCode: String) {
        val selling = assetParams(baseCode, "selling")
        val buying = assetParams("XLM", "buying")
        val obUrl = "$HORIZON_URL/order_book?$selling&$buying&limit=10"
        val obJson = JSONObject(httpGet(obUrl))
        fun levels(arr: JSONArray): List<OrderLevel> {
            val out = mutableListOf<OrderLevel>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                out.add(OrderLevel(price = o.getString("price"), amount = o.getString("amount")))
            }
            return out
        }
        val bids = levels(obJson.getJSONArray("bids"))
        val asks = levels(obJson.getJSONArray("asks"))
        _orderBook.value = OrderBookSnapshot(bids = bids, asks = asks)
        val mid = when {
            bids.isNotEmpty() && asks.isNotEmpty() -> {
                val b = bids[0].price.toDoubleOrNull() ?: 0.0
                val a = asks[0].price.toDoubleOrNull() ?: 0.0
                if (b > 0 && a > 0) (b + a) / 2.0 else 0.0
            }
            bids.isNotEmpty() -> bids[0].price.toDoubleOrNull() ?: 0.0
            asks.isNotEmpty() -> asks[0].price.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
        _dexMidPrice.value = if (mid > 0) {
            String.format(java.util.Locale.US, "%.7f", mid)
        } else {
            "—"
        }

        // OHLC candles from Horizon trades (xpi-dex plugin approach)
        _chartStatus.value = "Loading trades…"
        val base = assetParams("XLM", "base")
        val counter = assetParams(baseCode, "counter")
        val tradesUrl = "$HORIZON_URL/trades?$base&$counter&limit=200&order=desc"
        val tradesJson = JSONObject(httpGet(tradesUrl))
        val records = tradesJson.getJSONObject("_embedded").getJSONArray("records")
        val raw = mutableListOf<Triple<Long, Double, Double>>()
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
        for (i in 0 until records.length()) {
            val r = records.getJSONObject(i)
            val baseAmt = r.optString("base_amount", "0").toDoubleOrNull() ?: 0.0
            val counterAmt = r.optString("counter_amount", "0").toDoubleOrNull() ?: 0.0
            val price = tradePriceXlmPerBase(baseAmt, counterAmt)
            val tStr = r.optString("ledger_close_time", "").replace(".000", "")
            val time = try { sdf.parse(tStr)?.time ?: 0L } catch (_: Exception) { 0L }
            if (price > 0 && time > 0) {
                raw.add(Triple(time, price, counterAmt))
            }
        }
        val list = aggregateCandles(raw, _chartTf.value)
        _candles.value = list
        _chartStatus.value = if (list.isEmpty()) {
            "No trades yet"
        } else {
            "${list.size} candles · ${raw.size} trades · ${_chartTf.value}"
        }
    }


    fun placeDexOffer(side: String, baseCode: String, amount: String, priceXlm: String) {
        viewModelScope.launch {
            try {
                val key = keyPair ?: throw Exception("Not logged in")
                val amt = amount.trim().toDoubleOrNull() ?: throw Exception("Invalid amount")
                val price = priceXlm.trim().toDoubleOrNull() ?: throw Exception("Invalid price")
                if (amt <= 0 || price <= 0) throw Exception("Amount and price must be > 0")
                if (baseCode == "XLM") throw Exception("Pick a non-XLM base asset")

                _uiState.value = UiState.Loading("Submitting $side offer...")
                val server = HorizonServer(HORIZON_URL)
                val account = server.loadAccount(key.getAccountId())
                val base = toSdkAsset(baseCode)
                val quote = AssetTypeNative
                val amtStr = String.format(java.util.Locale.US, "%.7f", amt)
                val priceStr = String.format(java.util.Locale.US, "%.7f", price)
                val priceObj = Price.fromString(priceStr)

                val op = if (side.equals("buy", ignoreCase = true)) {
                    ManageBuyOfferOperation(
                        selling = quote,
                        buying = base,
                        buyAmount = amtStr,
                        price = priceObj,
                        offerId = 0L
                    )
                } else {
                    ManageSellOfferOperation(
                        selling = base,
                        buying = quote,
                        amount = amtStr,
                        price = priceObj,
                        offerId = 0L
                    )
                }

                val tx = TransactionBuilder(account, NETWORK)
                    .setBaseFee(100_000)
                    .addOperation(op)
                    .setTimeout(180)
                    .build()
                tx.sign(key)
                val res = server.submitTransaction(tx.toEnvelopeXdrBase64())
                server.close()
                _uiState.value = UiState.Success("$side offer OK\nTx: ${res.hash}")
                refreshBalances()
                loadOrderBookAndChart(baseCode)
            } catch (e: Exception) {
                _uiState.value = UiState.Error("Offer: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }


    fun logout() {
        _referrer.value = "—"
        _pendingReferral.value = "0"

        _candles.value = emptyList()
        _chartStatus.value = "—"

        tickerJob?.cancel()
        keyPair = null
        publicKey = null
        _balances.value = emptyMap()
        _assetIssuers.value = emptyMap()
        _pending.value = "—"
        _stakedXlm.value = 0.0
        _displayMined.value = 0.0
        _uiState.value = UiState.Idle
    }

    sealed class UiState {
        object Idle : UiState()
        data class Loading(val message: String) : UiState()
        data class LoggedIn(val publicKey: String) : UiState()
        data class WalletCreated(val publicKey: String, val secretKey: String) : UiState()
        data class Success(val message: String) : UiState()
        data class Error(val message: String) : UiState()
        data class StakeInfo(val info: String) : UiState()
    }
}
