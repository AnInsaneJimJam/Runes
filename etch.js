const bitcoin = require("bitcoinjs-lib");
const axios = require("axios");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");

// Initialize ECPair with the required elliptic curve implementation
const ECPair = ECPairFactory(ecc);

const network = bitcoin.networks.testnet;

const yourAddress = "tb1qkz9d6g4m39626wlrn9m6unv5jvtrk2ktxqd2lu";
const privateKey = "cNR2qRtwVf6hrRVi9Kfomj59KSJQhjChqLG58au8c22aJt4G9uwP";

// Token properties
const token = {
	name: "BLOCSOC", // Max 28, capital
	symbol: "BLSC", // Max-4 capital
	totalSupply: 1000000, 
	decimals: 18,
	premine: 5000, // token allocation to etcher
	mintCap: 1000000, 
	mintAmount: 1000, // Tokens per mint transaction
	openMint: false, // Allow public mining -> false
	startBlock: 0, // Set to current block + 10 
	endBlock: 0, // Start + 1000
};

function encodeRunestone(token) {
	// Fetch current block height for startBlock
	return axios
		.get("https://mempool.space/testnet/api/blocks/tip/height")
		.then((response) => {
			const currentBlock = response.data;
			token.startBlock = currentBlock + 10;
			token.endBlock = token.startBlock + 1000;
			// Runes format: varints + opcodes (simplified here)
			const runestone = [
				"RUNE",
				"ETCH",
				token.name,
				token.symbol,
				token.totalSupply.toString(),
				token.decimals.toString(),
				token.premine.toString(),
				token.mintCap.toString(),
				token.mintAmount.toString(),
				token.openMint ? "1" : "0",
				token.startBlock.toString(),
				token.endBlock.toString(),
			].join(":");
			return Buffer.from(runestone).toString("hex");
		});
}

async function etchRune() {
	try {
		// Fetch UTXOs
		const utxoResponse = await axios.get(
			`https://mempool.space/testnet/api/address/${yourAddress}/utxo`
		);
		const utxos = utxoResponse.data;
		const utxo = utxos.find((u) => u.value >= 100000); // 0.0001 tBTC usually requires about 0.0009
		if (!utxo) throw new Error("Insufficient tBTC");

		// Create PSBT
		const psbt = new bitcoin.Psbt({ network });

		// We need to get the scriptPubKey for the input
		const addressInfo = await axios.get(
			`https://mempool.space/testnet/api/address/${yourAddress}`
		);
		const scriptPubKey =
			addressInfo.data.scriptPubKey ||
			bitcoin.address
				.toOutputScript(yourAddress, network)
				.toString("hex");

		psbt.addInput({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: {
				script: Buffer.from(scriptPubKey, "hex"),
				value: utxo.value,
			},
		});

		// Add OP_RETURN with Runestone
		const runestoneData = await encodeRunestone(token);
		const data = Buffer.from(runestoneData, "hex");

		// Use bitcoin.script.compile correctly in v6
		psbt.addOutput({
			script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]),
			value: 0,
		});

		// Add premine output (tokens to your address)
		psbt.addOutput({
			address: yourAddress,
			value: 546, // Dust limit
		});

		// Add change output
		const fee = 1000; // Adjust based on testnet
		psbt.addOutput({
			address: yourAddress,
			value: utxo.value - 546 - fee,
		});

		// Sign with private key
		const keyPair = ECPair.fromWIF(privateKey, network);
		psbt.signInput(0, keyPair);
		psbt.finalizeAllInputs();

		// Broadcast
		const txHex = psbt.extractTransaction().toHex();
		const broadcastResponse = await axios.post(
			"https://mempool.space/testnet/api/tx",
			txHex
		);
		console.log("Etched! TxID:", broadcastResponse.data);
		console.log(
			"Rune ID: Check block height and tx index after confirmation"
		);
	} catch (error) {
		console.error("Error:", error.message);
		if (error.response) {
			console.error("Response data:", error.response.data);
		}
	}
}

etchRune();
