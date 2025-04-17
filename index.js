// index.js - Main application code
// Import libraries using ES modules or CDN scripts
// Note: For browser compatibility, we'll need to use CDN versions of these libraries

document.addEventListener("DOMContentLoaded", () => {
	const connectWalletBtn = document.getElementById("connect-wallet");
	const createTokenBtn = document.getElementById("create-token");
	const mintTokenBtn = document.getElementById("mint-token");
	const burnTokenBtn = document.getElementById("burn-token"); // New burn button
	const walletStatusEl = document.getElementById("wallet-status");
	const transferTokenBtn = document.getElementById("transfer-token");

	// User wallet state
	const userWallet = {
		connected: false,
		address: null,
	};
	
	// Initialize wallet connection button
	transferTokenBtn.addEventListener("click", handleTransferToken);
	connectWalletBtn.addEventListener("click", connectWallet);
	createTokenBtn.addEventListener("click", handleCreateToken);
	mintTokenBtn.addEventListener("click", handleMintToken);
	burnTokenBtn.addEventListener("click", handleBurnToken); // Add burn handler

	 const originalUpdateWalletStatus = updateWalletStatus;
		updateWalletStatus = function (connected, address) {
			originalUpdateWalletStatus(connected, address);

			const transferTokenBtn = document.getElementById("transfer-token");
			if (transferTokenBtn) {
				transferTokenBtn.disabled = !connected;
			}
		};

	// Check if wallet is already connected
	checkWalletConnection();
});

// Check if user has a connected wallet already
async function checkWalletConnection() {
	// Check if we have a bitcoinjs wallet extension available
	if (window.btc || window.bitcoinjsProvider || window.unisat) {
		const provider =
			window.btc || window.bitcoinjsProvider || window.unisat;
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
		// Check for different bitcoinjs wallet providers
		const provider =
			window.btc || window.bitcoinjsProvider || window.unisat;

		if (!provider) {
			alert(
				"No bitcoinjs wallet extension found. Please install UniSat Wallet, Xverse, or another bitcoinjs wallet extension."
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
	const mintTokenBtn = document.getElementById("mint-token");
	const burnTokenBtn = document.getElementById("burn-token"); // Add burn button to UI update

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
		mintTokenBtn.disabled = false;
		burnTokenBtn.disabled = false; // Enable burn button when connected
	} else {
		walletStatusEl.textContent = "Wallet not connected";
		walletStatusEl.classList.remove("connected");
		connectWalletBtn.textContent = "Connect Wallet";
		createTokenBtn.disabled = true;
		mintTokenBtn.disabled = true;
		burnTokenBtn.disabled = true; // Disable burn button when not connected
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
			"https://mempool.emzy.de/testnet/api/blocks/tip/height"
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
		// Ensure bitcoinjs is loaded
		if (typeof bitcoinjs === "undefined") {
			throw new Error("bitcoinjs-lib is not loaded");
		}

		// Fetch UTXOs
		const utxoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`
		);
		const utxos = await utxoResponse.json();
		console.log("Fetched UTXOs:", utxos);
		const utxo = utxos.find((u) => u.value >= 10000); // Ensure sufficient balance
		if (!utxo) throw new Error("Insufficient tBTC in your wallet");

		const network = bitcoinjs.networks.testnet;
		const psbt = new bitcoinjs.Psbt({ network });

		// Add input
		const addressInfoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}`
		);
		const addressInfo = await addressInfoResponse.json();
		const scriptPubKey =
			addressInfo.scriptPubKey ||
			bitcoinjs.address
				.toOutputScript(userAddress, network)
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
		console.log("Runestone Data:", runestoneData);
		const data = Buffer.from(runestoneData, "hex");
		console.log("Data Buffer:", data);
		psbt.addOutput({
			script: bitcoinjs.script.compile([
				bitcoinjs.opcodes.OP_RETURN,
				data,
			]),
			value: 0,
		});
		console.log("Added OP_RETURN output");
		// Add change output
		const fee = 1000;
		psbt.addOutput({
			address: userAddress,
			value: utxo.value - 546 - fee, // Dust limit + fee
		});
		console.log("Added change output");
		console.log("PSBT created:", psbt);
		console.log("PSBT inputs:", psbt.txInputs);
		console.log("PSBT outputs:", psbt.txOutputs);

		// Convert PSBT to base64 and sign
		const psbtBase64 = psbt.toBase64();
		const provider =
			window.btc || window.bitcoinjsProvider || window.unisat;

		if (!provider || !provider.signPsbt) {
			throw new Error("Wallet does not support PSBT signing");
		}

		try {
			signedPsbtBase64 = await provider.signPsbt(psbtBase64);
			console.log("Wallet returned:", signedPsbtBase64);
		} catch (err) {
			console.error("Error while signing PSBT:", err);
			alert("Signing failed: " + err.message);
			throw err; // or handle gracefully
		}
		// Extract the raw transaction for broadcasting

		const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtBase64, {
			network,
		});

		// May not be needed if the wallet already finalized
		const txHex = signedPsbt.extractTransaction().toHex();

		// Broadcast
		const broadcastResponse = await fetch(
			"https://mempool.emzy.de/testnet/api/tx",
			{
				method: "POST",
				body: txHex,
				headers: { "Content-Type": "text/plain" },
			}
		);

		const txId = await broadcastResponse.text();
		console.log("Etched! TxID:", txId);

		return txId;
	} catch (error) {
		console.error("Error:", error.message);
		throw error;
	}
}

function encodeMintRunestone(runeId, amount) {
	return stringToHex(`RUNE:MINT:${runeId}:${amount}`);
}

async function handleMintToken() {
	// Get mint details from form
	const runeId = document.getElementById("mint-rune-id").value;
	const amount = parseInt(document.getElementById("mint-amount").value);

	// Validate inputs
	if (!runeId || runeId.trim() === "") {
		alert("Please enter a valid Rune ID");
		return;
	}

	if (isNaN(amount) || amount <= 0) {
		alert("Please enter a valid amount to mint");
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

		// Mint the rune
		await mintRune(runeId, amount, userWallet.address);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";

		// Show success message
		alert("Rune minted successfully!");
	} catch (error) {
		console.error("Error minting token:", error);
		alert("Failed to mint token: " + error.message);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";
	}
}

// Mint the rune using wallet to sign transaction
async function mintRune(runeId, mintAmount, userAddress) {
	try {
		// Ensure bitcoinjs is loaded
		if (typeof bitcoinjs === "undefined") {
			throw new Error("bitcoinjs-lib is not loaded");
		}

		// Fetch UTXOs
		const utxoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`
		);
		const utxos = await utxoResponse.json();
		console.log("Fetched UTXOs:", utxos);
		const utxo = utxos.find((u) => u.value >= 100); // Ensure sufficient balance
		if (!utxo) throw new Error("Insufficient tBTC in your wallet");

		const network = bitcoinjs.networks.testnet;
		const psbt = new bitcoinjs.Psbt({ network });

		// Add input
		const addressInfoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}`
		);
		const addressInfo = await addressInfoResponse.json();
		const scriptPubKey =
			addressInfo.scriptPubKey ||
			bitcoinjs.address
				.toOutputScript(userAddress, network)
				.toString("hex");

		psbt.addInput({
			hash: utxo.txid,
			index: utxo.vout,
			witnessUtxo: {
				script: Buffer.from(scriptPubKey, "hex"),
				value: utxo.value,
			},
		});

		// Add OP_RETURN with Mint Runestone
		const runestoneData = encodeMintRunestone(runeId, mintAmount);
		console.log("Mint Runestone Data:", runestoneData);
		const data = Buffer.from(runestoneData, "hex");

		psbt.addOutput({
			script: bitcoinjs.script.compile([
				bitcoinjs.opcodes.OP_RETURN,
				data,
			]),
			value: 0,
		});


		// Add dust output (required for rune minting)
		psbt.addOutput({
			address: userAddress,
			value: 546, // Dust limit
		});

		// Add change output
		const fee = 1000;
		psbt.addOutput({
			address: userAddress,
			value: utxo.value - 546 - fee,
		});

		// Convert PSBT to base64 and sign
		const psbtBase64 = psbt.toHex();
		const provider =
			window.btc || window.bitcoinjsProvider || window.unisat;

		if (!provider || !provider.signPsbt) {
			throw new Error("Wallet does not support PSBT signing");
		}

		try {
			const signedPsbtHex = await provider.signPsbt(psbtBase64);
			console.log("Wallet returned:", signedPsbtHex);

			// Parse the hex PSBT
			const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtHex, {
				network,
			});

			// Try to extract without finalizing
			let txHex;
			try {
				txHex = signedPsbt.extractTransaction().toHex();
			} catch (extractError) {
				console.log(
					"Could not extract directly, trying alternative methods"
				);

				// If the wallet supports better methods, use them
				if (provider.pushPsbt) {
					return await provider.pushPsbt(signedPsbtHex);
				}

				if (provider.pushTx || provider.sendRawTransaction) {
					const pushMethod =
						provider.pushTx || provider.sendRawTransaction;
					return await pushMethod(signedPsbtHex);
				}

				throw new Error(
					"Cannot extract transaction: " + extractError.message
				);
			}

			// Broadcast
			console.log("Broadcasting transaction:", txHex);
			const broadcastResponse = await fetch(
				"https://mempool.emzy.de/testnet/api/tx",
				{
					method: "POST",
					body: txHex,
					headers: { "Content-Type": "text/plain" },
				}
			);

			const txId = await broadcastResponse.text();
			console.log("Minted! TxID:", txId);

			return txId;
		} catch (err) {
			console.error(
				"Error during transaction signing or broadcast:",
				err
			);
			throw err;
		}
	} catch (error) {
		console.error("Error:", error.message);
		throw error;
	}
}

// === NEW BURN FUNCTIONALITY ===

// Function to encode burn runestone
function encodeBurnRunestone(runeId, amount) {
	return stringToHex(`RUNE:BURN:${runeId}:${amount}`);
}

// Handle burn token button click
async function handleBurnToken() {
	// Get burn details from form
	const runeId = document.getElementById("burn-rune-id").value;
	const amount = parseInt(document.getElementById("burn-amount").value);

	// Validate inputs
	if (!runeId || runeId.trim() === "") {
		alert("Please enter a valid Rune ID");
		return;
	}

	if (isNaN(amount) || amount <= 0) {
		alert("Please enter a valid amount to burn");
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

		// Burn the rune
		await burnRune(runeId, amount, userWallet.address);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";

		// Show success message
		alert("Rune burned successfully!");
	} catch (error) {
		console.error("Error burning token:", error);
		alert("Failed to burn token: " + error.message);

		// Hide loading indicator
		document.getElementById("loading").style.display = "none";
	}
}

// Burn runes function
async function burnRune(runeId, amountToBurn, userAddress) {
	try {
		// Ensure bitcoinjs is loaded
		if (typeof bitcoinjs === "undefined") {
			throw new Error("bitcoinjs-lib is not loaded");
		}

		console.log(`Burning ${amountToBurn} of rune ${runeId}`);

		// Fetch UTXOs for the source address
		const utxoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`
		);
		const utxos = await utxoResponse.json();
		const utxo = utxos.find((u) => u.value >= 10000); // Need enough to cover fees

		if (!utxo) throw new Error("Insufficient tBTC for transaction");
		console.log(
			`Found UTXO: ${utxo.txid}:${utxo.vout} with value ${utxo.value} sats`
		);

		// Create PSBT (Partially Signed Bitcoin Transaction)
		const network = bitcoinjs.networks.testnet;
		const psbt = new bitcoinjs.Psbt({ network });

		// Get scriptPubKey for the input
		const addressInfoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${userAddress}`
		);
		const addressInfo = await addressInfoResponse.json();
		const scriptPubKey =
			addressInfo.scriptPubKey ||
			bitcoinjs.address
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

		// Create the RUNE_BURN envelope
		const runeBurnData = encodeBurnRunestone(runeId, amountToBurn);
		const data = Buffer.from(runeBurnData, "hex");

		if (data.length > 80) {
			throw new Error(
				`OP_RETURN data too large: ${data.length} bytes (max 80)`
			);
		}

		// Add OP_RETURN output with burn instructions
		psbt.addOutput({
			script: bitcoinjs.script.compile([
				bitcoinjs.opcodes.OP_RETURN,
				data,
			]),
			value: 0,
		});

		// Add an output to hold the burning runes (we'll send to the same source address)
		psbt.addOutput({
			address: userAddress,
			value: 546, // Dust limit - required for protocol validity
		});

		// Add change output (minus fees)
		const fee = 1000; // Adjust based on current testnet fees
		const changeAmount = utxo.value - 546 - fee;

		if (changeAmount < 0) {
			throw new Error("Insufficient funds to cover transaction fees");
		}

		// If there's change to return
		if (changeAmount > 546) {
			psbt.addOutput({
				address: userAddress,
				value: changeAmount,
			});
		} else {
			// If change is too small, add it to the fee
			console.log("Change amount too small, adding to fee");
		}

		// Convert PSBT to base64 for signing
		const psbtBase64 = psbt.toBase64();
		const provider =
			window.btc || window.bitcoinjsProvider || window.unisat;

		if (!provider || !provider.signPsbt) {
			throw new Error("Wallet does not support PSBT signing");
		}

		try {
			const signedPsbtHex = await provider.signPsbt(psbtBase64);
			console.log("Wallet returned:", signedPsbtHex);

			// Parse the hex PSBT
			const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtHex, {
				network,
			});

			// Try to extract transaction
			let txHex;
			try {
				txHex = signedPsbt.extractTransaction().toHex();
				console.log("Transaction size:", txHex.length / 2, "bytes");
			} catch (extractError) {
				console.log(
					"Could not extract directly, trying alternative methods"
				);

				// If the wallet supports better methods, use them
				if (provider.pushPsbt) {
					return await provider.pushPsbt(signedPsbtHex);
				}

				if (provider.pushTx || provider.sendRawTransaction) {
					const pushMethod =
						provider.pushTx || provider.sendRawTransaction;
					return await pushMethod(signedPsbtHex);
				}

				throw new Error(
					"Cannot extract transaction: " + extractError.message
				);
			}

			// Broadcast transaction
			console.log("Broadcasting transaction...");
			const broadcastResponse = await fetch(
				"https://mempool.emzy.de/testnet/api/tx",
				{
					method: "POST",
					body: txHex,
					headers: { "Content-Type": "text/plain" },
				}
			);

			const txId = await broadcastResponse.text();
			console.log("Rune burn successful!");
			console.log("Transaction ID:", txId);
			console.log(`Burned ${amountToBurn} of rune ${runeId}`);
			console.log("You can check this transaction at:");
			console.log(`https://mempool.emzy.de/testnet/tx/${txId}`);

			return txId;
		} catch (err) {
			console.error(
				"Error during transaction signing or broadcast:",
				err
			);
			throw err;
		}
	} catch (error) {
		console.error("Error burning runes:", error.message);
		if (error.response) {
			console.error("API Response data:", error.response.data);
			console.error("API Response status:", error.response.status);
		}
		throw error;
	}
}


// === TRANSFER FUNCTIONALITY ===

// Function to encode transfer runestone
function encodeTransferRunestone(runeId, amount) {
    return stringToHex(`RUNE:TRANSFER:${runeId}:${amount}`);
}

// Handle transfer token button click
async function handleTransferToken() {
    // Get transfer details from form
    const runeId = document.getElementById("transfer-rune-id").value;
    const amount = parseInt(document.getElementById("transfer-amount").value);
    const destinationAddress = document.getElementById("transfer-destination").value;

    // Validate inputs
    if (!runeId || runeId.trim() === "") {
        alert("Please enter a valid Rune ID");
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount to transfer");
        return;
    }

    if (!destinationAddress || destinationAddress.trim() === "") {
        alert("Please enter a valid destination address");
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

        // Transfer the rune
        await transferRune(runeId, amount, userWallet.address, destinationAddress);

        // Hide loading indicator
        document.getElementById("loading").style.display = "none";

        // Show success message
        alert("Rune transferred successfully!");
    } catch (error) {
        console.error("Error transferring token:", error);
        alert("Failed to transfer token: " + error.message);

        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
    }
}

// Transfer runes function
async function transferRune(runeId, amountToTransfer, sourceAddress, destinationAddress) {
    try {
        // Ensure bitcoinjs is loaded
        if (typeof bitcoinjs === "undefined") {
            throw new Error("bitcoinjs-lib is not loaded");
        }

        console.log(`Transferring ${amountToTransfer} of rune ${runeId} to ${destinationAddress}`);

        // Fetch UTXOs for the source address
        const utxoResponse = await fetch(
            `https://mempool.emzy.de/testnet/api/address/${sourceAddress}/utxo`
        );
        const utxos = await utxoResponse.json();
        const utxo = utxos.find((u) => u.value >= 10000); // Need enough to cover fees

        if (!utxo) throw new Error("Insufficient tBTC for transaction");
        console.log(
            `Found UTXO: ${utxo.txid}:${utxo.vout} with value ${utxo.value} sats`
        );

        // Create PSBT (Partially Signed Bitcoin Transaction)
        const network = bitcoinjs.networks.testnet;
        const psbt = new bitcoinjs.Psbt({ network });

        // Get scriptPubKey for the input
      	const addressInfoResponse = await fetch(
			`https://mempool.emzy.de/testnet/api/address/${sourceAddress}`
		);
		const addressInfo = await addressInfoResponse.json();
		console.log("Address Info:", addressInfo);

        const scriptPubKey =
            addressInfo.scriptPubKey ||
            bitcoinjs.address
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
        const runeTransferData = encodeTransferRunestone(runeId, amountToTransfer); // ! Need to check
        const data = Buffer.from(runeTransferData, "hex");

        if (data.length > 80) {
            throw new Error(
                `OP_RETURN data too large: ${data.length} bytes (max 80)`
            );
        }

        // Add OP_RETURN output with transfer instructions
        psbt.addOutput({
            script: bitcoinjs.script.compile([
                bitcoinjs.opcodes.OP_RETURN,
                data
            ]),
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

        // If there's change to return
        if (changeAmount > 546) {
            psbt.addOutput({
                address: sourceAddress,
                value: changeAmount,
            });
        } else {
            // If change is too small, add it to the fee
            console.log("Change amount too small, adding to fee");
        }

        // Convert PSBT to base64 for signing
		// ! Need to check this
       try {
			// Convert PSBT to hex format for signing (not base64)
			const psbtHex = psbt.toHex();
			const provider =
				window.btc || window.bitcoinjsProvider || window.unisat;

			if (!provider || !provider.signPsbt) {
				throw new Error("Wallet does not support PSBT signing");
			}

			// Sign with the wallet
			const signedPsbtHex = await provider.signPsbt(psbtHex);
			console.log("Wallet returned:", signedPsbtHex);

			// Parse the signed PSBT
			const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtHex, {
				network,
			});

			// Finalize all inputs if not already finalized
			try {
				signedPsbt.finalizeAllInputs();
			} catch (e) {
				// If already finalized, this will throw an error, which is fine
				console.log("Inputs already finalized");
			}

			// Extract transaction directly to hex
			const txHex = signedPsbt.extractTransaction().toHex();
			console.log("Extracted transaction hex:", txHex);

			// Broadcast the raw transaction
			const broadcastResponse = await fetch(
				"https://mempool.emzy.de/testnet/api/tx",
				{
					method: "POST",
					body: txHex,
					headers: { "Content-Type": "text/plain" },
				}
			);

			const txId = await broadcastResponse.text();
			console.log("Runes transfer successful!");
			console.log("Transaction ID:", txId);
			console.log(
				`Transferred ${amountToTransfer} of rune ${runeId} to ${destinationAddress}`
			);

			return txId;
		} catch (err) {
			console.error(
				"Error during transaction signing or broadcast:",
				err
			);
			throw err;
		}
    } catch (error) {
        console.error("Error transferring runes:", error.message);
        if (error.response) {
            console.error("API Response data:", error.response.data);
            console.error("API Response status:", error.response.status);
        }
        throw error;
    }
}

// Make userWallet globally accessible
window.userWallet = {
	connected: false,
	address: null,
};
