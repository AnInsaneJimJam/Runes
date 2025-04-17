import express from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Load contract ABI
const contractABI = JSON.parse(
  fs.readFileSync(path.resolve('./contracts/RuneToken.json'), 'utf8')
);

// Setup Ethers
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

// API route to bridge BTC rune → ERC-1155
app.post('/bridge/rune-to-erc1155', async (req, res) => {
  try {
    const {
      runeName,
      runeSymbol,
      runeUri,
      maxSupply,
      initSupply,
      defaultMint,
      receiver
    } = req.body;

    const tx = await contract.mintFungible(
      runeUri,
      runeName,
      runeSymbol,
      ethers.BigNumber.from(maxSupply),
      ethers.BigNumber.from(initSupply),
      ethers.BigNumber.from(defaultMint),
      receiver
    );

    await tx.wait();

    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/bridge/freeze', async (req, res) => {
    try {
      const {
        runeName,
        amount,
        userAddress
      } = req.body;
  
      const tx = await contract.freezeTokens(
        runeName,
        ethers.BigNumber.from(amount),
        userAddress
      );
  
      await tx.wait();
  
      res.status(200).json({ success: true, txHash: tx.hash });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

app.listen(PORT, () => {
  console.log(`Backend bridge server listening on http://localhost:${PORT}`);
});
