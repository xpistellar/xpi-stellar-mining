package com.astroloop.game.xpi

import android.content.Context

/** Session shared by the Compose login gate and the Canvas hangar store. */
object XpiBridge {
    var onOpenWallet: (() -> Unit)? = null
    const val PREFS = "xpi_wallet"
    const val KEY_SECRET = "secret"
    const val KEY_PUBLIC = "public_key"

    @Volatile
    var viewModel: StakingViewModel? = null

    fun savedSecret(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SECRET, null)
            ?.takeIf { it.isNotBlank() }

    fun save(context: Context, secret: String, publicKey: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_SECRET, secret)
            .putString(KEY_PUBLIC, publicKey)
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        viewModel = null
    }

    /** Fire-and-forget Soroban claim_game. No-op until login has attached the ViewModel. */
    fun claimGame() {
        viewModel?.claimGame()
    }

    /** Fire-and-forget Soroban claim. No-op until login has attached the ViewModel. */
    fun claim() {
        viewModel?.claim()
    }
}
