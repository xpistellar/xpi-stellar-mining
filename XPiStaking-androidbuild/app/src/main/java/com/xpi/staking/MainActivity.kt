package com.xpi.staking

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.xpi.staking.ui.HomeScreen
import com.xpi.staking.ui.LoginScreen
import com.xpi.staking.ui.theme.XPiStakingTheme

class MainActivity : ComponentActivity() {
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(LocaleHelper.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            XPiStakingTheme {
                val vm: StakingViewModel = viewModel()
                val uiState by vm.uiState.collectAsState()
                var publicKey by remember { mutableStateOf<String?>(null) }

                if (uiState is StakingViewModel.UiState.LoggedIn) {
                    publicKey = (uiState as StakingViewModel.UiState.LoggedIn).publicKey
                }
                if (uiState is StakingViewModel.UiState.Idle) {
                    publicKey = null
                }

                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    if (publicKey == null) {
                        LoginScreen(
                            viewModel = vm,
                            modifier = Modifier.padding(innerPadding),
                            onLanguageChanged = { recreate() }
                        )
                    } else {
                        HomeScreen(
                            viewModel = vm,
                            publicKey = publicKey!!,
                            onLogout = {
                                vm.logout()
                                publicKey = null
                            },
                            modifier = Modifier.padding(innerPadding)
                        )
                    }
                }
            }
        }
    }
}
