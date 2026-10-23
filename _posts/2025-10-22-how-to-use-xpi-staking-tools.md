---
layout: default
title: "How to Use XPi Staking Tools – A Practical Guide"
date: 2025-10-22
---

# How to Use XPi Staking Tools – A Practical Guide

XPi is designed so that ordinary people can participate without specialized hardware. This guide explains the practical ways users can stake XLM and receive XPi.

## What You Need Before Starting

- A Stellar wallet that you control (Freighter, Lobstr, xBull, or any wallet that supports secret keys)
- At least **31.4 XLM** (the minimum stake) plus a small amount for network fees
- The official Contract ID:  
  `CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H`
- The official Issuer:  
  `GDOFJEZ3FUWAC2EVHPRMJPSWPOD3KJF7FTXFZIERFFPB2VMTRQLZFUEF`

Always verify these identifiers on [Stellar Expert](https://stellar.expert) before interacting.

## Option 1: Node.js CLI Tool (Recommended for Desktop Users)

### Installation (Ubuntu / Linux)

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

mkdir ~/xpi-staking
cd ~/xpi-staking
npm init -y
npm install @stellar/stellar-sdk
```

Place the official `stake-claim.js` script in the folder, then run:

```bash
node stake-claim.js
```

### Main Menu Functions

1. **Stake XLM** – Lock XLM into the contract (minimum 31.4)
2. **Unstake XLM** – Return your XLM at any time
3. **Claim XPi rewards** – Receive earned XPi into your wallet
4. **View current stake** – Check how much XLM is locked
5. **View pending rewards** – See accumulated XPi waiting to be claimed
6. **Exit**

### Important Safety Rules

- Never share your secret key (starts with `S...`)
- Keep a secure offline backup of the key
- Only stake amounts you can afford to lock temporarily
- Always double-check the Contract ID before confirming a transaction

## Option 2: Android App (APK)

1. Download the official APK from the project’s GitHub Releases page
2. Allow installation from unknown sources on your phone
3. Open the app and create a new wallet or import an existing secret key
4. Add the official XPi trustline
5. Stake XLM and claim rewards directly inside the app

The app is designed for convenience. All private keys remain under your control.

## Option 3: Regular Stellar Wallets Supporting Soroban

Advanced users can interact with the contract through wallets that support Soroban smart contracts (Freighter, xBull, etc.). This requires understanding how to call contract functions and is recommended only for experienced users.

## Reward Structure (Approximate)

| Staked XLM | Approx. XPi per day |
|------------|---------------------|
| 31.4       | 0.0000003           |
| 314        | 0.0000031           |
| 3,140      | 0.000031            |
| 31,400     | 0.00031             |

Rewards scale roughly linearly. The entire system still releases only **21 XPi per day** in total.

## Key Takeaway

XPi tools are intentionally simple. Whether you use the CLI, the Android app, or a compatible wallet, the core idea remains the same: stake a modest amount of XLM, keep control of your private keys, and accumulate a scarce asset over the long term.

---

[← Back to Home]({{ site.baseurl }}/)
