# Healthcare Access Platform

A blockchain-powered platform that enhances healthcare access by enabling secure, patient-controlled medical records, incentivizing preventive care, and streamlining provider payments — all on-chain using Clarity smart contracts.

---

## Overview

The Healthcare Access Platform consists of four main smart contracts that create a decentralized, transparent, and patient-centric healthcare ecosystem:

1. **Patient Data Contract** – Manages secure, encrypted storage and sharing of patient medical records.
2. **Health Incentive Contract** – Rewards patients for preventive care activities like vaccinations or check-ups.
3. **Provider Payment Contract** – Facilitates transparent and automated payments to healthcare providers.
4. **Access Control Contract** – Governs patient consent and access rights to medical data.

---

## Features

- **Secure medical records** stored on-chain with patient-controlled access
- **Incentives for preventive care** through token rewards for healthy behaviors
- **Transparent provider payments** with automated, auditable transactions
- **Granular access control** for sharing medical data with providers or researchers

---

## Smart Contracts

### Patient Data Contract

- Stores encrypted medical records on-chain
- Allows patients to grant/revoke access to specific providers
- Tracks data access history for transparency

### Health Incentive Contract

- Rewards patients with tokens for verified preventive care (e.g., check-ups, vaccinations)
- Integrates with oracles for activity verification
- Configurable reward schedules and conditions

### Provider Payment Contract

- Automates payments to healthcare providers based on service delivery
- Tracks payment history and disputes
- Supports partial payments and refunds

### Access Control Contract

- Manages patient consent for data sharing
- Enforces role-based access (e.g., doctor, researcher, insurer)
- Logs all access requests and approvals

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/healthcare-access-platform.git
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Deploy contracts:
   ```bash
   clarinet deploy
   ```

## Usage

Each smart contract operates independently but integrates with others to form a cohesive healthcare access ecosystem. Refer to individual contract documentation for function calls, parameters, and usage examples.

## License

MIT License
