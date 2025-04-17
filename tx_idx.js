// Bitcoin Transaction Index Finder (Mainnet & Testnet)
// This script takes a Bitcoin txid and returns both block height and tx index within that block

const axios = require("axios");

async function getTxDetailsWithIndex(txid, network = "mainnet") {
	// Set the base URL based on the selected network
	const baseUrl =
		network === "testnet"
			? "https://mempool.space/testnet/api"
			: "https://mempool.space/api";

	try {
		// Step 1: Get transaction details including block height
		const txResponse = await axios.get(`${baseUrl}/tx/${txid}`);
		const blockHeight = txResponse.data.status.block_height;

		if (!blockHeight) {
			return { error: "Transaction not confirmed in a block yet" };
		}

		console.log(`Block height: ${blockHeight}`);

		// Step 2: Get the block hash using block height
		const blockResponse = await axios.get(
			`${baseUrl}/block-height/${blockHeight}`
		);
		const blockHash = blockResponse.data;

		console.log(`Block hash: ${blockHash}`);

		const txidsResponse = await axios.get(
			`${baseUrl}/block/${blockHash}/txids`
		);
		const txids = txidsResponse.data;

		console.log(`Retrieved ${txids.length} transaction IDs from block`);

		// Step 4: Find the index of our transaction
		const txIndex = txids.findIndex((id) => id === txid);

		if (txIndex === -1) {
			return { error: "Transaction not found in block" };
		}

		return {
			txid,
			network,
			blockHeight,
			blockHash,
			txIndex,
			totalTxs: txids.length,
		};
	} catch (error) {
		console.error("Error details:", error.message);
		return {
			error: `Error fetching transaction details: ${error.message}`,
			details: error.response?.data || {},
		};
	}
}

// Try both networks if network is not specified
async function tryBothNetworks(txid) {
	// First try mainnet
	let result = await getTxDetailsWithIndex(txid, "mainnet");

	// If mainnet fails, try testnet
	if (result.error && !result.error.includes("Transaction not confirmed")) {
		console.log("Transaction not found on mainnet, trying testnet...");
		result = await getTxDetailsWithIndex(txid, "testnet");
	}

	return result;
}

// Example usage
async function main() {
	const txid = process.argv[2];

	const specifiedNetwork = process.argv[3];

	if (!txid) {
		console.log("Please provide a transaction ID as the first argument");
		console.log("Usage: node script.js <txid> [network]");
		console.log(
			"Network options: mainnet, testnet (defaults to trying both)"
		);
		process.exit(1);
	}

	console.log(`Looking up transaction: ${txid}`);

	let result;

	if (specifiedNetwork === "mainnet" || specifiedNetwork === "testnet") {
		// Use specified network
		result = await getTxDetailsWithIndex(txid, specifiedNetwork);
	} else {
		// Try both networks
		result = await tryBothNetworks(txid);
	}

	console.log(JSON.stringify(result, null, 2));
}

// Run the script
main().catch((error) => {
	console.error("Fatal error:", error);
});
