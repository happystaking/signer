/**
 * Create, sign and submit a Cardano transaction
 *
 * Documentation:
 * https://developers.cardano.org/docs/get-started/cardano-serialization-lib/overview
 * https://github.com/blockfrost/blockfrost-js
 */

import fs from 'fs';
import CardanoWasm from "@emurgo/cardano-serialization-lib-nodejs";
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { program } from 'commander';
import { resolve } from 'path';

/**
 * ATTENTION: This file contains a private key!
 * Make sure to chmod this file to be read only by the owner, not by anyone
 * else. Also make sure this wallet address does not contain more funds than
 * you're willing to lose.
 *
 * Change these variables to match your environment:
 */
const lovelaceSpendingLimit = 50000000;
const senderPrivateKey = '';
const senderAddress = '';
const blockfrostProjectId = '';
const blockfrostNetwork = '';
const metadataLines = [
    'This automated transaction is powered by HAPPY Staking Pool 🥳'
];

// Parse commandline arguments
program.name('signer.js')
    .description('Create, sign and submit a Cardano transaction')
    .version('0.1.0', '-v, --version')
    .usage('[OPTIONS]...')
    .requiredOption('-r, --recipient <string>', 'Shelley-era recipient address')
    .requiredOption('-l, --lovelace <number>', 'quantity of Lovelace to send to recipient')
    .option('-o, --out-file <string>', 'file to write transaction to', './tx.signed')
    .option('-s, --submit', 'submit tx and don\'t write to out-file', false)
    .parse(process.argv);
const options = program.opts();

let recipientAddress = options.recipient;
let lovelaceAmountToSend = options.lovelace;

// Terminate the program if the spending limit is exceeded
if (lovelaceAmountToSend > lovelaceSpendingLimit) {
    console.error('amount exceeds spending limit');
    process.exit(1);
}

// We need the network parameters to set the fee and the ttl
const API = new BlockFrostAPI({projectId: blockfrostProjectId, network: blockfrostNetwork});
const latestEpochParameters = await API.epochsLatestParameters();
const latestBlock = await API.blocksLatest();
const paymentUtxos = await API.addressesUtxos(senderAddress);
const linearFee = CardanoWasm.LinearFee.new(
    CardanoWasm.BigNum.from_str(latestEpochParameters.min_fee_a.toString()),
    CardanoWasm.BigNum.from_str(latestEpochParameters.min_fee_b.toString())
);

// Transaction base config using the latest network parameters
const txBuilder = CardanoWasm.TransactionBuilder.new(
    CardanoWasm.TransactionBuilderConfigBuilder.new()
        .fee_algo(linearFee)
        .pool_deposit(CardanoWasm.BigNum.from_str(latestEpochParameters.pool_deposit))
        .key_deposit(CardanoWasm.BigNum.from_str(latestEpochParameters.key_deposit))
        .max_value_size(parseInt(latestEpochParameters.max_val_size))
        .max_tx_size(latestEpochParameters.max_tx_size)
        .coins_per_utxo_word(CardanoWasm.BigNum.from_str(latestEpochParameters.coins_per_utxo_size.toString()))
        .build()
);

// Set sender private key, sender address and recipient address
const privateKeySender = CardanoWasm.PrivateKey.from_hex(senderPrivateKey);
const shelleyAddressSenderForChange = CardanoWasm.Address.from_bech32(senderAddress);
const shelleyAddressRecipient = CardanoWasm.Address.from_bech32(recipientAddress);

// Add all the UTxO's with their lovelace quantity to the transaction
paymentUtxos.forEach(function(utxo) {
    txBuilder.add_key_input(
        privateKeySender.to_public().hash(),
        CardanoWasm.TransactionInput.new(
            CardanoWasm.TransactionHash.from_bytes(
                Buffer.from(utxo.tx_hash, 'hex')
            ),
            utxo.output_index,
        ),
        CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(
            utxo.amount.reduce(function (acc, obj) { return acc + obj.quantity; }, 0).toString()
        ))
    );
});

// Add the output with the amount of ADA to send
txBuilder.add_output(
    CardanoWasm.TransactionOutput.new(
        shelleyAddressRecipient,
        CardanoWasm.Value.new(CardanoWasm.BigNum.from_str(lovelaceAmountToSend.toString()))
    ),
);

// Build metadata objects and add content
const metaAuxiliaryData = CardanoWasm.AuxiliaryData.new()
const metaTransactionData = CardanoWasm.GeneralTransactionMetadata.new()
metadataLines.forEach(function(line, key) {
    metaTransactionData.insert(
        CardanoWasm.BigNum.from_str(key.toString()),
        CardanoWasm.encode_json_str_to_metadatum(JSON.stringify(line))
    );
});
metaAuxiliaryData.set_metadata(metaTransactionData);

// Set TTL, metadata and calculate the fee
txBuilder.set_ttl(latestBlock.slot + 200);
txBuilder.set_metadata(metaTransactionData);
txBuilder.add_change_if_needed(shelleyAddressSenderForChange);

// Create transaction and add hashkey witnesses
const txBody = txBuilder.build();
const txHash = CardanoWasm.hash_transaction(txBody);
const txmetaAuxiliaryDataHash = CardanoWasm.hash_auxiliary_data(metaAuxiliaryData);
const witnesses = CardanoWasm.TransactionWitnessSet.new();
const vkeyWitnesses = CardanoWasm.Vkeywitnesses.new();
const vkeyWitness = CardanoWasm.make_vkey_witness(txHash, privateKeySender);
txBody.set_auxiliary_data_hash(txmetaAuxiliaryDataHash);
vkeyWitnesses.add(vkeyWitness);
witnesses.set_vkeys(vkeyWitnesses);

// Create the finalized transaction with witnesses
const transaction = CardanoWasm.Transaction.new(
    txBody,
    witnesses,
    metaAuxiliaryData
);

// Submit transaction to Blockfrost or write it to the filesystem
if (options.submit) {
    try {
        const submitResult = await API.txSubmit(transaction.to_bytes());
        console.log('transaction ' + submitResult + ' successfully submitted');
    } catch (error) {
        console.log("failed to submit transaction\n" + error);
        process.exitCode = 1;
    }
} else {
    try {
        fs.writeFileSync(resolve(options.outFile), transaction.to_bytes());
        console.log('transaction written to ' + resolve(options.outFile));
    } catch (error) {
        console.error('failed to write transaction to ' + resolve(options.outFile) + "\n" + error);
        process.exitCode = 1;
    }
}

