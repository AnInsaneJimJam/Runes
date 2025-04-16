// index.js - Main application code
// Import libraries using ES modules or CDN scripts
// Note: For browser compatibility, we'll need to use CDN versions of these libraries

document.addEventListener("DOMContentLoaded", () => {
	const connectWalletBtn = document.getElementById("connect-wallet");
	const createTokenBtn = document.getElementById("create-token");
	const walletStatusEl = document.getElementById("wallet-status");

	// User wallet state
	const userWallet = {
		connected: false,
		address: null,
	};

	// Initialize wallet connection button
	connectWalletBtn.addEventListener("click", connectWallet);
	createTokenBtn.addEventListener("click", handleCreateToken);

	// Check if wallet is already connected
	checkWalletConnection();
});

// Check if user has a connected wallet already
async function checkWalletConnection() {
	// Check if we have a Bitcoin wallet extension available
	if (window.btc || window.BitcoinProvider || window.unisat) {
		const provider = window.btc || window.BitcoinProvider || window.unisat;
		try {
			const accounts = await provider.requestAccounts();
			if (accounts && accounts.length > 0) {
				updateWalletStatus(true, accounts[0]);
			}
		} catch (error) {
			console.log("No pre-connected wallet found");
		}
	}
}

// Connect wallet function
async function connectWallet() {
	try {
		// Check for different Bitcoin wallet providers
		const provider = window.btc || window.BitcoinProvider || window.unisat;

		if (!provider) {
			alert(
				"No Bitcoin wallet extension found. Please install UniSat Wallet, Xverse, or another Bitcoin wallet extension."
			);
			return;
		}

		// Request wallet accounts
		const accounts = await provider.requestAccounts();

		if (accounts && accounts.length > 0) {
			updateWalletStatus(true, accounts[0]);
			return true;
		}
	} catch (error) {
		console.error("Error connecting wallet:", error);
		alert("Failed to connect wallet: " + error.message);
		return false;
	}
	return false;
}

// Update UI when wallet connection changes
function updateWalletStatus(connected, address) {
	const walletStatusEl = document.getElementById("wallet-status");
	const connectWalletBtn = document.getElementById("connect-wallet");
	const createTokenBtn = document.getElementById("create-token");

	userWallet.connected = connected;
	userWallet.address = address;

	if (connected) {
		walletStatusEl.textContent = `Connected: ${address.substring(
			0,
			6
		)}...${address.substring(address.length - 4)}`;
		walletStatusEl.classList.add("connected");
		connectWalletBtn.textContent = "Wallet Connected";
		createTokenBtn.disabled = false;
	} else {
		walletStatusEl.textContent = "Wallet not connected";
		walletStatusEl.classList.remove("connected");
		connectWalletBtn.textContent = "Connect Wallet";
		createTokenBtn.disabled = true;
	}
}

// Handle token creation
async function handleCreateToken() {
	// Get token details from form
	const token = {
		name: document.getElementById("token-name").value,
		symbol: document.getElementById("token-symbol").value,
		totalSupply: parseInt(document.getElementById("token-supply").value),
		decimals: parseInt(document.getElementById("token-decimals").value),
		premine: parseInt(document.getElementById("token-premine").value),
		mintCap: parseInt(document.getElementById("token-mint-cap").value),
		mintAmount: parseInt(
			document.getElementById("token-mint-amount").value
		),
		openMint: document.getElementById("token-open-mint").checked,
		startBlock: 0,
		endBlock: 0,
	};

	// Validate token properties
	if (!validateToken(token)) {
		return;
	}

	// Ensure wallet is connected
	if (!userWallet.connected) {
		alert("Please connect your wallet first");
		return;
	}

	try {
		// Show loading indicator
		document.getElementById("loading").style.display = "block";

		// Etch the token
		await etchRune(token, userWallet.address);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";

		// Show success message
		alert("Token etched successfully!");
	} catch (error) {
		console.error("Error creating token:", error);
		alert("Failed to create token: " + error.message);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";
	}
}

// Validate token properties
function validateToken(token) {
	if (!token.name || token.name.length > 28) {
		alert("Token name must be 1-28 characters");
		return false;
	}

	if (!token.symbol || token.symbol.length > 4) {
		alert("Token symbol must be 1-4 characters");
		return false;
	}

	if (isNaN(token.totalSupply) || token.totalSupply <= 0) {
		alert("Total supply must be a positive number");
		return false;
	}

	return true;
}

// Encode rune data
async function encodeRunestone(token) {
	// Fetch current block height for startBlock
	try {
		const response = await fetch(
			"https://mempool.space/testnet/api/blocks/tip/height"
		);
		const currentBlock = await response.json();
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

		return stringToHex(runestone);
	} catch (error) {
		console.error("Error fetching block height:", error);
		throw error;
	}
}

// Helper function to convert string to hex
function stringToHex(str) {
	let hex = "";
	for (let i = 0; i < str.length; i++) {
		hex += str.charCodeAt(i).toString(16).padStart(2, "0");
	}
	return hex;
}

// Etch the rune using wallet to sign transaction
async function etchRune(token, userAddress) {
	try {
		// This implementation requires bitcoinjs-lib, which needs to be loaded via script tag
		// Check if bitcoinjs-lib is loaded
		// if (typeof bitcoin === "undefined") {
		// 	throw new Error(
		// 		"bitcoinjs-lib is not loaded. Please include it in your HTML file."
		// 	);
		// }

		// Fetch UTXOs
		const utxoResponse = await fetch(
			`https://mempool.space/testnet/api/address/${userAddress}/utxo`
		);
		const utxos = await utxoResponse.json();
		const utxo = utxos.find((u) => u.value >= 10000); // 0.0001 tBTC
		if (!utxo) throw new Error("Insufficient tBTC in your wallet");

		// Get the Bitcoin network from global bitcoinjs-lib
		const network = bitcoin.networks.testnet;

		// Create PSBT
		const psbt = new bitcoin.Psbt({ network });

		// Get address info for input
		const addressInfoResponse = await fetch(
			`https://mempool.space/testnet/api/address/${userAddress}`
		);
		const addressInfo = await addressInfoResponse.json();
		const scriptPubKey =
			addressInfo.scriptPubKey ||
			bitcoin.address
				.toOutputScript(userAddress, network)
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

		// Add OP_RETURN with Runestone
		const runestoneData = await encodeRunestone(token);
		const data = Buffer.from(runestoneData, "hex");

		// Add OP_RETURN output
		psbt.addOutput({
			script: bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, data]),
			value: 0,
		});

		// Add premine output (tokens to user address)
		psbt.addOutput({
			address: userAddress,
			value: 546, // Dust limit
		});

		// Add change output
		const fee = 1000; // Adjust based on testnet
		psbt.addOutput({
			address: userAddress,
			value: utxo.value - 546 - fee,
		});

		// Get the PSBT in base64 format
		const psbtBase64 = psbt.toBase64();

		// Create a popup to sign transaction
		const provider = window.btc || window.BitcoinProvider || window.unisat;

		if (!provider || !provider.signPsbt) {
			throw new Error(
				"Your wallet doesn't support PSBT signing. Please use UniSat Wallet."
			);
		}

		// Sign the PSBT using wallet (this will trigger a popup)
		const signedPsbtBase64 = await provider.signPsbt(psbtBase64);

		// Convert back to PSBT
		const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, {
			network,
		});

		// Finalize and extract transaction
		signedPsbt.finalizeAllInputs();
		const txHex = signedPsbt.extractTransaction().toHex();

		// Broadcast
		const broadcastResponse = await fetch(
			"https://mempool.space/testnet/api/tx",
			{
				method: "POST",
				body: txHex,
				headers: {
					"Content-Type": "text/plain",
				},
			}
		);

		const txId = await broadcastResponse.text();
		console.log("Etched! TxID:", txId);
		console.log(
			"Rune ID: Check block height and tx index after confirmation"
		);

		return txId; // Return the transaction ID
	} catch (error) {
		console.error("Error:", error.message);
		throw error;
	}
}

// Make userWallet globally accessible
window.userWallet = {
	connected: false,
	address: null,
};
