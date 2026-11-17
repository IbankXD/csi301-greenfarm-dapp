let provider;
let signer;
let greenFarmWrite;
let greenFarmRead;
let cachedAbi = null;

const FALLBACK_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// ABI สำรองตรงตาม GreenFarm.sol
const EMBEDDED_GREENFARM_ABI = [
    "function admin() view returns (address)",
    "function stakeholders(address) view returns (string organizationName, uint8 role, bool active)",
    "function getStakeholders() view returns (tuple(address wallet, string organizationName, uint8 role, bool active)[])",
    "function registerStakeholder(address _wallet, string _organizationName, uint8 _role)",
    "function nextProductId() view returns (uint256)",
    "function registerProduct(string _batchCode, string _productName, uint64 _harvestDate, string _origin, string _certification) returns (uint256)",
    "function getProduct(uint256 _productId) view returns (tuple(uint256 id, string batchCode, string productName, uint64 harvestDate, string origin, string certification, address farmer, address currentCustodian, uint8 status, bool recalled, string recallReason, uint256 createdAt))",
    "function getProductHistory(uint256 _productId) view returns (tuple(string action, address actor, address fromCustodian, address toCustodian, uint8 status, uint256 timestamp, string note)[])",
    "function getProductIdByBatchCode(string _batchCode) view returns (uint256)",
    "function getTransferRequest(uint256 _productId) view returns (tuple(address from, address to, uint8 previousStatus, uint256 requestedAt, string note, bool pending))",
    "function requestTransfer(uint256 _productId, address _recipient, string _note)",
    "function acceptTransfer(uint256 _productId)",
    "function rejectTransfer(uint256 _productId)",
    "function updateProductStatus(uint256 _productId, uint8 _newStatus, string _note)",
    "function recallProduct(uint256 _productId, string _reason)",
    "event StakeholderRegistered(address indexed wallet, uint8 role, string organizationName)",
    "event ProductRegistered(uint256 indexed productId, string batchCode, address indexed farmer)",
    "event TransferRequested(uint256 indexed productId, address indexed from, address indexed to)",
    "event TransferAccepted(uint256 indexed productId, address indexed from, address indexed to)",
    "event TransferRejected(uint256 indexed productId, address indexed from, address indexed to)",
    "event ProductStatusUpdated(uint256 indexed productId, uint8 status)",
    "event ProductRecalled(uint256 indexed productId, string reason)"
];

function getValidContractAddress() {
    if (typeof CONFIG === "undefined" || !CONFIG.contractAddress) {
        throw new Error("ไม่พบ CONFIG.contractAddress ในไฟล์ config.js");
    }
    if (!ethers.isAddress(CONFIG.contractAddress)) {
        throw new Error(`Contract Address ใน config.js ไม่ถูกต้อง: ${CONFIG.contractAddress}`);
    }
    return CONFIG.contractAddress;
}

async function loadContractAbi() {
    if (cachedAbi) return cachedAbi;

    try {
        if (typeof CONFIG !== "undefined" && CONFIG.abiPath) {
            const response = await fetch(CONFIG.abiPath);
            if (response.ok) {
                cachedAbi = await response.json();
                return cachedAbi;
            }
        }
    } catch (err) {
        console.warn("ใช้ ABI สำรองในระบบแทนไฟล์ภายนอก:", err.message);
    }

    cachedAbi = EMBEDDED_GREENFARM_ABI;
    return cachedAbi;
}

// สำหรับอ่านข้อมูล (View Functions)
async function getReadContract() {
    if (greenFarmWrite) {
        return greenFarmWrite;
    }

    const contractAddress = getValidContractAddress();
    const abi = await loadContractAbi();
    const targetChainId = (typeof CONFIG !== "undefined" && CONFIG.network?.chainId) || 11155111;

    if (window.ethereum) {
        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const net = await browserProvider.getNetwork();
            if (Number(net.chainId) === Number(targetChainId)) {
                return new ethers.Contract(contractAddress, abi, browserProvider);
            }
        } catch (_) {}
    }

    if (!greenFarmRead) {
        const rpcUrl = (typeof CONFIG !== "undefined" && CONFIG.network?.rpcUrl) || FALLBACK_SEPOLIA_RPC;
        const readProvider = new ethers.JsonRpcProvider(rpcUrl);
        greenFarmRead = new ethers.Contract(
            contractAddress,
            abi,
            readProvider
        );
    }

    return greenFarmRead;
}

// สำหรับเขียนข้อมูล (Write Transactions)
function getContract() {
    if (!greenFarmWrite) {
        throw new Error("กรุณากดปุ่ม 'เชื่อมต่อ Wallet' ที่มุมขวาบนก่อนทำรายการ");
    }

    return greenFarmWrite;
}

async function connectWallet(requestPermission = true) {
    if (!window.ethereum) {
        if (requestPermission) {
            throw new Error("กรุณาติดตั้ง MetaMask");
        }
        return null;
    }

    const contractAddress = getValidContractAddress();
    const targetChainId = (typeof CONFIG !== "undefined" && CONFIG.network?.chainId) || 11155111;

    provider = new ethers.BrowserProvider(window.ethereum);

    if (requestPermission) {
        await provider.send("eth_requestAccounts", []);
    } else {
        const accounts = await provider.send("eth_accounts", []);
        if (!accounts || accounts.length === 0) {
            return null;
        }
    }

    let network = await provider.getNetwork();

    if (Number(network.chainId) !== Number(targetChainId)) {
        if (!requestPermission) {
            return null;
        }
        await switchToSepolia();
        provider = new ethers.BrowserProvider(window.ethereum);
        network = await provider.getNetwork();

        if (Number(network.chainId) !== Number(targetChainId)) {
            throw new Error("กรุณาเปลี่ยน Network ใน MetaMask เป็น Sepolia");
        }
    }

    signer = await provider.getSigner();
    const abi = await loadContractAbi();

    greenFarmWrite = new ethers.Contract(
        contractAddress,
        abi,
        signer
    );

    return await signer.getAddress();
}

function disconnectWalletState() {
    signer = null;
    greenFarmWrite = null;
}

async function switchToSepolia() {
    const chainIdHex = (typeof CONFIG !== "undefined" && CONFIG.network?.chainIdHex) || "0xaa36a7";
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [
                { chainId: chainIdHex }
            ]
        });
    } catch (error) {
        if (error.code === 4902) {
            throw new Error("กรุณาเพิ่ม Sepolia Network ใน MetaMask");
        }
        throw error;
    }
}

async function sendTransaction(transaction) {
    const tx = await transaction;
    console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction Confirmed:", receipt.hash);

    return receipt;
}