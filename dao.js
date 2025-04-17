// governance.js - Bitcoin Rune Governance System

document.addEventListener("DOMContentLoaded", () => {
    // UI Elements
    const connectWalletBtn = document.getElementById("connect-wallet");
    const createTokenBtn = document.getElementById("create-token");
    const createProposalBtn = document.getElementById("create-proposal");
    const castVoteBtn = document.getElementById("cast-vote");
    const walletStatusEl = document.getElementById("wallet-status");
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");
  
    // User wallet state
    const userWallet = {
        connected: false,
        address: null,
    };
  
    // Initialize event listeners
    connectWalletBtn.addEventListener("click", connectWallet);
    createTokenBtn.addEventListener("click", handleCreateToken);
    createProposalBtn.addEventListener("click", handleCreateProposal);
    castVoteBtn.addEventListener("click", handleCastVote);
  
    // Tab navigation
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const tabId = tab.getAttribute("data-tab");
            
            // Update active tab
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            // Show corresponding content
            tabContents.forEach(content => {
                content.classList.remove("active");
                if (content.id === `${tabId}-tab`) {
                    content.classList.add("active");
                }
            });
        });
    });
  
    // Check if wallet is already connected
    checkWalletConnection();
});

// Check if user has a connected wallet already
async function checkWalletConnection() {
    // Check if we have a bitcoinjs wallet extension available
    if (window.btc || window.bitcoinjsProvider || window.unisat) {
        const provider = window.btc || window.bitcoinjsProvider || window.unisat;
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
        const provider = window.btc || window.bitcoinjsProvider || window.unisat;

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

// Helper function to convert string to hex
function stringToHex(str) {
    let hex = "";
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex;
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

        // Etch the governance token
        const txId = await etchGovernanceRune(token, userWallet.address);

        // Hide loading indicator
        document.getElementById("loading").style.display = "none";

        // Show success message
        alert(`Governance token created successfully! TxID: ${txId}`);
    } catch (error) {
        console.error("Error creating token:", error);
        alert("Failed to create token: " + error.message);

        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
    }
}

// Encode rune data for a governance token
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
            "GOV" // Add governance flag
        ].join(":");

        return stringToHex(runestone);
    } catch (error) {
        console.error("Error fetching block height:", error);
        throw error;
    }
}

// Etch the governance rune using wallet to sign transaction
async function etchGovernanceRune(token, userAddress) {
    try {
        // Ensure bitcoinjs is loaded
        if (typeof bitcoinjs === "undefined") {
            throw new Error("bitcoinjs-lib is not loaded");
        }
  
        // Fetch UTXOs
        const utxoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`);
        const utxos = await utxoResponse.json();
        console.log("Fetched UTXOs:", utxos);
        const utxo = utxos.find((u) => u.value >= 1000); // Ensure sufficient balance
        if (!utxo) throw new Error("Insufficient tBTC in your wallet");
  
        const network = bitcoinjs.networks.testnet;
        const psbt = new bitcoinjs.Psbt({ network });
  
        // Add input
        const addressInfoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}`);
        const addressInfo = await addressInfoResponse.json();
        const scriptPubKey = addressInfo.scriptPubKey || bitcoinjs.address.toOutputScript(userAddress, network).toString("hex");
  
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Runestone for governance token
        const runestoneData = await encodeRunestone(token);
        console.log("Governance Runestone Data:", runestoneData);
        const data = Buffer.from(runestoneData, "hex");
        console.log("Data Buffer:", data);
        psbt.addOutput({
            script: bitcoinjs.script.compile([bitcoinjs.opcodes.OP_RETURN, data]),
            value: 0,
        });
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - 546 - fee, // Dust limit + fee
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toBase64();
        const provider = window.btc || window.bitcoinjsProvider || window.unisat;
  
        if (!provider || !provider.signPsbt) {
            throw new Error("Wallet does not support PSBT signing");
        }
  
        let signedPsbtBase64;
        try {
            signedPsbtBase64 = await provider.signPsbt(psbtBase64);
            console.log("Wallet returned:", signedPsbtBase64);
        } catch (err) {
            console.error("Error while signing PSBT:", err);
            alert("Signing failed: " + err.message);
            throw err;
        }
        
        // Extract the raw transaction for broadcasting
        const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtBase64, { network });
      
        // May not be needed if the wallet already finalized
        const txHex = signedPsbt.extractTransaction().toHex();
      
        // Broadcast
        const broadcastResponse = await fetch("https://mempool.emzy.de/testnet/api/tx", {
            method: "POST",
            body: txHex,
            headers: { "Content-Type": "text/plain" },
        });
      
        const txId = await broadcastResponse.text();
        console.log("Governance Rune Etched! TxID:", txId);
      
        return txId;
    } catch (error) {
        console.error("Error:", error.message);
        throw error;
    }
}

// Handle proposal creation
async function handleCreateProposal() {
    // Get proposal details from form
    const proposal = {
        title: document.getElementById("proposal-title").value,
        description: document.getElementById("proposal-description").value,
        options: document.getElementById("proposal-options").value.split(","),
        quorum: parseInt(document.getElementById("proposal-quorum").value),
        duration: parseInt(document.getElementById("proposal-duration").value)
    };
    
    // Validate proposal
    if (!proposal.title || proposal.title.trim() === "") {
        alert("Please enter a proposal title");
        return;
    }
    
    if (!proposal.description || proposal.description.trim() === "") {
        alert("Please enter a proposal description");
        return;
    }
    
    if (proposal.options.length < 2) {
        alert("Please provide at least two voting options");
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
        
        // Create the proposal
        const txId = await createProposal(proposal, userWallet.address);
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
        
        // Show success message with transaction ID
        alert(`Proposal created successfully! Proposal ID: ${txId}`);
    } catch (error) {
        console.error("Error creating proposal:", error);
        alert("Failed to create proposal: " + error.message);
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
    }
}

// Encode proposal data into a runestone
async function encodeProposalRunestone(proposal) {
    try {
        // Fetch current block height
        const response = await fetch(
            "https://mempool.emzy.de/testnet/api/blocks/tip/height"
        );
        const currentBlock = await response.json();
        const startBlock = currentBlock + 10;
        const endBlock = startBlock + proposal.duration;
        
        // Format options as a string
        const optionsStr = proposal.options.join("|");
        
        // Format the proposal runestone
        const proposalRunestone = [
            "RUNE",
            "PROPOSAL",
            proposal.title,
            proposal.description,
            optionsStr,
            proposal.quorum.toString(),
            startBlock.toString(),
            endBlock.toString()
        ].join(":");
        
        return stringToHex(proposalRunestone);
    } catch (error) {
        console.error("Error encoding proposal:", error);
        throw error;
    }
}

// Create a proposal using wallet to sign transaction
async function createProposal(proposal, userAddress) {
    try {
        // Ensure bitcoinjs is loaded
        if (typeof bitcoinjs === "undefined") {
            throw new Error("bitcoinjs-lib is not loaded");
        }
  
        // Fetch UTXOs
        const utxoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`);
        const utxos = await utxoResponse.json();
        const utxo = utxos.find((u) => u.value >= 1000); // Ensure sufficient balance
        if (!utxo) throw new Error("Insufficient tBTC in your wallet");
  
        const network = bitcoinjs.networks.testnet;
        const psbt = new bitcoinjs.Psbt({ network });
  
        // Add input
        const addressInfoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}`);
        const addressInfo = await addressInfoResponse.json();
        const scriptPubKey = addressInfo.scriptPubKey || bitcoinjs.address.toOutputScript(userAddress, network).toString("hex");
  
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Proposal Runestone
        const runestoneData = await encodeProposalRunestone(proposal);
        console.log("Proposal Runestone Data:", runestoneData);
        const data = Buffer.from(runestoneData, "hex");
        
        psbt.addOutput({
            script: bitcoinjs.script.compile([bitcoinjs.opcodes.OP_RETURN, data]),
            value: 0,
        });
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - fee,
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toBase64();
        const provider = window.btc || window.bitcoinjsProvider || window.unisat;
  
        if (!provider || !provider.signPsbt) {
            throw new Error("Wallet does not support PSBT signing");
        }
  
        let signedPsbtBase64;
        try {
            signedPsbtBase64 = await provider.signPsbt(psbtBase64);
            console.log("Wallet returned:", signedPsbtBase64);
        } catch (err) {
            console.error("Error while signing PSBT:", err);
            throw err;
        }
        
        // Extract the raw transaction for broadcasting
        const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtBase64, { network });
        const txHex = signedPsbt.extractTransaction().toHex();
      
        // Broadcast
        const broadcastResponse = await fetch("https://mempool.emzy.de/testnet/api/tx", {
            method: "POST",
            body: txHex,
            headers: { "Content-Type": "text/plain" },
        });
      
        const txId = await broadcastResponse.text();
        console.log("Proposal Created! TxID:", txId);
      
        return txId;
    } catch (error) {
        console.error("Error:", error.message);
        throw error;
    }
}

// Handle vote casting
async function handleCastVote() {
    // Get vote details from form
    const vote = {
        proposalId: document.getElementById("vote-proposal-id").value,
        option: document.getElementById("vote-option").value,
        amount: parseInt(document.getElementById("vote-amount").value),
        runeId: document.getElementById("vote-rune-id").value
    };
    
    // Validate vote
    if (!vote.proposalId || vote.proposalId.trim() === "") {
        alert("Please enter a valid proposal ID");
        return;
    }
    
    if (isNaN(vote.amount) || vote.amount <= 0) {
        alert("Please enter a valid amount to vote with");
        return;
    }
    
    if (!vote.runeId || vote.runeId.trim() === "") {
        alert("Please enter your governance rune ID");
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
        
        // Cast the vote
        const txId = await castVote(vote, userWallet.address);
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
        
        // Show success message
        alert(`Vote cast successfully! TxID: ${txId}`);
    } catch (error) {
        console.error("Error casting vote:", error);
        alert("Failed to cast vote: " + error.message);
        
    }
}

// Encode vote data
function encodeVoteRunestone(vote) {
    return stringToHex(`RUNE:VOTE:${vote.proposalId}:${vote.option}:${vote.amount}:${vote.runeId}`);
}

// Cast a vote using wallet to sign transaction
async function castVote(vote, userAddress) {
    try {
        // Ensure bitcoinjs is loaded
        if (typeof bitcoinjs === "undefined") {
            throw new Error("bitcoinjs-lib is not loaded");
        }
  
        // Fetch UTXOs
        const utxoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}/utxo`);
        const utxos = await utxoResponse.json();
        const utxo = utxos.find((u) => u.value >= 10000); // Ensure sufficient balance
        if (!utxo) throw new Error("Insufficient tBTC in your wallet");
  
        const network = bitcoinjs.networks.testnet;
        const psbt = new bitcoinjs.Psbt({ network });
  
        // Add input
        const addressInfoResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${userAddress}`);
        const addressInfo = await addressInfoResponse.json();
        const scriptPubKey = addressInfo.scriptPubKey || bitcoinjs.address.toOutputScript(userAddress, network).toString("hex");
  
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Vote Runestone
        const runestoneData = encodeVoteRunestone(vote);
        console.log("Vote Runestone Data:", runestoneData);
        const data = Buffer.from(runestoneData, "hex");
        
        psbt.addOutput({
            script: bitcoinjs.script.compile([bitcoinjs.opcodes.OP_RETURN, data]),
            value: 0,
        });
        
        // Add dust output to hold the governance runes
        psbt.addOutput({
            address: userAddress,
            value: 546, // Dust limit for the token UTXO
        });
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - 546 - fee,
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toBase64();
        const provider = window.btc || window.bitcoinjsProvider || window.unisat;
  
        if (!provider || !provider.signPsbt) {
            throw new Error("Wallet does not support PSBT signing");
        }
  
        let signedPsbtBase64;
        try {
            signedPsbtBase64 = await provider.signPsbt(psbtBase64);
            console.log("Wallet returned:", signedPsbtBase64);
        } catch (err) {
            console.error("Error while signing PSBT:", err);
            throw err;
        }
        

        // Extract the raw transaction for broadcasting
        const signedPsbt = bitcoinjs.Psbt.fromHex(signedPsbtBase64, { network });
        const txHex = signedPsbt.extractTransaction().toHex();
      
        // Broadcast
        const broadcastResponse = await fetch("https://mempool.emzy.de/testnet/api/tx", {
            method: "POST",
            body: txHex,
            headers: { "Content-Type": "text/plain" },
        });
      
        const txId = await broadcastResponse.text();
        console.log("Vote Cast! TxID:", txId);
      
        return txId;
    } catch (error) {
        console.error("Error:", error.message);
        throw error;
    }
}


const userWallet = {
    connected: false,
    address: null,
};
