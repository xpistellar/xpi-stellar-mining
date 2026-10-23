---
layout: default
title: Manual
---

# XPi Staking Manual

Stake XLM on the Stellar network to earn XPi through a Soroban smart contract.

* **Contract ID**: `CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H`
* **Minimum stake**: 31.4 XLM
* **Approximate reward**: ~0.0000003 XPi per day per 31.4 XLM (scales roughly linearly)
* Users keep full control of their private keys

---

## 1. Node.js CLI Tool (Ubuntu)

A simple command-line tool to stake, unstake, claim rewards, and check your balance.

### Requirements

* Ubuntu 20.04 or newer
* Internet connection

### Step 1: Install Node.js

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Step 2: Create project folder

```bash
mkdir ~/xpi-staking
cd ~/xpi-staking
```

Download or create the file `stake-claim.js` and paste the Node.js staking script into it.

### Step 3: Install dependencies

```bash
npm init -y
npm install @stellar/stellar-sdk
```

### Step 4: Run the tool

```bash
node stake-claim.js
```

You will be asked for your Stellar secret key (starts with `S...`).

**Menu:**

1. Stake XLM (minimum 31.4)
2. Unstake XLM (press Enter or type 0 to unstake all)
3. Claim XPi rewards
4. View current stake
5. View pending rewards
6. Exit

### Important

* **Never share your secret key**.
* Make sure your account has enough XLM for the stake + network fees.
* You can unstake at any time.

---

## 2. Android App – Direct Install (APK)

### Requirements

* Android 8.0 or higher
* Allow installation from unknown sources

### Installation

1. Download the APK from the official project source
2. Open the APK file and allow installation
3. Open the app → connect your Stellar wallet (or enter secret key if supported)
4. Add the XPi trustline if you have not already
5. Stake XLM and claim rewards following the in-app instructions

---

## 3. Using a Regular Stellar Wallet

You can also interact with the contract through wallets that support Soroban (e.g. Freighter, Lobstr, xBull…) once you understand how to call the contract.

**Always verify the Contract ID and Issuer before performing any transaction.**

---

[← Back to Home](index.html)
