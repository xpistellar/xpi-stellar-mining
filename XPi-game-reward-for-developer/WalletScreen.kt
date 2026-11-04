package com.astroloop.game.xpi

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun WalletScreen(
    viewModel: StakingViewModel,
    onEnterGame: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val pending by viewModel.pending.collectAsState()
    val staked by viewModel.stakedXlm.collectAsState()

    val publicKey = (uiState as? StakingViewModel.UiState.LoggedIn)?.publicKey ?: "..."

    var stakeInput by remember { mutableStateOf("31.4") }
    var unstakeInput by remember { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("XPI Mining", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
        Text(publicKey, style = MaterialTheme.typography.bodySmall)

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                Text("Pending on-chain: $pending XPi")
                Text("Staked: $staked XLM")
            }
        }

        OutlinedTextField(
            value = stakeInput,
            onValueChange = { stakeInput = it },
            label = { Text("XLM amount") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = { viewModel.stake(stakeInput) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Stake to mining XPi") }

        OutlinedTextField(
            value = unstakeInput,
            onValueChange = { unstakeInput = it },
            label = { Text("XLM (empty = all)") },
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { viewModel.unstake(unstakeInput) },
                modifier = Modifier.weight(1f)
            ) { Text("Unstake") }
            Button(
                onClick = { viewModel.claim() },
                modifier = Modifier.weight(1f)
            ) { Text("Claim") }
        }
        OutlinedButton(
            onClick = { viewModel.getStake() },
            modifier = Modifier.fillMaxWidth()
        ) { Text("View stake") }

        Spacer(Modifier.weight(1f))
        Button(
            onClick = onEnterGame,
            modifier = Modifier.fillMaxWidth()
        ) { Text("Enter Game") }
    }
}
