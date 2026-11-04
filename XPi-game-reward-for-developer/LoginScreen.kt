package com.astroloop.game.xpi

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.astroloop.game.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: StakingViewModel,
    onLanguageChanged: () -> Unit = {}
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val loading = uiState is StakingViewModel.UiState.Loading
    val error = (uiState as? StakingViewModel.UiState.Error)?.message
    val created = uiState as? StakingViewModel.UiState.WalletCreated

    var secret by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "XPI Cloud Mining",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = "100 XLM = 1 cloud slot · earn XPi every day",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        if (created != null) {
            // After create wallet — force save offline
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Save your secret offline!", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
                    Text("This is the only time you will see it. Copy and store it safely.", color = MaterialTheme.colorScheme.onErrorContainer)
                    Text(created.secretKey, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cm.setPrimaryClip(ClipData.newPlainText("secret", created.secretKey))
                        }) { Text("Copy secret") }
                        Button(onClick = { viewModel.confirmWalletSaved() }) {
                            Text("I saved it")
                        }
                    }
                }
            }
        } else {
            Text("Already have a wallet?", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = secret,
                onValueChange = { secret = it },
                label = { Text("Secret key (S...)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error)
            }
            Button(
                onClick = { viewModel.login(secret.trim()) },
                enabled = !loading && secret.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(20.dp))
                else Text("Log in")
            }

            Spacer(Modifier.height(8.dp))
            Text("New user?", style = MaterialTheme.typography.titleMedium)
            OutlinedButton(
                onClick = { viewModel.createWallet() },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Create wallet in app") }
            Text(
                "Generates a Stellar key pair on this device. You will see the secret only once — save it offline.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(8.dp))
            Text("Need XLM?", style = MaterialTheme.typography.titleMedium)
            OutlinedButton(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://stellarterm.com/"))
                    context.startActivity(intent)
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("Buy / fund XLM") }
            Text(
                "Opens StellarTerm so you can buy XLM and send it to your G... address.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
