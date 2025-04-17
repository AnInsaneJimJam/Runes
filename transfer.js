const bitcoin = require("bitcoinjs-lib");
const axios = require("axios");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");

// Initialize ECPair with the required elliptic curve implementation
const ECPair = ECPairFactory(ecc);

const network = bitcoin.networks.testnet;

// Configuration (update these values)
const sourceAddress = "tb1qkz9d6g4m39626wlrn9m6unv5jvtrk2ktxqd2lu";
const destinationAddress = "tb1q7zptldf0fknnmlvr2szus26zdw9qx9rt9t77df"; // Replace with recipient address
const privateKey = "cNR2qRtwVf6hrRVi9Kfomj59KSJQhjChqLG58au8c22aJt4G9uwP";
// const runeId =
// 	"0f79fd6e8d049dc3cf050badae8581b1d83d2682fe2c6ddcef029bf818ffcdf3:1:42578520123"; // Replace with your actual rune ID (format: TXID:vout:runeNumber)
const runeId =
	"4257852:123"; // Replace with your actual rune ID (format: TXID:vout:runeNumber)
const amountToTransfer = 1000; // Amount of runes to transfer

async function transferRunes() {
	try {
		// Fetch UTXOs
		const utxoResponse = await axios.get(
			`https://mempool.space/testnet/api/address/${sourceAddress}/utxo`
		);
		const utxos = utxoResponse.data;
		const utxo = utxos.find((u) => u.value >= 10000); // Need enough to cover fees

		if (!utxo) throw new Error("Insufficient tBTC for transaction");

		// Create PSBT
		const psbt = new bitcoin.Psbt({ network });

		// Get scriptPubKey for the input
		const addressInfo = await axios.get(
			`https://mempool.space/testnet/api/address/${sourceAddress}`
		);
		const scriptPubKey =
			addressInfo.data.scriptPubKey ||
			bitcoin.address
				.toOutputScript(sourceAddress, network)
				.toString("hex");

		// Add input
		psbt.addInput({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: {
				script: Buffer.from(scriptPubKey, "hex"),
				value: utxo.value,
			},
		});

		// Create the RUNE_TRANSFER envelope
		const runeTransferData = [
			"RUNE",
			"TRANSFER",
			runeId,
			amountToTransfer.toString(),
		].join(":");

		const data = Buffer.from(runeTransferData);

        if (data.length > 80) {
			throw new Error(
				`OP_RETURN data too large: ${data.length} bytes (max 80)`
			);
		}

		// Add OP_RETURN output with transfer instructions
		psbt.addOutput({
			script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]),
			value: 0,
		});

		// Add destination output for the runes (must be at least dust limit)
		psbt.addOutput({
			address: destinationAddress,
			value: 546, // Dust limit
		});

		// Add change output (minus fees)
		const fee = 1000; // Adjust based on current testnet fees
		const changeAmount = utxo.value - 546 - fee;

		if (changeAmount < 0) {
			throw new Error("Insufficient funds to cover transaction fees");
		}

		psbt.addOutput({
			address: sourceAddress,
			value: changeAmount,
		});

		// Sign transaction
		const keyPair = ECPair.fromWIF(privateKey, network);
		psbt.signInput(0, keyPair);
		psbt.finalizeAllInputs();

		// Extract and broadcast transaction
		const txHex = psbt.extractTransaction().toHex();
		const broadcastResponse = await axios.post(
			"https://mempool.space/testnet/api/tx",
			txHex
		);

		console.log("Runes transfer successful!");
		console.log("Transaction ID:", broadcastResponse.data);
		console.log(
			`Transferred ${amountToTransfer} of rune ${runeId} to ${destinationAddress}`
		);
	} catch (error) {
		console.error("Error transferring runes:", error.message);
		if (error.response) {
			console.error("Response data:", error.response.data);
		}
	}
}

// Execute the transfer
transferRunes();
