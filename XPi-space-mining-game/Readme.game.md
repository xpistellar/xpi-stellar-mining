
# XPI Space Mining

Play the classic XPI Space Mining hangar and combat experience, then earn **XPi** tokens on the Stellar network. Stake XLM into a Soroban smart contract and claim rewards directly from the game.

## Key Features

- **Full XPI Space Mining gameplay** — Crew selection, ship upgrades, hangar, and combat runs.
- **Stellar wallet login** — Sign in with your Stellar secret key (S…). No account is stored on the device; you must log in every session.
- **Create wallet in-app** — Generate a new Stellar key pair directly inside the game. The secret is shown only once so you can save it offline.
- **Wallet screen** — Stake XLM, unstake, view pending rewards, and claim staking rewards.
- **In-game claim** — The “XPi Core” purchase in the shop triggers the contract’s `claim_game` function (max 10 claims per day, requires ≥ 31.4 XLM staked).
- **Floating Wallet access** — Tap the floating X button in the hangar to open the Wallet screen at any time.

## How It Works

1. Launch the app and log in with your Stellar secret key (or create a new wallet).
2. Stake at least **31.4 XLM** into the Soroban contract.
3. Play the game normally.
4. When you win or use the XPi Core item, call `claim_game` to receive XPi on-chain.
5. Use the Wallet screen to claim regular staking rewards or unstake.

## Contract

- Contract ID: `CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H`
- Functions used: `stake`, `unstake`, `claim`, `claim_game`, `get_stake`, `pending`

## Requirements

- Android 8.0+ (API 26)
- A Stellar account with XLM for staking and network fees
- Internet connection for on-chain transactions


---

*Play the game. Earn on-chain.*
