package com.xpi.staking.ui
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExperimentalMaterial3Api
import android.net.Uri
import android.content.Intent

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
    var tab by remember { mutableIntStateOf(1) }
    val tabs = listOf(
        stringResource(R.string.tab_mining),
        stringResource(R.string.tab_wallet),
        stringResource(R.string.tab_faq),
        stringResource(R.string.tab_games)
    )

    Column(modifier = modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "XPI Mining",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
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
        TabRow(selectedTabIndex = tab) {
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
            1 -> WalletTab(viewModel, publicKey)
            2 -> SimpleTextTab(stringResource(R.string.faq_title), stringResource(R.string.faq_body))
            3 -> SimpleTextTab(stringResource(R.string.games_title), stringResource(R.string.games_body))
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WalletTab(viewModel: StakingViewModel, publicKey: String) {
    val context = LocalContext.current
    val balances by viewModel.balances.collectAsState()
    val qr by viewModel.qrBitmap.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var dest by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var memo by remember { mutableStateOf("") }
    var assetExpanded by remember { mutableStateOf(false) }
    val assetOptions = remember(balances) {
        balances.keys.filter { it != "Error" && it.isNotBlank() }
            .sortedWith(compareBy({ it != "XLM" }, { it }))
            .ifEmpty { listOf("XLM") }
    }
    var selectedAsset by remember { mutableStateOf("XLM") }
    LaunchedEffect(assetOptions) {
        if (selectedAsset !in assetOptions) {
            selectedAsset = assetOptions.firstOrNull() ?: "XLM"
        }
    }
    val loading = uiState is StakingViewModel.UiState.Loading
    val message: String? = when (val s = uiState) {
        is StakingViewModel.UiState.Success -> s.message
        is StakingViewModel.UiState.Error -> s.message
        is StakingViewModel.UiState.Loading -> s.message
        else -> null
    }
    val buyXlmUrl = "https://stellarterm.com/buy-crypto?crypto=xlm&network=stellar"

    LaunchedEffect(publicKey) { viewModel.generateReceiveQr() }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("1. Fund XLM", fontWeight = FontWeight.Bold)
                Text(
                    "New wallets start with 0 XLM. Buy XLM, then send it to your address below.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Button(
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(buyXlmUrl)))
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Buy / fund XLM") }
                Text(publicKey, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                OutlinedButton(onClick = {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("stellar_public", publicKey))
                }) { Text(stringResource(R.string.copy_address)) }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("2. Create XPi trustline", fontWeight = FontWeight.Bold)
                Text(stringResource(R.string.trustline_hint), fontSize = 12.sp)
                Button(
                    onClick = { viewModel.ensureXpiTrustline() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.create_xpi_trustline)) }
                OutlinedButton(
                    onClick = { viewModel.refreshAll() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.refresh)) }
                balances.forEach { entry ->
                        val code = entry.key
                        val bal = entry.value
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(code, fontWeight = FontWeight.Medium)
                        Text(bal)
                    }
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                Modifier.padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(stringResource(R.string.receive), fontWeight = FontWeight.Bold)
                if (qr != null) {
                    Image(
                        bitmap = qr!!.asImageBitmap(),
                        contentDescription = "Receive QR",
                        modifier = Modifier.size(180.dp)
                    )
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.send), fontWeight = FontWeight.Bold)
                Text(
                    "Select an asset from your wallet balances (issuer is applied automatically).",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
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
                ExposedDropdownMenuBox(
                    expanded = assetExpanded,
                    onExpandedChange = { assetExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedAsset,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Asset (from your wallet)") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(assetExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = assetExpanded,
                        onDismissRequest = { assetExpanded = false }
                    ) {
                        assetOptions.forEach { code ->
                            val bal = balances[code] ?: ""
                            DropdownMenuItem(
                                text = { Text("$code  ($bal)") },
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
                    enabled = !loading && selectedAsset.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Send $selectedAsset") }
            }
        }

        if (message != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    if (loading) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
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


@Composable
private fun MiningTab(viewModel: StakingViewModel) {
    val balances by viewModel.balances.collectAsState()
    val pending by viewModel.pending.collectAsState()
    val staked by viewModel.stakedXlm.collectAsState()
    val mined by viewModel.displayMined.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    var stakeAmount by remember { mutableStateOf("31.4") }
    var unstakeAmount by remember { mutableStateOf("") }
    val loading = uiState is StakingViewModel.UiState.Loading
    val message: String? = when (val s = uiState) {
        is StakingViewModel.UiState.Success -> s.message
        is StakingViewModel.UiState.Error -> s.message
        is StakingViewModel.UiState.StakeInfo -> s.info
        is StakingViewModel.UiState.Loading -> s.message
        else -> null
    }
    val ratePerDay = if (staked >= 31.4) (staked / 31.4) * 0.0000003 else 0.0

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
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
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary
                )
                Text("XPi", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.mining_rate) + ": " +
                        String.format(Locale.US, "%.10f", ratePerDay) + " XPi/day",
                    fontSize = 12.sp
                )
                Text(
                    text = "Staked: " + String.format(Locale.US, "%.4f", staked) + " XLM",
                    fontSize = 12.sp
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.wallet_assets), fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { viewModel.refreshAll() }) {
                        Text(stringResource(R.string.refresh))
                    }
                }
                if (balances.isEmpty()) {
                    Text("—")
                } else {
                    balances.forEach { entry ->
                        val code = entry.key
                        val bal = entry.value
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(code, fontWeight = FontWeight.Medium)
                            Text(bal)
                        }
                    }
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.pending_onchain))
                    Text(pending)
                }
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                OutlinedTextField(
                    value = unstakeAmount,
                    onValueChange = { unstakeAmount = it },
                    label = { Text(stringResource(R.string.unstake_hint)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { viewModel.unstake(unstakeAmount) },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(stringResource(R.string.unstake))
                    }
                    Button(
                        onClick = { viewModel.claim() },
                        enabled = !loading,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(stringResource(R.string.claim))
                    }
                }
                OutlinedButton(
                    onClick = { viewModel.getStake() },
                    enabled = !loading,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.view_stake))
                }
            }
        }

        if (message != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    if (loading) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
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
