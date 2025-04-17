// Shared wallet functionality
document.addEventListener("DOMContentLoaded", () => {
    const connectWalletBtn = document.getElementById("connect-wallet");
    const walletStatusEl = document.getElementById("wallet-status");
    const navLinks = document.querySelectorAll("nav a");

    // Initialize wallet state
    window.userWallet = {
        connected: false,
        address: null
    };

    // Check for existing wallet connection in localStorage
    checkStoredWallet();

    // Initialize wallet connection button
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener("click", toggleWalletConnection);
    }

    // Handle navigation
    if (navLinks) {
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                // Remove active class from all links
                navLinks.forEach(l => l.classList.remove("active"));
                // Add active class to clicked link
                link.classList.add("active");
                
                // Get the href attribute
                const href = link.getAttribute("href");
                
                // Only prevent default if it's a hash link
                if (href === "#") {
                    e.preventDefault();
                }
            });
        });
    }
});

// Check for existing wallet connection in localStorage
function checkStoredWallet() {
    const storedWallet = localStorage.getItem('userWallet');
    if (storedWallet) {
        const { connected, address } = JSON.parse(storedWallet);
        if (connected && address) {
            window.userWallet.connected = connected;
            window.userWallet.address = address;
            updateWalletStatus(connected, address);
        }
    }
}

// Update wallet state in localStorage
function updateStoredWallet(connected, address) {
    localStorage.setItem('userWallet', JSON.stringify({ connected, address }));
}

// Toggle wallet connection (connect or disconnect)
async function toggleWalletConnection() {
    if (window.userWallet.connected) {
        // Disconnect wallet
        window.userWallet.connected = false;
        window.userWallet.address = null;
        updateWalletStatus(false, null);
        updateStoredWallet(false, null);
        showNotification('Wallet disconnected', 'info');
    } else {
        // Connect wallet
        await connectWallet();
    }
}

// Connect wallet function
async function connectWallet() {
    try {
        const provider = window.btc || window.BitcoinProvider || window.unisat;
        if (!provider) {
            throw new Error('No Bitcoin wallet provider found');
        }

        const accounts = await provider.requestAccounts();
        if (accounts && accounts.length > 0) {
            const address = accounts[0];
            window.userWallet.connected = true;
            window.userWallet.address = address;
            updateWalletStatus(true, address);
            updateStoredWallet(true, address);
            showNotification('Wallet connected', 'success');
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('Failed to connect wallet: ' + error.message, 'error');
    }
}

// Update wallet status in UI
function updateWalletStatus(connected, address) {
    const walletStatus = document.getElementById('wallet-status');
    const connectWalletBtn = document.getElementById('connect-wallet');
    const transferTokenBtn = document.getElementById('transfer-token');
    const createTokenBtn = document.getElementById('create-token');
    const mintTokenBtn = document.getElementById('mint-token');
    const burnTokenBtn = document.getElementById('burn-token');

    if (walletStatus) {
        if (connected) {
            walletStatus.innerHTML = `<i class="fas fa-wallet"></i> <span>Connected: ${address}</span>`;
            walletStatus.classList.add('connected');
        } else {
            walletStatus.innerHTML = '<i class="fas fa-wallet"></i> <span>Wallet not connected</span>';
            walletStatus.classList.remove('connected');
        }
    }

    if (connectWalletBtn) {
        connectWalletBtn.textContent = connected ? 'Disconnect Wallet' : 'Connect Wallet';
    }

    // Only enable/disable buttons that exist on the current page
    if (transferTokenBtn) transferTokenBtn.disabled = !connected;
    if (createTokenBtn) createTokenBtn.disabled = !connected;
    if (mintTokenBtn) mintTokenBtn.disabled = !connected;
    if (burnTokenBtn) burnTokenBtn.disabled = !connected;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Make wallet functions and state globally accessible
window.userWallet = {
    connected: false,
    address: null,
};

// Export wallet functions
window.checkStoredWallet = checkStoredWallet;
window.updateStoredWallet = updateStoredWallet;
window.toggleWalletConnection = toggleWalletConnection;
window.connectWallet = connectWallet;
window.updateWalletStatus = updateWalletStatus;
window.showNotification = showNotification; 