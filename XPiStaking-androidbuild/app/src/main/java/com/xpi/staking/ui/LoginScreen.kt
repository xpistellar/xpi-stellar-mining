package com.xpi.staking.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xpi.staking.LocaleHelper
import com.xpi.staking.R
import com.xpi.staking.StakingViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: StakingViewModel,
    modifier: Modifier = Modifier,
    onLanguageChanged: () -> Unit = {}
) {
    val context = LocalContext.current
    var secret by remember { mutableStateOf("") }
    var langExpanded by remember { mutableStateOf(false) }
    var currentLang by remember { mutableStateOf(LocaleHelper.getLang(context)) }
    val uiState by viewModel.uiState.collectAsState()
    val loading = uiState is StakingViewModel.UiState.Loading
    val error = (uiState as? StakingViewModel.UiState.Error)?.message
    val created = uiState as? StakingViewModel.UiState.WalletCreated
    val langLabel = LocaleHelper.languages.firstOrNull { it.first == currentLang }?.second ?: "English"

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(R.string.login_title),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.login_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(16.dp))

        if (created != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.wallet_created_title),
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(stringResource(R.string.wallet_created_warning), fontSize = 13.sp)
                    Text("Public key", fontWeight = FontWeight.SemiBold)
                    Text(created.publicKey, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("Secret key", fontWeight = FontWeight.SemiBold)
                    Text(created.secretKey, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cm.setPrimaryClip(ClipData.newPlainText("stellar_secret", created.secretKey))
                        }) { Text(stringResource(R.string.copy_secret)) }
                        Button(onClick = { viewModel.confirmWalletSaved() }) {
                            Text(stringResource(R.string.i_saved_secret))
                        }
                    }
                    Text(
                        "Next: open Wallet tab → buy XLM → create XPi trustline.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            return@Column
        }

        // Language
        Text(stringResource(R.string.language), style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        ExposedDropdownMenuBox(expanded = langExpanded, onExpandedChange = { langExpanded = it }) {
            OutlinedTextField(
                value = langLabel,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(langExpanded) }
            )
            ExposedDropdownMenu(expanded = langExpanded, onDismissRequest = { langExpanded = false }) {
                LocaleHelper.languages.forEach { (code, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            currentLang = code
                            LocaleHelper.persist(context, code)
                            langExpanded = false
                            onLanguageChanged()
                        }
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // 1) Login
        Text("Already have a wallet?", fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = secret,
            onValueChange = { secret = it },
            label = { Text(stringResource(R.string.secret_key)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            enabled = !loading
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { viewModel.login(secret) },
            enabled = !loading && secret.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text(stringResource(R.string.login))
        }

        Spacer(Modifier.height(24.dp))

        // 2) Signup in-app only
        Text("New user?", fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = { viewModel.createWallet() },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth()
        ) { Text(stringResource(R.string.create_wallet)) }
        Text(
            stringResource(R.string.create_wallet_hint),
            fontSize = 12.sp,
            lineHeight = 16.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
        )

        if (error != null) {
            Spacer(Modifier.height(16.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(error, Modifier.padding(12.dp))
            }
        }
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.privacy_note),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
