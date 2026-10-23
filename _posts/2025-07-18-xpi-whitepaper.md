---
layout: default
title: "XPi Whitepaper"
date: 2025-07-18
---

# XPi: A Peer-to-Peer Electronic Cash System Based on Stellar

**Whitepaper**

### Abstract

A pure peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution. Digital signatures provide part of the solution, but the main benefits are lost if a trusted third party is still required to prevent double-spending.

We propose a solution to the double-spending problem using the proven Stellar network combined with Soroban smart contracts to distribute a scarce asset with a fixed total supply.

- **XPi total supply**: approximately 63 million units  
- **Operating group allocation**: under 15% (network protection, similar to early Bitcoin dormant addresses)  
- **Distribution**: 21 XPi per day via XLM staking  
- **Time to fully distribute community portion**: approximately 6,986 years  

The system inherits the Stellar Consensus Protocol, built-in DEX, extremely low fees, and the ability to run nodes on ordinary hardware, creating an asset that is scarce enough for long-term value storage and simple enough for anyone to own through private keys they control.

### 1. Introduction

Internet commerce has come to rely almost exclusively on financial institutions serving as trusted third parties. The system suffers from the inherent weaknesses of the trust-based model: high mediation costs, minimum practical transaction sizes, and the need for greater trust.

What is needed is an electronic payment system based on cryptographic proof instead of trust. XPi is designed to combine a fixed total supply with an extremely slow distribution mechanism and accessibility through modest XLM staking on the mature Stellar network.

### 2. Monetary Principles

The three basic functions of money are: medium of exchange, unit of account, and store of value. Fiat currencies easily lose purchasing power due to unlimited issuance. Gold served as a store of value for millennia thanks to natural scarcity. Bitcoin proved that digital scarcity is possible, but Proof-of-Work creates high barriers for ordinary people.

XPi combines:
- Fixed total supply
- Extremely slow distribution
- True ownership via private keys
- High accessibility through XLM staking

### 3. Transactions and Ownership

Each XPi is a chain of digital signatures. Users hold private keys and fully control their balances on the Stellar ledger. There is no central server storing balances.

### 4. Distribution Mechanism

- 21 XPi are released each day
- Distributed through a Soroban contract based on the amount of XLM staked
- Rewards scale roughly linearly with locked XLM
- Unstake at any time — XLM is returned

### 5. Conclusion

XPi aims to create a digital asset that is scarce enough to have long-term store-of-value potential and accessible enough for hundreds of millions of people to own directly.

---

[← Back to Home]({{ site.baseurl }}/)
