package com.xpi.staking.ui
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.xpi.staking.R
import com.xpi.staking.StakingViewModel
import java.util.Locale

@Composable
fun HomeScreen(
    viewModel: StakingViewModel,
    publicKey: String,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf(
        stringResource(R.string.tab_mining),
        stringResource(R.string.tab_banking),
        stringResource(R.string.tab_node),
        stringResource(R.string.tab_games),
        stringResource(R.string.tab_wallet),
        stringResource(R.string.tab_dex),
        stringResource(R.string.tab_faq)
    )

    Column(modifier = modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "XPi Network",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Staking · Banking · Node · Games",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            TextButton(onClick = onLogout) {
                Text(stringResource(R.string.logout))
            }
        }
        Text(
            text = publicKey,
            modifier = Modifier.padding(horizontal = 16.dp),
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 8.dp) {
            tabs.forEachIndexed { i, title ->
                Tab(
                    selected = tab == i,
                    onClick = { tab = i },
                    text = { Text(title, maxLines = 1) }
                )
            }
        }
        when (tab) {
            0 -> MiningTab(viewModel)
            1 -> BankingTab(viewModel)
            2 -> NodeForumTab(viewModel)
            3 -> GamesTab(viewModel)
            4 -> WalletTab(viewModel, publicKey)
            5 -> DexTab(viewModel)
            6 -> SimpleTextTab(stringResource(R.string.faq_title), stringResource(R.string.faq_body))
        }
    }
}

@Composable
private fun SimpleTextTab(title: String, body: String) {
    val text = remember(body) { body.replace("\\n", "\n") }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, lineHeight = 22.sp)
    }
}

@Composable
private fun StatusBanner(viewModel: StakingViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val loading = uiState is StakingViewModel.UiState.Loading
    val message: String? = when (val s = uiState) {
        is StakingViewModel.UiState.Success -> s.message
        is StakingViewModel.UiState.Error -> s.message
        is StakingViewModel.UiState.StakeInfo -> s.info
        is StakingViewModel.UiState.Loading -> s.message
        else -> null
    }
    if (message != null) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (uiState is StakingViewModel.UiState.Error)
                    MaterialTheme.colorScheme.error.copy(alpha = 0.15f)
                else MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(message, modifier = Modifier.weight(1f), fontSize = 13.sp)
                if (!loading) {
                    TextButton(onClick = { viewModel.clearMessage() }) {
                        Text(stringResource(R.string.close))
                    }
                }
            }
        }
    }
}

/** Mining = stake XLM + claim + lucky lottery + referral field */
@Composable
private fun MiningTab(viewModel: StakingViewModel) {
    val referrer by viewModel.referrer.collectAsState()
    val pendingRef by viewModel.pendingReferral.collectAsState()
    val refDisplay = referrer ?: "—"

    val balances by viewModel.balances.collectAsState()
    val pending by viewModel.pending.collectAsState()
    val staked by viewModel.stakedXlm.collectAsState()
    val mined by viewModel.displayMined.collectAsState()
    val canTrigger by viewModel.canTriggerToday.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var stakeAmount by remember { mutableStateOf("31.4") }
    var unstakeAmount by remember { mutableStateOf("") }
    var referral by remember { mutableStateOf("") }
    val loading = uiState is StakingViewModel.UiState.Loading
    val ratePerDay = if (staked >= 31.4) (staked / 31.4) * 0.0000003 else 0.0

    LaunchedEffect(Unit) { viewModel.refreshCanTrigger() }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusBanner(viewModel)

        // Lucky lottery
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("🎰 Lucky Lottery (Daily Lottery)", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.secondary)
                Text(
                    "Anyone who successfully triggers the Distributor each day activates the Vault to deposit XPi into Staking and may receive 0.0000031 XPi. Permissionless — the fastest user gets the reward.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    if (canTrigger) "No one has spun today yet — you can try!" else "Someone has already spun today (or checking).",
                    fontSize = 12.sp
                )
                Button(
                    onClick = { viewModel.triggerDaily() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                ) {
                    Text("Spin lottery / Trigger daily")
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(stringResource(R.string.mined_session), style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.height(8.dp))
                Text(
                    text = String.format(Locale.US, "%.12f", mined),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary
                )
                Text("XPi", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(
                    text = stringResource(R.string.mining_rate) + ": " +
                        String.format(Locale.US, "%.10f", ratePerDay) + " XPi/day",
                    fontSize = 12.sp
                )
                Text(
                    text = "Staked: " + String.format(Locale.US, "%.4f", staked) + " XLM  ·  Min 31.4 · 48h lock",
                    fontSize = 12.sp
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(stringResource(R.string.wallet_assets), fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { viewModel.refreshAll() }) {
                        Text(stringResource(R.string.refresh))
                    }
                }
                if (balances.isEmpty()) Text("—")
                else balances.forEach { (code, bal) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(code, fontWeight = FontWeight.Medium)
                        Text(bal)
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(stringResource(R.string.pending_onchain))
                    Text(pending)
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Stake XLM (Mining)", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = stakeAmount,
                    onValueChange = { stakeAmount = it },
                    label = { Text(stringResource(R.string.amount_xlm)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Button(
                    onClick = { viewModel.stake(stakeAmount) },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.stake_to_mine))
                }
            }
        }

        
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Referral (on-chain)", fontWeight = FontWeight.SemiBold)
                Text(
                    "Bind a referrer once (cannot change). When you successfully claim staking rewards " +
                        "for the first time after binding, your referrer receives a one-time pending bonus " +
                        "of 0.0000314 XPi, paid on their next claim. To earn more referral bonuses, " +
                        "introduce new users who bind you and claim.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 18.sp
                )
                Text(
                    "Your referrer: ${refDisplay}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    "Pending referral rewards: ${pendingRef} XPi",
                    fontSize = 13.sp
                )
                OutlinedTextField(
                    value = referral,
                    onValueChange = { referral = it },
                    label = { Text("Referrer G… address") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("G…") }
                )
                Button(
                    onClick = { viewModel.bindReferrer(referral) },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Bind referrer (once)") }
                OutlinedButton(
                    onClick = { viewModel.refreshReferrer() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Refresh referral status") }
            }
        }


        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = unstakeAmount,
                    onValueChange = { unstakeAmount = it },
                    label = { Text(stringResource(R.string.unstake_hint)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.unstake(unstakeAmount) },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.unstake)) }
                    Button(
                        onClick = { viewModel.claim() },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) { Text(stringResource(R.string.claim)) }
                }
                OutlinedButton(
                    onClick = { viewModel.getStake() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.view_stake)) }
            }
        }
    }
}

/** Banking = StakingLending savings — like Pi lock but with real on-chain interest */
@Composable
private fun BankingTab(viewModel: StakingViewModel) {
    val savings by viewModel.savingsInfo.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var amount by remember { mutableStateOf("1") }
    var term by remember { mutableIntStateOf(30) }
    val loading = uiState is StakingViewModel.UiState.Loading

    LaunchedEffect(Unit) { viewModel.refreshSavings() }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusBanner(viewModel)

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("🏦 Banking / Savings XPi", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text(
                    "Similar to Pi Network Lock — but with real on-chain interest, withdrawable by term.\n\n" +
                        "• Requirement: is_player_eligible on Staking (stake ≥ 31.4 XLM + full 48h).\n" +
                        "• Base interest ~1%/month.\n" +
                        "• Hold for 1 year: 12% + 2% bonus.\n" +
                        "• Hold for 2 years: extra 6% bonus.\n" +
                        "• Early withdrawal: principal only, no interest.\n" +
                        "• 1-month (30-day) plan is suitable for testing.",
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Current savings position", fontWeight = FontWeight.SemiBold)
                Text(savings, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                TextButton(onClick = { viewModel.refreshSavings() }) {
                    Text(stringResource(R.string.refresh))
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Deposit XPi for interest", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text("XPi amount") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Text("Term", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(30 to "1 month", 365 to "1 year", 730 to "2 years").forEach { (d, label) ->
                        FilterChip(
                            selected = term == d,
                            onClick = { term = d },
                            label = { Text(label) }
                        )
                    }
                }
                Button(
                    onClick = { viewModel.depositSavings(amount, term) },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Stake / Deposit XPi") }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.compoundSavings() },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) { Text("Compound (≥30 days)") }
                    Button(
                        onClick = { viewModel.withdrawSavings() },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) { Text("Unstake / Withdraw") }
                }
            }
        }
    }
}


/** Node / Forum — tutorial only (claim_node is a Forum app feature) */
@Composable
private fun NodeForumTab(viewModel: StakingViewModel) {
    val context = LocalContext.current
    val xpiStaked by viewModel.xpiStaked.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var stakeAmt by remember { mutableStateOf("0.0314") }
    var unstakeAmt by remember { mutableStateOf("") }
    val loading = uiState is StakingViewModel.UiState.Loading
    val message: String? = when (val s = uiState) {
        is StakingViewModel.UiState.Success -> s.message
        is StakingViewModel.UiState.Error -> s.message
        is StakingViewModel.UiState.Loading -> s.message
        else -> null
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Node rewards (like a lightweight Pi node)",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    "Stake at least 0.0314 XPi in the staking contract to become node-eligible. " +
                        "Eligible nodes can claim a small reward of +0.0000031 XPi about once every 24 hours " +
                        "via the Forum / node software (claim_node) — not from this mining app.\n\n" +
                        "This tab only helps you prepare on-chain stake and points you to the open-source " +
                        "Forum node guides. Run the node software from GitHub; claim_node is handled there.",
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
                Text(
                    "XPi currently staked for node: $xpiStaked",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Prepare XPi stake (optional)", fontWeight = FontWeight.SemiBold)
                Text(
                    "Lock XPi here so your account meets the ≥ 0.0314 XPi threshold used by Forum node rewards. " +
                        "Unstaking below the threshold removes node eligibility until you stake again.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 18.sp
                )
                OutlinedTextField(
                    value = stakeAmt,
                    onValueChange = { stakeAmt = it },
                    label = { Text("XPi amount to stake") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("e.g. 0.0314") }
                )
                Button(
                    onClick = { viewModel.stakeXpi(stakeAmt) },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Stake XPi") }
                OutlinedTextField(
                    value = unstakeAmt,
                    onValueChange = { unstakeAmt = it },
                    label = { Text("XPi amount to unstake") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedButton(
                    onClick = { viewModel.unstakeXpi(unstakeAmt) },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Unstake XPi") }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("How to run a Forum node", fontWeight = FontWeight.SemiBold)
                Text(
                    "1. Read the open-source guides on GitHub (xpi-stellar-mining).\n" +
                        "2. Run a full node on Windows/Ubuntu (Node.js + local services) as documented upstream.\n" +
                        "3. Keep your on-chain XPi stake ≥ 0.0314 and follow Forum software for claim_node.\n" +
                        "4. Content writing and P2P features may require additional rules (e.g. continuous XLM stake, disk commitment) — see project docs.\n\n" +
                        "This mining app does not run a node and does not call claim_node.",
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
                Button(
                    onClick = {
                        context.startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("https://github.com/xpistellar/xpi-stellar-mining")
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Open GitHub — xpi-stellar-mining") }
                OutlinedButton(
                    onClick = {
                        context.startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("https://xgoldmining.com/")
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Open project site / Forum links") }
            }
        }

        if (message != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    if (loading) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text(message)
                        }
                    } else {
                        Text(message)
                        TextButton(onClick = { viewModel.clearMessage() }) {
                            Text(stringResource(R.string.close))
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}



/** Games — tutorial only; claim_game / bind_developer live in game clients */
@Composable
private fun GamesTab(viewModel: StakingViewModel) {
    val context = LocalContext.current

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Games & claim_game (tutorial)",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    "On-chain game rewards use the staking contract function claim_game:\n\n" +
                        "• Requires an eligible XLM stake (same foundation as mining).\n" +
                        "• Max 10 successful claims per day per account.\n" +
                        "• Minimum ~2 hours between claims.\n" +
                        "• Each success pays a tiny amount (+0.0000003 XPi).\n\n" +
                        "Optional: a player may bind_developer once (immutable). Game clients can " +
                        "attribute claims to that developer; developers claim accumulated rewards " +
                        "from their own tools (claim_for_developer), not from this mining app.\n\n" +
                        "This tab does not submit claim_game or bind_developer transactions. " +
                        "Play or ship a game client that calls the contract correctly.",
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("For players", fontWeight = FontWeight.SemiBold)
                Text(
                    "Download community games that integrate XPi (example: XPi Space Mining). " +
                        "Stake XLM on the Mining tab first so your account is eligible, then play " +
                        "inside the game client.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 18.sp
                )
                Button(
                    onClick = {
                        context.startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(
                                    "https://github.com/xpistellar/xpi-stellar-mining/tree/main/XPi-space-mining-game"
                                )
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Download XPi Space Mining (GitHub)") }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("For developers", fontWeight = FontWeight.SemiBold)
                Text(
                    "Build your own game or bot using the open samples on GitHub. " +
                        "Wire claim_game (and optional bind_developer) according to the contract docs. " +
                        "Honest game design earns players tiny XPi rewards within daily limits — " +
                        "a path for indie devs to participate in the ecosystem.\n\n" +
                        "Start from the repository templates and whitepaper/FAQ on GitHub.",
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 20.sp
                )
                OutlinedButton(
                    onClick = {
                        context.startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("https://github.com/xpistellar/xpi-stellar-mining")
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Open GitHub — samples & docs") }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WalletTab(viewModel: StakingViewModel, publicKey: String) {
    val context = LocalContext.current
    val balances by viewModel.balances.collectAsState()
    val qr by viewModel.qrBitmap.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var dest by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var selectedAsset by remember { mutableStateOf("XLM") }
    var memo by remember { mutableStateOf("") }
    val loading = uiState is StakingViewModel.UiState.Loading

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusBanner(viewModel)

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Receive", fontWeight = FontWeight.SemiBold)
                Text(publicKey, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = {
                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        cm.setPrimaryClip(ClipData.newPlainText("address", publicKey))
                    }) { Text(stringResource(R.string.copy_address)) }
                    OutlinedButton(onClick = { viewModel.generateReceiveQr() }) {
                        Text(stringResource(R.string.receive))
                    }
                }
                qr?.let {
                    Image(
                        bitmap = it.asImageBitmap(),
                        contentDescription = "QR",
                        modifier = Modifier
                            .size(180.dp)
                            .align(Alignment.CenterHorizontally)
                    )
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Balances", fontWeight = FontWeight.SemiBold)
                if (balances.isEmpty()) Text("—")
                else balances.forEach { (c, b) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(c); Text(b)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { viewModel.ensureXpiTrustline() }, enabled = !loading) {
                        Text(stringResource(R.string.trustline))
                    }
                    OutlinedButton(onClick = { viewModel.refreshAll() }) {
                        Text(stringResource(R.string.refresh))
                    }
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.send), fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = dest,
                    onValueChange = { dest = it },
                    label = { Text(stringResource(R.string.destination_g)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it },
                    label = { Text(stringResource(R.string.amount)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                // Asset select from balances only (avoid wrong issuer / typos)
                val assetOptions = remember(balances) {
                    val keys = balances.keys.filter { it != "Error" }.toList()
                    if (keys.isEmpty()) listOf("XLM") else keys
                }
                LaunchedEffect(assetOptions) {
                    if (selectedAsset !in assetOptions) {
                        selectedAsset = assetOptions.firstOrNull() ?: "XLM"
                    }
                }
                var assetExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = assetExpanded,
                    onExpandedChange = { assetExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedAsset,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Asset (from wallet)") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = assetExpanded) },
                        supportingText = {
                            val bal = balances[selectedAsset]
                            if (bal != null) Text("Balance: $bal")
                        },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        singleLine = true
                    )
                    ExposedDropdownMenu(
                        expanded = assetExpanded,
                        onDismissRequest = { assetExpanded = false }
                    ) {
                        assetOptions.forEach { code ->
                            val bal = balances[code] ?: "—"
                            DropdownMenuItem(
                                text = { Text("$code  ·  $bal") },
                                onClick = {
                                    selectedAsset = code
                                    assetExpanded = false
                                }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = memo,
                    onValueChange = { memo = it },
                    label = { Text(stringResource(R.string.memo_optional)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Button(
                    onClick = { viewModel.sendPayment(dest, amount, selectedAsset, memo) },
                    enabled = !loading && assetOptions.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.send)) }
            }
        }
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DexTab(viewModel: StakingViewModel) {
    val orderBook by viewModel.orderBook.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var pair by remember { mutableStateOf("XPi") }
    var amount by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    val loading = uiState is StakingViewModel.UiState.Loading

    LaunchedEffect(Unit) {
        viewModel.setDexPair(pair)
        viewModel.refreshDex()
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatusBanner(viewModel)
        Text("DEX (Horizon)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            "XPi can be traded directly on the decentralized exchange — no CEX required. " +
                "This reduces the risk of CEX pump-and-dump manipulation seen with projects like Pi Network.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 20.sp
        )
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
        ) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        webViewClient = WebViewClient()
                        loadUrl(
                            "https://stellar.expert/widget/public/asset/price/" +
                                "XPi-GDOFJEZ3FUWAC2EVHPRMJPSWPOD3KJF7FTXFZIERFFPB2VMTRQLZFUEF"
                        )
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
        OutlinedTextField(
            value = pair,
            onValueChange = {
                pair = it
                viewModel.setDexPair(it)
            },
            label = { Text("Base asset (XPi, USDC…)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        TextButton(onClick = {
            viewModel.setDexPair(pair)
            viewModel.refreshDex()
        }, enabled = !loading) {
            Text(stringResource(R.string.refresh))
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text("Bids", fontWeight = FontWeight.SemiBold)
                orderBook.bids.take(5).forEach {
                    Text("${it.price} × ${it.amount}", fontSize = 12.sp)
                }
                Spacer(Modifier.height(8.dp))
                Text("Asks", fontWeight = FontWeight.SemiBold)
                orderBook.asks.take(5).forEach {
                    Text("${it.price} × ${it.amount}", fontSize = 12.sp)
                }
            }
        }
        OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(value = price, onValueChange = { price = it }, label = { Text("Price (XLM)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { viewModel.placeDexOffer("buy", pair, amount, price) }, enabled = !loading, modifier = Modifier.weight(1f)) {
                Text("Buy")
            }
            OutlinedButton(onClick = { viewModel.placeDexOffer("sell", pair, amount, price) }, enabled = !loading, modifier = Modifier.weight(1f)) {
                Text("Sell")
            }
        }
    }
}
