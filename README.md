# Cardano transaction signer

This program can create a signed Cardano transaction using the [cardano-serialization-lib](https://github.com/Emurgo/cardano-serialization-lib). The signed, serialized transaction can be saved to the filesystem, or submitted to the blockchain using [Blockfrost](https://blockfrost.io). Transaction fees are automatically calculated and optional metadata can be added to the transaction.

## Installation

Clone the repository and and enter the `signer` directory. Make sure NodeJS is installed on your system and run `npm i` to install dependencies.

Use `cardano-cli` to create the private key, public key and wallet address. Paste the values into the `signer.js` configuration section.

⚠️ **Keep your private key private and take measures to avoid your private key from being stolen! There are risks involved such as losing all of your funds when keeping an unencrypted private key on an (online) system!**

1. `cardano-cli address key-gen --verification-key-file payment.vkey --signing-key-file payment.skey`
2. Open `payment.skey` (your private key) and copy the value from the `cborHex` field.
3. Open `signer.js` and paste the private key between the apostrophs after `senderPrivateKey`, then delete the first four digits (5820).

Creating a stake address is optional. If you don't want a stake address, then skip steps 4 and 6 and remove `--stake-verification-key-file stake.vkey` from step 5.

4. `cardano-cli stake-address key-gen --verification-key-file stake.vkey --signing-key-file stake.skey`
5. `cardano-cli address build --payment-verification-key-file payment.vkey --stake-verification-key-file stake.vkey --out-file payment.addr --mainnet`
6. `cardano-cli stake-address build --stake-verification-key-file stake.vkey --out-file stake.addr --mainnet`
7. Copy the content from `payment.addr` and paste it between the apostrophs after `senderAddress` in `signer.js`.
8. Enter the Blockfrost details in `blockfrostProjectId` and `blockfrostNetwork` in `signer.js`. This is also needed if you don't want to submit your transaction to Blockfrost.

## Usage

Amounts need to be entered in Lovelace. For example: to create and submit a transaction that sends 5 ADA to HAPPY Staking Pool 🥳, enter:

`node signer.js -r addr1q8y586dw03ae7g6eknsm49pmngjuy2d64lkmsx6pj994sv56hvet7y3x27f76j6e2gz9rq42k992mqz8s39mrl7ndafqkdgxqw -l 5000000 --submit`

Enter `node signer.js -h` for more help on running the program.

## Contributing

If you find this program useful, please consider delegating to ticker HAPPY, or make a donation. 