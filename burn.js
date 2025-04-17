const bitcoin = require("bitcoinjs-lib");
const axios = require("axios");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");

// Initialize ECPair with the required elliptic curve implementation
const ECPair = ECPairFactory(ecc);

// Use testnet network
const network = bitcoin.networks.testnet;

// Configuration (update these values)
const sourceAddress = "tb1qkz9d6g4m39626wlrn9m6unv5jvtrk2ktxqd2lu";
const privateKey = "cNR2qRtwVf6hrRVi9Kfomj59KSJQhjChqLG58au8c22aJt4G9uwP";

// Rune to burn
const runeId = "4257852:123"; // Replace with your actual rune ID
const amountToBurn = 500; // Amount of runes to burn

// Burn address - This is a standard OP_RETURN address for Bitcoin
const BURN_ADDRESS = "tb1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqudgl6";

async function burnRunes() {
	try {
		console.log(`Burning ${amountToBurn} of rune ${runeId}`);

		// Fetch UTXOs for the source address
		const utxoResponse = await axios.get(
			`https://mempool.space/testnet/api/address/${sourceAddress}/utxo`
		);
		const utxos = utxoResponse.data;
		const utxo = utxos.find((u) => u.value >= 10000); // Need enough to cover fees

		if (!utxo) throw new Error("Insufficient tBTC for transaction");
		console.log(
			`Found UTXO: ${utxo.txid}:${utxo.vout} with value ${utxo.value} sats`
		);

		// Create PSBT (Partially Signed Bitcoin Transaction)
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

		// Create the RUNE_BURN envelope by sending to burn address
		const runeBurnData = [
			"RUNE",
			"BURN",
			runeId,
			amountToBurn.toString(),
		].join(":");

		const data = Buffer.from(runeBurnData);

		if (data.length > 80) {
			throw new Error(
				`OP_RETURN data too large: ${data.length} bytes (max 80)`
			);
		}

		// Add OP_RETURN output with burn instructions
		psbt.addOutput({
			script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]),
			value: 0,
		});

		// Add output to burn address (minimal amount required)
		psbt.addOutput({
			address: BURN_ADDRESS,
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

		// Extract transaction
		const tx = psbt.extractTransaction();
		const txHex = tx.toHex();
		console.log("Transaction created:");
		console.log("Transaction size:", txHex.length / 2, "bytes");
		console.log("Transaction fees:", fee, "satoshis");

		// Broadcast transaction
		console.log("Broadcasting transaction...");
		const broadcastResponse = await axios.post(
			"https://mempool.space/testnet/api/tx",
			txHex
		);

		console.log("Rune burn successful!");
		console.log("Transaction ID:", broadcastResponse.data);
		console.log(`Burned ${amountToBurn} of rune ${runeId}`);
		console.log("You can check this transaction at:");
		console.log(
			`https://mempool.space/testnet/tx/${broadcastResponse.data}`
		);
	} catch (error) {
		console.error("Error burning runes:", error.message);
		if (error.response) {
			console.error("API Response data:", error.response.data);
		}
	}
}

// Execute the burn
burnRunes();
