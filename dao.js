// governance.js - Bitcoin Rune Governance System - Improved Version

// Debug log
console.log("Buffer availability check:", {
  directBuffer: typeof Buffer !== 'undefined',
  windowBuffer: typeof window !== 'undefined' && typeof window.Buffer !== 'undefined',
  windowBufferObj: typeof window !== 'undefined' && typeof window.buffer !== 'undefined'
});

// Ensure Buffer is defined for browser environment
if (typeof Buffer === 'undefined') {
  if (typeof window !== 'undefined' && window.buffer) {
    window.Buffer = window.buffer.Buffer;
  } else {
    console.error("Buffer is not defined and buffer polyfill is not available");
  }
}

// Utility function to create buffer safely
function safeBuffer(data, encoding) {
  try {
    // Try to use native Buffer first
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data, encoding);
    } 
    // Try to use window.Buffer if available
    else if (typeof window !== 'undefined' && window.Buffer) {
      return window.Buffer.from(data, encoding);
    }
    // Fallback to Uint8Array for simple hex conversion
    else if (encoding === 'hex') {
      const hex = data.toString();
      const result = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      // Add length property if missing
      if (!result.hasOwnProperty('length')) {
        Object.defineProperty(result, 'length', {
          get: function() { return this.byteLength; }
        });
      }
      return result;
    } else {
      console.error("Buffer fallback only supports hex encoding");
      throw new Error("Buffer not available");
    }
  } catch (e) {
    console.error("Error in safeBuffer:", e);
    throw e;
  }
}

document.addEventListener("DOMContentLoaded", () => {
    // UI Elements
    const connectWalletBtn = document.getElementById("connect-wallet");
    const createProposalBtn = document.getElementById("create-proposal");
    const castVoteBtn = document.getElementById("cast-vote");
    const getResultsBtn = document.getElementById("get-results-btn");
    const walletStatusEl = document.getElementById("wallet-status");
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");
  
    // Initialize event listeners
    connectWalletBtn.addEventListener("click", window.toggleWalletConnection);
    createProposalBtn.addEventListener("click", handleCreateProposal);
    castVoteBtn.addEventListener("click", handleCastVote);
    
    // Add event listener for the results button if it exists
    if (getResultsBtn) {
        getResultsBtn.addEventListener("click", handleGetResults);
    }
  
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
    window.checkStoredWallet();

    // Initialize proposal dropdowns if required elements exist
    initializeProposalDropdowns();
});

// Helper function to convert string to hex
function stringToHex(str) {
    let hex = "";
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex;
}

// Helper function to convert hex to string
function hexToString(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

// Validate token properties
function validateToken(token) {
    if (!token.name || token.name.length > 28) {
        window.showNotification("Token name must be 1-28 characters", "error");
        return false;
    }

    if (!token.symbol || token.symbol.length > 4) {
        window.showNotification("Token symbol must be 1-4 characters", "error");
        return false;
    }

    if (isNaN(token.totalSupply) || token.totalSupply <= 0) {
        window.showNotification("Total supply must be a positive number", "error");
        return false;
    }

    return true;
}

// Handle token creation
async function handleCreateToken() {
    try {
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
        if (!window.userWallet.connected) {
            window.showNotification("Please connect your wallet first", "error");
            return;
        }

        // Show loading indicator
        document.getElementById("loading").style.display = "block";

        // Check if Buffer is available
        if (typeof Buffer === 'undefined' && typeof window.Buffer === 'undefined') {
            throw new Error("Buffer is not available. Please reload the page or try a different browser.");
        }

        // Etch the governance token
        const txId = await etchGovernanceRune(token, window.userWallet.address);

        // Hide loading indicator
        document.getElementById("loading").style.display = "none";

        // Show success message
        window.showNotification("Governance token created successfully!", "success");
    } catch (error) {
        console.error("Error creating token:", error);
        window.showNotification("Failed to create token: " + error.message, "error");

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
                script: safeBuffer(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Runestone for governance token
        const runestoneData = await encodeRunestone(token);
        console.log("Governance Runestone Data:", runestoneData);
        const data = safeBuffer(runestoneData, "hex");
        
        if (data.length > 80) {
            throw new Error(`OP_RETURN data too large: ${data.length} bytes (max 80)`);
        }
        
        // Debug the data buffer
        console.log("Data buffer type:", typeof data);
        console.log("Data buffer instanceof Uint8Array:", data instanceof Uint8Array);
        console.log("Data buffer length:", data.length);
        
        try {
            // Verify bitcoinjs is properly loaded
            if (!bitcoinjs || !bitcoinjs.opcodes || typeof bitcoinjs.opcodes.OP_RETURN === 'undefined') {
                console.error("bitcoinjs library not properly loaded:", {
                    bitcoinjsExists: !!bitcoinjs,
                    opcodesExists: !!(bitcoinjs && bitcoinjs.opcodes),
                    opReturnExists: !!(bitcoinjs && bitcoinjs.opcodes && typeof bitcoinjs.opcodes.OP_RETURN !== 'undefined')
                });
                throw new Error("Bitcoin library not properly loaded. Missing OP_RETURN opcode.");
            }
            
            // Compile the OP_RETURN script
            const script = bitcoinjs.script.compile([
                bitcoinjs.opcodes.OP_RETURN,
                data
            ]);
            
            psbt.addOutput({
                script: script,
                value: 0,
            });
        } catch (scriptError) {
            console.error("Error compiling OP_RETURN script:", scriptError);
            throw new Error("Failed to compile Bitcoin script: " + scriptError.message);
        }
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - 546 - fee, // Dust limit + fee
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toHex();
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
            window.showNotification("Signing failed: " + err.message, "error");
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

// Initialize proposal dropdowns
function initializeProposalDropdowns() {
    // Get the proposal address field
    const proposerAddressInput = document.getElementById("result-proposer-address");
    if (proposerAddressInput) {
        proposerAddressInput.addEventListener("change", function() {
            // Populate the dropdowns when proposer address changes
            populateProposalsDropdown(this.value);
        });
    }
    
    // Option select for voting
    const optionSelect = document.getElementById("vote-option-select");
    if (optionSelect) {
        optionSelect.addEventListener("change", function() {
            document.getElementById("vote-option").value = this.value;
        });
    }
    
    // Rune ID validation
    const runeIdInput = document.getElementById("vote-rune-id");
    const validateRuneBtn = document.getElementById("validate-rune");
    const runeStatusEl = document.getElementById("rune-status");
    
    if (validateRuneBtn && runeIdInput && runeStatusEl) {
        validateRuneBtn.addEventListener("click", async function() {
            const runeId = runeIdInput.value;
            
            if (!runeId) {
                runeStatusEl.textContent = "Please enter a rune ID";
                runeStatusEl.className = "status-error";
                return;
            }
            
            // Check if wallet is connected
            if (!window.userWallet.connected) {
                window.showNotification("Please connect your wallet first", "error");
                runeStatusEl.textContent = "Wallet not connected";
                runeStatusEl.className = "status-error";
                return;
            }
            
            // Show loading status
            runeStatusEl.textContent = "Validating rune...";
            runeStatusEl.className = "status-loading";
            
            try {
                const result = await validateGovernanceRune(runeId);
                
                if (result.valid) {
                    runeStatusEl.textContent = result.message;
                    runeStatusEl.className = "status-success";
                } else {
                    runeStatusEl.textContent = result.message;
                    runeStatusEl.className = "status-error";
                }
            } catch (error) {
                runeStatusEl.textContent = "Error validating rune: " + error.message;
                runeStatusEl.className = "status-error";
            }
        });
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
        duration: parseInt(document.getElementById("proposal-duration").value),
        runeId: document.getElementById("proposal-rune-id").value // Added governance token ID
    };
    
    // Validate proposal
    if (!proposal.title || proposal.title.trim() === "") {
        window.showNotification("Please enter a proposal title", "error");
        return;
    }
    
    if (!proposal.description || proposal.description.trim() === "") {
        window.showNotification("Please enter a proposal description", "error");
        return;
    }
    
    if (proposal.options.length < 2) {
        window.showNotification("Please provide at least two voting options", "error");
        return;
    }

    if (!proposal.runeId || proposal.runeId.trim() === "") {
        window.showNotification("Please enter the governance rune ID", "error");
        return;
    }
    
    // Ensure wallet is connected
    if (!window.userWallet.connected) {
        window.showNotification("Please connect your wallet first", "error");
        return;
    }
    
    try {
        // Show loading indicator
        document.getElementById("loading").style.display = "block";
        
        // Create the proposal
        const txId = await createProposal(proposal, window.userWallet.address);
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
        
        // Show success message with transaction ID
        window.showNotification("Proposal created successfully!", "success");
    } catch (error) {
        console.error("Error creating proposal:", error);
        window.showNotification("Failed to create proposal: " + error.message, "error");
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
    }
}

// Encode proposal data into a runestone with compressed format
async function encodeProposalRunestone(proposal) {
    try {
        // Fetch current block height
        const response = await fetch(
            "https://mempool.emzy.de/testnet/api/blocks/tip/height"
        );
        const currentBlock = await response.json();
        const startBlock = currentBlock + 10;
        const endBlock = startBlock + proposal.duration;
        
        // Use a more compact encoding format
        // To save space, we'll use a reference to the rune ID for governance
        // and compress the options to single characters where possible
        
        // Compress options to a compact string (e.g., "Yes|No" becomes "Y|N")
        let optionsCompressed = proposal.options.map(opt => {
            // Use first character for common options or full text for others
            if (opt.toLowerCase() === "yes") return "Y";
            if (opt.toLowerCase() === "no") return "N";
            if (opt.toLowerCase() === "abstain") return "A";
            if (opt.toLowerCase() === "for") return "F";
            if (opt.toLowerCase() === "against") return "X";
            return opt.substring(0, 3); // Use first 3 chars for other options
        }).join("|");
        
        // Create a compact proposal format
        // Format: RUNE:PROP:title:runeId:options:quorum:startBlock:endBlock
        // We'll store the description separately or in proposal metadata
        const proposalRunestone = [
            "RUNE",
            "PROP", // Shortened from PROPOSAL
            proposal.title.substring(0, 20), // Limit title length
            proposal.runeId,
            optionsCompressed,
            proposal.quorum.toString(),
            startBlock.toString(),
            endBlock.toString()
        ].join(":");
        
        const encodedData = stringToHex(proposalRunestone);
        
        // Check size constraints
        if (safeBuffer(encodedData, "hex").length > 80) {
            throw new Error(`Proposal data exceeds 80 bytes limit (${safeBuffer(encodedData, "hex").length} bytes)`);
        }
        
        return encodedData;
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
                script: safeBuffer(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Proposal Runestone (compressed format)
        const runestoneData = await encodeProposalRunestone(proposal);
        console.log("Proposal Runestone Data:", runestoneData);
        const data = safeBuffer(runestoneData, "hex");
        
        // Verify data size is within limits
        if (data.length > 80) {
            throw new Error(`OP_RETURN data too large: ${data.length} bytes (max 80)`);
        }
        
        try {
            // Verify bitcoinjs is properly loaded
            if (!bitcoinjs || !bitcoinjs.opcodes || typeof bitcoinjs.opcodes.OP_RETURN === 'undefined') {
                console.error("bitcoinjs library not properly loaded (proposal):", {
                    bitcoinjsExists: !!bitcoinjs,
                    opcodesExists: !!(bitcoinjs && bitcoinjs.opcodes),
                    opReturnExists: !!(bitcoinjs && bitcoinjs.opcodes && typeof bitcoinjs.opcodes.OP_RETURN !== 'undefined')
                });
                throw new Error("Bitcoin library not properly loaded. Missing OP_RETURN opcode.");
            }
            
            // Compile the OP_RETURN script
            const script = bitcoinjs.script.compile([
                bitcoinjs.opcodes.OP_RETURN,
                data
            ]);
            
            psbt.addOutput({
                script: script,
                value: 0,
            });
        } catch (scriptError) {
            console.error("Error compiling proposal OP_RETURN script:", scriptError);
            throw new Error("Failed to compile Bitcoin script: " + scriptError.message);
        }
        
        // Store proposal details in a secondary output with metadata server
        // This allows us to keep the OP_RETURN small while storing full proposal description
        if (proposal.description && proposal.description.length > 0) {
            try {
                // Store proposal metadata on IPFS or another storage solution
                // This is just a placeholder - implement your metadata storage solution
                console.log("Would store extended proposal data:", proposal.description);
            } catch (metaErr) {
                console.error("Failed to store proposal metadata:", metaErr);
                // Continue anyway - we'll still create the proposal
            }
        }
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - fee,
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toHex();
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
        window.showNotification("Please enter a valid proposal ID", "error");
        return;
    }
    
    if (isNaN(vote.amount) || vote.amount <= 0) {
        window.showNotification("Please enter a valid amount to vote with", "error");
        return;
    }
    
    if (!vote.runeId || vote.runeId.trim() === "") {
        window.showNotification("Please enter your governance rune ID", "error");
        return;
    }
    
    // Ensure wallet is connected
    if (!window.userWallet.connected) {
        window.showNotification("Please connect your wallet first", "error");
        return;
    }
    
    try {
        // Show loading indicator
        document.getElementById("loading").style.display = "block";
        
        // First get proposal details to retrieve the proposer's address
        const proposalDetails = await getProposalDetails(vote.proposalId);
        if (!proposalDetails) {
            throw new Error("Could not find proposal details");
        }
        
        // Cast the vote
        const txId = await castVote(vote, window.userWallet.address, proposalDetails.proposerAddress);
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
        
        // Show success message
        window.showNotification("Vote cast successfully!", "success");
    } catch (error) {
        console.error("Error casting vote:", error);
        window.showNotification("Failed to cast vote: " + error.message, "error");
        
        // Hide loading indicator
        document.getElementById("loading").style.display = "none";
    }
}

// Encode vote data in a compact format
function encodeVoteRunestone(vote) {
    // Create a compact vote format: RUNE:V:proposalId:option:amount:runeId
    // 'V' is short for VOTE to save space
    const voteData = [
        "RUNE",
        "V", 
        vote.proposalId.substring(0, 8), // Use shortened tx ID (first 8 chars)
        vote.option.substring(0, 1), // First character of option (Y/N/etc)
        vote.amount.toString(),
        vote.runeId.substring(0, 8) // Use shortened rune ID
    ].join(":");
    
    return stringToHex(voteData);
}

// Retrieve proposal details including proposer address
async function getProposalDetails(proposalId) {
    try {
        // Get transaction details for the proposal
        const txResponse = await fetch(`https://mempool.emzy.de/testnet/api/tx/${proposalId}`);
        const tx = await txResponse.json();
        
        // Extract proposer address from tx input
        let proposerAddress = "";
        if (tx && tx.vin && tx.vin.length > 0 && tx.vin[0].prevout) {
            proposerAddress = tx.vin[0].prevout.scriptpubkey_address;
        }
        
        let proposalDetails = {
            id: proposalId,
            title: "Unknown Proposal",
            runeId: "",
            options: [],
            quorum: 0,
            startBlock: 0,
            endBlock: 0,
            proposerAddress: proposerAddress
        };
        
        // Look for OP_RETURN output with proposal data
        for (const vout of tx.vout) {
            if (vout.scriptpubkey_type === "op_return") {
                const scriptAsm = vout.scriptpubkey_asm;
                // Extract the hex data after OP_RETURN
                const hexData = scriptAsm.split(" ")[1];
                if (hexData) {
                    // Convert hex to string
                    const data = hexToString(hexData);
                    
                    // Check if it's a proposal
                    if (data.startsWith("RUNE:PROP:")) {
                        const parts = data.split(":");
                        if (parts.length >= 8) {
                            proposalDetails = {
                                id: proposalId,
                                title: parts[2],
                                runeId: parts[3],
                                options: parts[4].split("|"),
                                quorum: parseInt(parts[5]),
                                startBlock: parseInt(parts[6]),
                                endBlock: parseInt(parts[7]),
                                proposerAddress: proposerAddress
                            };
                        }
                    }
                }
            }
        }
        
        return proposalDetails;
    } catch (error) {
        console.error("Error getting proposal details:", error);
        return null;
    }
}

// Cast a vote using wallet to sign transaction
// Complete the truncated castVote function
async function castVote(vote, userAddress, proposerAddress) {
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

        console.log("ScriptPubKey:", scriptPubKey);
  
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: safeBuffer(scriptPubKey, "hex"),
                value: utxo.value,
            },
        });
  
        // Add OP_RETURN with Vote Runestone
        const runestoneData = encodeVoteRunestone(vote);
        console.log("Vote Runestone Data:", runestoneData);
        const data = safeBuffer(runestoneData, "hex");

        if (data.length > 80) {
            throw new Error(`OP_RETURN data too large: ${data.length} bytes (max 80)`);
        }
        
        try {
            // Verify bitcoinjs is properly loaded
            if (!bitcoinjs || !bitcoinjs.opcodes || typeof bitcoinjs.opcodes.OP_RETURN === 'undefined') {
                console.error("bitcoinjs library not properly loaded (vote):", {
                    bitcoinjsExists: !!bitcoinjs,
                    opcodesExists: !!(bitcoinjs && bitcoinjs.opcodes),
                    opReturnExists: !!(bitcoinjs && bitcoinjs.opcodes && typeof bitcoinjs.opcodes.OP_RETURN !== 'undefined')
                });
                throw new Error("Bitcoin library not properly loaded. Missing OP_RETURN opcode.");
            }
            
            // Compile the OP_RETURN script
            const script = bitcoinjs.script.compile([
                bitcoinjs.opcodes.OP_RETURN,
                data
            ]);
            
            psbt.addOutput({
                script: script,
                value: 0,
            });
        } catch (scriptError) {
            console.error("Error compiling vote OP_RETURN script:", scriptError);
            throw new Error("Failed to compile Bitcoin script: " + scriptError.message);
        }
        
        // Add dust output to the proposer address to link this vote to the proposal
        // This helps with later querying and vote tallying
        if (proposerAddress) {
            psbt.addOutput({
                address: proposerAddress,
                value: 546, // Dust limit 
            });
        }
        
        // Add change output
        const fee = 1000;
        psbt.addOutput({
            address: userAddress,
            value: utxo.value - 546 - fee,
        });
        
        // Convert PSBT to base64 and sign
        const psbtBase64 = psbt.toHex();
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

// Function to validate if a rune is a governance rune
async function validateGovernanceRune(runeId) {
    try {
        // Get transaction details for the rune
        const txResponse = await fetch(`https://mempool.emzy.de/testnet/api/tx/${runeId}`);
        const tx = await txResponse.json();
        
        if (!tx || !tx.vout) {
            return { 
                valid: false, 
                message: "Invalid transaction ID or transaction not found" 
            };
        }
        
        // Look for OP_RETURN output with rune data
        let isGovernanceRune = false;
        let runeName = "";
        let runeSymbol = "";
        
        for (const vout of tx.vout) {
            if (vout.scriptpubkey_type === "op_return") {
                const scriptAsm = vout.scriptpubkey_asm;
                // Extract the hex data after OP_RETURN
                const hexData = scriptAsm.split(" ")[1];
                if (hexData) {
                    // Convert hex to string
                    const data = hexToString(hexData);
                    
                    // Check if it's a rune with governance flag
                    if (data.startsWith("RUNE:ETCH:")) {
                        const parts = data.split(":");
                        if (parts.length >= 12 && parts[12] === "GOV") {
                            isGovernanceRune = true;
                            runeName = parts[2];
                            runeSymbol = parts[3];
                        }
                    }
                }
            }
        }
        
        if (isGovernanceRune) {
            return { 
                valid: true, 
                message: `Valid governance rune: ${runeName} (${runeSymbol})` 
            };
        } else {
            return { 
                valid: false, 
                message: "Not a governance rune or missing governance flag" 
            };
        }
    } catch (error) {
        console.error("Error validating rune:", error);
        return { 
            valid: false, 
            message: "Error validating rune: " + error.message 
        };
    }
}

// Populate proposals dropdown for a specific proposer address
async function populateProposalsDropdown(proposerAddress) {
    if (!proposerAddress) return;
    
    try {
        // Show loading state
        const proposalSelect = document.getElementById("vote-proposal-select");
        if (!proposalSelect) return;
        
        proposalSelect.innerHTML = '<option value="">Loading proposals...</option>';
        
        // Get transactions for the proposer address
        const txResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${proposerAddress}/txs`);
        const txs = await txResponse.json();
        
        // Filter and process transactions to find proposal transactions
        const proposals = [];
        
        for (const tx of txs) {
            // Look for OP_RETURN output with proposal data
            for (const vout of tx.vout) {
                if (vout.scriptpubkey_type === "op_return") {
                    const scriptAsm = vout.scriptpubkey_asm;
                    // Extract the hex data after OP_RETURN
                    const hexData = scriptAsm.split(" ")[1];
                    if (hexData) {
                        // Convert hex to string
                        const data = hexToString(hexData);
                        
                        // Check if it's a proposal
                        if (data.startsWith("RUNE:PROP:")) {
                            const parts = data.split(":");
                            if (parts.length >= 8) {
                                proposals.push({
                                    id: tx.txid,
                                    title: parts[2],
                                    runeId: parts[3]
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // Update select options
        if (proposals.length > 0) {
            proposalSelect.innerHTML = '<option value="">Select a proposal</option>';
            proposals.forEach(prop => {
                const option = document.createElement("option");
                option.value = prop.id;
                option.textContent = `${prop.title} (${prop.id.substring(0, 8)}...)`;
                option.setAttribute("data-rune-id", prop.runeId);
                proposalSelect.appendChild(option);
            });
            
            // Add change event to update proposal ID and rune ID fields
            proposalSelect.addEventListener("change", function() {
                const selectedOption = this.options[this.selectedIndex];
                document.getElementById("vote-proposal-id").value = this.value;
                
                const runeId = selectedOption.getAttribute("data-rune-id");
                if (runeId) {
                    document.getElementById("vote-rune-id").value = runeId;
                }
            });
        } else {
            proposalSelect.innerHTML = '<option value="">No proposals found</option>';
        }
    } catch (error) {
        console.error("Error loading proposals:", error);
        const proposalSelect = document.getElementById("vote-proposal-select");
        if (proposalSelect) {
            proposalSelect.innerHTML = '<option value="">Error loading proposals</option>';
        }
    }
}

// Handle getting voting results
async function handleGetResults() {
    const loading = document.getElementById("loading");
		loading.style.display = "block";

		// Simulate loading delay (can be removed in production)
		setTimeout(() => {
			// Hide loading indicator
			loading.style.display = "none";

			// Display hardcoded results
			displayResults({
				title: "Test",
				description: "Test.",
				options: ["YES", "NO", "ABSTAIN"],
				results: {
					YES: 1,
					NO: 0,
					ABSTAIN: 0,
				},
				totalVotes: 1,
				quorum: 1000,
				quorumMet: false,
				endBlock: "N/A",
				status: "Active",
				voters: [
					{
						address: "tb1qkz9d6g4m39626wlrn9m6unv5jvtrk2ktxqd2lu",
						votes: [{ option: "YES", weight: 1 }],
					},
				],
			});
		}, 500);
    const resultsContainer = document.getElementById("results-container");

    // Get proposal results
    const proposalId = document.getElementById("result-proposal-id").value;
    const proposerAddress = document.getElementById("result-proposer-address").value;
    
    if (!proposalId || !proposerAddress) {
        window.showNotification("Please enter both proposal ID and proposer address", "error");
        return;
    }
    
    try {
        // Show loading indicator
        
        // document.getElementById("results-loading").style.display = "block";
        // ("5")
        // document.getElementById("results-container").style.display = "none";
        // ("6")

        const proposal = await getProposalDetails(proposalId);
        if (!proposal) {
            throw new Error("Could not retrieve proposal details");
        }

        
        // Get all votes for this proposal
        const votes = await getVotesForProposal(proposalId, proposerAddress, proposal.runeId);

        // Process votes and tally results
        const results = tallyVotes(votes, proposal);

        // Display results
        displayVoteResults(results, proposal);

        // // Hide loading indicator
        // document.getElementById("results-loading").style.display = "none";
        // document.getElementById("results-container").style.display = "block";
    } catch (error) {
        console.error("Error getting results:", error);
        
        // Hide loading indicator
        document.getElementById("results-loading").style.display = "none";
    }
}

function displayResults(data) {
	const resultsContainer = document.getElementById("vote-results");
	resultsContainer.innerHTML = "";

	// Create results box
	const resultsBox = document.createElement("div");
	resultsBox.className = "results-box";

	// Add proposal info
	const proposalInfo = document.createElement("div");
	proposalInfo.innerHTML = `
    <h3>${data.title}</h3>
    <p>${data.description}</p>
    <p><strong>Status:</strong> ${data.status}</p>
    <p><strong>End Block:</strong> ${data.endBlock}</p>
  `;
	resultsBox.appendChild(proposalInfo);

	// Add quorum info
	const quorumInfo = document.createElement("div");
	quorumInfo.innerHTML = `
    <p><strong>Total Votes:</strong> ${data.totalVotes}</p>
    <p><strong>Quorum Requirement:</strong> ${data.quorum}</p>
    <p class="${data.quorumMet ? "quorum-met" : "quorum-not-met"}">
      <strong>Quorum Status:</strong> ${data.quorumMet ? "Met" : "Not Met"}
    </p>
  `;
	resultsBox.appendChild(quorumInfo);

	// Add voting results
	const votingResults = document.createElement("div");
	votingResults.innerHTML = "<h3>Voting Results</h3>";

	// Calculate total for percentage
	const total = data.totalVotes;

	// Add each option with progress bar
	data.options.forEach((option) => {
		const voteCount = data.results[option] || 0;
		const percentage =
			total > 0 ? ((voteCount / total) * 100).toFixed(2) : 0;

		const optionElement = document.createElement("div");
		optionElement.className = "vote-option";
		optionElement.innerHTML = `
      <p><strong>${option}:</strong> ${voteCount} votes (${percentage}%)</p>
      <div class="progress-bar">
        <div class="progress" style="width: ${percentage}%"></div>
      </div>
    `;

		votingResults.appendChild(optionElement);
	});

	resultsBox.appendChild(votingResults);

	// Add winner section if votes exist
	if (total > 0) {
		// Find winner (option with most votes)
		let winningOption = data.options[0];
		let maxVotes = data.results[winningOption] || 0;

		data.options.forEach((option) => {
			const votes = data.results[option] || 0;
			if (votes > maxVotes) {
				winningOption = option;
				maxVotes = votes;
			}
		});

		const winnerSection = document.createElement("div");
		winnerSection.className = "winner-section";
		winnerSection.innerHTML = `
      <h3>Current Leading Option</h3>
      <p><strong>${winningOption}</strong> with ${maxVotes} votes</p>
    `;

		resultsBox.appendChild(winnerSection);
	}

	// Add voters list
	const votersSection = document.createElement("div");
	votersSection.innerHTML = "<h3>Voters</h3>";

	const votersList = document.createElement("div");
	votersList.className = "voters-list";

	if (data.voters && data.voters.length > 0) {
		data.voters.forEach((voter) => {
			const voterItem = document.createElement("div");
			voterItem.className = "voter-item";

			let votesHtml = "";
			if (voter.votes && voter.votes.length > 0) {
				votesHtml = '<ul class="votes-list">';
				voter.votes.forEach((vote) => {
					votesHtml += `<li>${vote.option}: ${vote.weight} votes</li>`;
				});
				votesHtml += "</ul>";
			}

			voterItem.innerHTML = `
        <p><strong>Address:</strong> ${voter.address}</p>
        ${votesHtml}
      `;

			votersList.appendChild(voterItem);
		});
	} else {
		votersList.innerHTML = "<p>No votes recorded yet.</p>";
	}

	votersSection.appendChild(votersList);
	resultsBox.appendChild(votersSection);

	// Add results to container
	resultsContainer.appendChild(resultsBox);
}

// Get all votes for a specific proposal
async function getVotesForProposal(proposalId, proposerAddress, runeId) {
    try {
        // Use the proposer's address to find all votes (payments to proposer)
        const txsResponse = await fetch(`https://mempool.emzy.de/testnet/api/address/${proposerAddress}/txs`);
        const txs = await txsResponse.json();
        
        const votes = [];
        
        // Process each transaction to find votes
        for (const tx of txs) {
            let isVote = false;
            let voteData = null;
            let voterAddress = null;
            
            // Check if this is a vote transaction (has payment to proposer)
            const hasPaymentToProposer = tx.vout.some(vout => 
                vout.scriptpubkey_address === proposerAddress && vout.value === 546
            );
            
            if (!hasPaymentToProposer) continue;
            
            // Get voter address from inputs
            if (tx.vin && tx.vin.length > 0 && tx.vin[0].prevout) {
                voterAddress = tx.vin[0].prevout.scriptpubkey_address;
            }
            
            // Look for OP_RETURN with vote data
            for (const vout of tx.vout) {
                if (vout.scriptpubkey_type === "op_return") {
                    const scriptAsm = vout.scriptpubkey_asm;
                    const hexData = scriptAsm.split(" ")[1];
                    if (hexData) {
                        const data = hexToString(hexData);
                        
                        // Parse vote data (RUNE:V:proposalId:option:amount:runeId)
                        if (data.startsWith("RUNE:V:")) {
                            const parts = data.split(":");
                            if (parts.length >= 6) {
                                const voteProposalId = parts[2]; 
                                
                                // Check if this vote is for our proposal (partial match on proposal ID)
                                if (proposalId.startsWith(voteProposalId) || voteProposalId.startsWith(proposalId.substring(0, 8))) {
                                    const option = parts[3];
                                    const amount = parseInt(parts[4]);
                                    const voteRuneId = parts[5];
                                    
                                    // Check if the rune ID matches (partial match)
                                    if (runeId.startsWith(voteRuneId) || voteRuneId.startsWith(runeId.substring(0, 8))) {
                                        isVote = true;
                                        voteData = {
                                            txId: tx.txid,
                                            option: option,
                                            amount: amount,
                                            voterAddress: voterAddress,
                                            timestamp: tx.status.block_time || Date.now() / 1000
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if (isVote && voteData) {
                votes.push(voteData);
            }
        }
        
        return votes;
    } catch (error) {
        console.error("Error getting votes:", error);
        throw error;
    }
}

// Tally votes for a proposal
function tallyVotes(votes, proposal) {
    // Initialize results object
    const results = {
        totalVotes: votes.length,
        totalAmount: 0,
        options: {},
        voters: {},
        quorumReached: false,
        winning: null,
        winningAmount: 0
    };
    
    // Initialize options from proposal
    proposal.options.forEach(opt => {
        // Convert first letter to full option if needed
        const optKey = opt.length === 1 ? getFullOptionName(opt) : opt;
        results.options[optKey] = {
            count: 0,
            amount: 0,
            percentage: 0
        };
    });
    
    // Process votes
    votes.forEach(vote => {
        // Convert first letter to full option if needed
        const optKey = vote.option.length === 1 ? getFullOptionName(vote.option) : vote.option;
        
        // Ensure option exists in results
        if (!results.options[optKey]) {
            results.options[optKey] = {
                count: 0,
                amount: 0,
                percentage: 0
            };
        }
        
        // Increment vote count and amount
        results.options[optKey].count++;
        results.options[optKey].amount += vote.amount;
        results.totalAmount += vote.amount;
        
        // Track voters
        results.voters[vote.voterAddress] = {
            option: optKey,
            amount: vote.amount,
            timestamp: vote.timestamp
        };
    });
    
    // Calculate percentages and find winning option
    Object.keys(results.options).forEach(opt => {
        if (results.totalAmount > 0) {
            results.options[opt].percentage = (results.options[opt].amount / results.totalAmount) * 100;
        }
        
        if (results.options[opt].amount > results.winningAmount) {
            results.winning = opt;
            results.winningAmount = results.options[opt].amount;
        }
    });
    
    // Check if quorum is reached
    results.quorumReached = results.totalAmount >= proposal.quorum;
    
    return results;
}

// Convert single-letter option to full option name
function getFullOptionName(optionLetter) {
    const mapping = {
        'Y': 'Yes',
        'N': 'No',
        'A': 'Abstain',
        'F': 'For',
        'X': 'Against'
    };
    
    return mapping[optionLetter] || optionLetter;
}

// Display vote results in the UI
function displayVoteResults(results, proposal) {
    const resultsContainer = document.getElementById("results-content");
    
    // Create results UI
    let html = `
        <div class="results-header">
            <h3>${proposal.title}</h3>
            <p>Proposal ID: ${proposal.id}</p>
            <p>Governance Rune ID: ${proposal.runeId}</p>
        </div>
        <div class="results-summary">
            <p>Total Votes: ${results.totalVotes}</p>
            <p>Total Voting Power: ${results.totalAmount}</p>
            <p>Quorum Required: ${proposal.quorum}</p>
            <p>Quorum Status: ${results.quorumReached ? 
                '<span class="status-success">Reached</span>' : 
                '<span class="status-error">Not Reached</span>'}</p>
            <p>Current Winner: ${results.winning ? results.winning : 'No votes'} 
                (${results.winning ? results.options[results.winning].percentage.toFixed(2) + '%' : '0%'})</p>
        </div>
        <div class="results-chart">
            <div class="chart-container">
    `;
    
    // Add bars for each option
    Object.keys(results.options).forEach(opt => {
        const percentage = results.options[opt].percentage.toFixed(2);
        const isWinning = opt === results.winning;
        
        html += `
            <div class="chart-item">
                <div class="chart-label">${opt}</div>
                <div class="chart-bar-container">
                    <div class="chart-bar ${isWinning ? 'winning' : ''}" 
                        style="width: ${percentage}%"></div>
                    <div class="chart-value">${percentage}% (${results.options[opt].amount})</div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        <div class="voters-list">
            <h4>Voters (${Object.keys(results.voters).length})</h4>
            <table class="voters-table">
                <thead>
                    <tr>
                        <th>Address</th>
                        <th>Vote</th>
                        <th>Amount</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add voter details
    Object.keys(results.voters).forEach(voterAddr => {
        const voter = results.voters[voterAddr];
        const date = new Date(voter.timestamp * 1000).toLocaleString();
        
        html += `
            <tr>
                <td>${voterAddr.substring(0, 8)}...${voterAddr.substring(voterAddr.length - 4)}</td>
                <td>${voter.option}</td>
                <td>${voter.amount}</td>
                <td>${date}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
}

// Further optimize OP_RETURN data size for both votes and proposals
function optimizeOpReturnData(data) {
    // Measure current size
    const bytes = safeBuffer(data, "hex").length;
    
    // If already small enough, return as is
    if (bytes <= 80) {
        return data;
    }
    
    console.log(`Optimizing OP_RETURN data: ${bytes} bytes`);
    
    // Here we would implement optimization strategies
    // For example, truncate long fields, use abbreviated formats, etc.
    // This is just a placeholder implementation
    const optimized = data;
    
    // Check size after optimization
    const newBytes = safeBuffer(optimized, "hex").length;
    console.log(`After optimization: ${newBytes} bytes`);
    
    return optimized;
}