// ==========================================
// GREENFARM APPLICATION (ROLE-BASED + EVALUATOR MODE)
// ==========================================

const STATUS_LABELS = {
    0: "Harvested (เก็บเกี่ยวแล้ว)",
    1: "InTransit (กำลังขนส่ง)",
    2: "AtWarehouse (อยู่ที่คลังสินค้า)",
    3: "AtRetailer (อยู่ที่ร้านค้าปลีก)",
    4: "Recalled (เรียกคืนสินค้า)"
};

const STATUS_BADGES = {
    0: "bg-emerald-100 text-emerald-800 border-emerald-200",
    1: "bg-blue-100 text-blue-800 border-blue-200",
    2: "bg-amber-100 text-amber-800 border-amber-200",
    3: "bg-purple-100 text-purple-800 border-purple-200",
    4: "bg-red-100 text-red-800 border-red-200"
};

const ROLE_LABELS = {
    0: "ผู้บริโภค / บุคคลทั่วไป (Consumer)",
    1: "เกษตรกร (Farmer)",
    2: "ผู้ขนส่ง (Transporter)",
    3: "ผู้จัดจำหน่าย (Distributor)",
    4: "ผู้ดูแลระบบ (Admin)"
};

const ROLE_BADGES = {
    1: "bg-green-100 text-green-800",
    2: "bg-blue-100 text-blue-800",
    3: "bg-amber-100 text-amber-800",
    4: "bg-purple-100 text-purple-800"
};

const ROLE_ALLOWED_PAGES = {
    0: ["dashboard", "history"],
    1: ["dashboard", "products", "transfer", "history"],
    2: ["dashboard", "products", "transfer", "history"],
    3: ["dashboard", "products", "transfer", "history"],
    4: ["dashboard", "stakeholders", "products", "history"]
};

const PAGE_INFO = {
    dashboard: ["แดชบอร์ด", "ภาพรวมระบบ GreenFarm Blockchain"],
    stakeholders: ["ผู้มีส่วนได้ส่วนเสีย", "จัดการข้อมูลสมาชิกในระบบ"],
    products: ["สินค้าเกษตร", "ลงทะเบียนและจัดการสินค้า"],
    transfer: ["การโอนย้ายสินค้า", "จัดการการส่งมอบสินค้า"],
    history: ["ประวัติสินค้า", "ตรวจสอบย้อนกลับบน Blockchain"]
};

let currentAccount = null;
let actualWalletRole = 0;
let previewRoleOverride = null;
let activeDisplayRole = 0;
let stakeholderDirectory = {};
let sessionStakeholderCache = new Map();

// Limit harvest date picker to today
const harvestDateInput = document.getElementById("harvestDate");
if (harvestDateInput) {
    harvestDateInput.max = new Date().toISOString().split("T")[0];
}

// LocalStorage Helper สำหรับจำ Address สมาชิกแยกตาม Contract Address
function getStorageKey() {
    const addr = (typeof CONFIG !== "undefined" && CONFIG.contractAddress)
        ? CONFIG.contractAddress.toLowerCase()
        : "default";
    return `greenfarm_members_${addr}`;
}

function getSavedWallets() {
    try {
        const raw = localStorage.getItem(getStorageKey());
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function saveWalletToCache(walletAddress) {
    if (!walletAddress || !ethers.isAddress(walletAddress)) return;
    try {
        const list = getSavedWallets();
        const exists = list.some(w => w.toLowerCase() === walletAddress.toLowerCase());
        if (!exists) {
            list.push(walletAddress);
            localStorage.setItem(getStorageKey(), JSON.stringify(list));
        }
    } catch (_) {}
}

// Initialize Dashboard Contract Info
function initContractInfoUI() {
    if (typeof CONFIG !== "undefined" && CONFIG.contractAddress) {
        const contractCard = document.getElementById("contractCard");
        const etherscanLink = document.getElementById("etherscanLink");
        if (contractCard) contractCard.textContent = CONFIG.contractAddress;
        if (etherscanLink) {
            etherscanLink.href = `https://sepolia.etherscan.io/address/${CONFIG.contractAddress}`;
        }
    }
}

function copyContractAddress() {
    if (typeof CONFIG !== "undefined" && CONFIG.contractAddress) {
        copyText(CONFIG.contractAddress, " Contract Address ");
    }
}

// ==========================================
// EVALUATOR PREVIEW & ROLE-BASED UI PERMISSIONS
// ==========================================

function setPreviewRole(roleOrNull) {
    previewRoleOverride = roleOrNull;

    document.querySelectorAll(".preview-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtnId = roleOrNull === null ? "preview-auto" : `preview-${roleOrNull}`;
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add("active");

    const banner = document.getElementById("previewBanner");
    if (banner) {
        banner.classList.toggle("hidden", roleOrNull === null);
    }

    const effectiveRole = roleOrNull !== null ? Number(roleOrNull) : actualWalletRole;
    applyRolePermissions(effectiveRole);
}

function applyRolePermissions(role) {
    activeDisplayRole = Number(role) || 0;
    const allowedPages = ROLE_ALLOWED_PAGES[activeDisplayRole] || ROLE_ALLOWED_PAGES[0];

    document.querySelectorAll(".nav-btn").forEach(btn => {
        const page = btn.dataset.page;
        btn.classList.toggle("hidden", !allowedPages.includes(page));
    });

    const registerCard = document.getElementById("registerProductCard");
    const productListCard = document.getElementById("productListCard");
    const updateStatusCard = document.getElementById("updateStatusCard");
    const recallCard = document.getElementById("recallProductCard");

    if (registerCard) {
        registerCard.classList.toggle("hidden", activeDisplayRole !== 1);
    }
    if (productListCard) {
        productListCard.classList.toggle("hidden", ![1, 2, 3, 4].includes(activeDisplayRole));
    }
    if (updateStatusCard) {
        updateStatusCard.classList.toggle("hidden", ![1, 2, 3].includes(activeDisplayRole));
    }
    if (recallCard) {
        recallCard.classList.toggle("hidden", activeDisplayRole !== 4);
    }

    const walletCard = document.getElementById("walletCard");
    if (walletCard) {
        if (previewRoleOverride !== null) {
            walletCard.textContent = `${ROLE_LABELS[activeDisplayRole]} [โหมดจำลอง UI]`;
        } else {
            walletCard.textContent = ROLE_LABELS[actualWalletRole];
        }
    }

    const activePageEl = document.querySelector(".page:not(.hidden)");
    if (activePageEl && !allowedPages.includes(activePageEl.id)) {
        showPage("dashboard");
    }
}

// Page Navigation (Unified)
function showPage(pageId) {
    const allowedPages = ROLE_ALLOWED_PAGES[activeDisplayRole] || ROLE_ALLOWED_PAGES[0];
    if (!allowedPages.includes(pageId)) {
        pageId = "dashboard";
    }

    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    const selected = document.getElementById(pageId);
    if (!selected) return;

    selected.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === pageId);
    });

    const info = PAGE_INFO[pageId];
    if (info) {
        document.getElementById("pageTitle").textContent = info[0];
        document.getElementById("pageSubtitle").textContent = info[1];
    }

    if (typeof closeSidebar === "function") {
        closeSidebar();
    }

    if (pageId === "stakeholders") {
        loadStakeholders();
    } else if (pageId === "products" || pageId === "history") {
        loadProductsList();
    }
}

// Display Message
function showMessage(message, type = "success") {
    const element = document.getElementById("message");
    element.textContent = message;
    element.className = type === "error"
        ? "mb-6 p-4 rounded-lg bg-red-100 text-red-700 font-medium"
        : "mb-6 p-4 rounded-lg bg-green-100 text-green-700 font-medium";
}

// Handle Errors
function handleError(error) {
    console.error(error);

    let message = error.reason ||
                  error.shortMessage ||
                  error.message ||
                  "Transaction failed";

    if (error.code === 4001) {
        message = "ผู้ใช้ปฏิเสธ Transaction";
    }

    showMessage(message, "error");
}

// Format Unix Timestamp
function formatTimestamp(ts) {
    const num = Number(ts);
    if (!num) return "-";
    return new Date(num * 1000).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

// Shorten Address
function shortAddress(addr) {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "-";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Format Address with Organization Name if available
function formatActorLabel(addr) {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "-";
    const info = stakeholderDirectory[addr.toLowerCase()];
    if (info) {
        return `${info.name} (${shortAddress(addr)})`;
    }
    return shortAddress(addr);
}

// Copy to Clipboard Helper
async function copyText(text, label = "ข้อมูล") {
    try {
        await navigator.clipboard.writeText(text);
        showMessage(`คัดลอก${label}เรียบร้อย: ${text}`);
    } catch (err) {
        showMessage("ไม่สามารถคัดลอกอัตโนมัติได้", "error");
    }
}

// ==========================================
// WALLET UI SYNC & AUTO-DETECT ACCOUNT
// ==========================================

async function updateWalletUI(address) {
    currentAccount = address;
    let detectedRole = 0;
    let roleText = ROLE_LABELS[0];
    let orgText = "";
    let readError = null;

    try {
        const contract = await getReadContract();

        const stakeholder = await contract.stakeholders(address);
        const isActive = Boolean(stakeholder.active ?? stakeholder[2]);
        const rawRole = Number(stakeholder.role ?? stakeholder[1] ?? 0);
        const orgName = stakeholder.organizationName ?? stakeholder[0] ?? "";

        if (isActive && rawRole > 0) {
            detectedRole = rawRole;
            roleText = ROLE_LABELS[detectedRole] || `Role #${detectedRole}`;
            orgText = orgName ? ` (${orgName})` : "";
            saveWalletToCache(address);
        } else {
            try {
                const adminAddr = await contract.admin();
                if (adminAddr && adminAddr.toLowerCase() === address.toLowerCase()) {
                    detectedRole = 4;
                    roleText = ROLE_LABELS[4];
                    orgText = orgName ? ` (${orgName})` : " (Contract Admin)";
                    saveWalletToCache(adminAddr);
                }
            } catch (_) {}
        }
    } catch (err) {
        console.error("ไม่สามารถดึงข้อมูล Role ได้:", err);
        readError = err.reason || err.shortMessage || err.message || "ไม่สามารถอ่านข้อมูลจาก Smart Contract ได้";
    }

    actualWalletRole = detectedRole;
    const effectiveRole = previewRoleOverride !== null ? previewRoleOverride : actualWalletRole;
    applyRolePermissions(effectiveRole);

    const walletDot = document.getElementById("walletDot");
    if (walletDot) {
        walletDot.classList.remove("bg-red-500", "bg-amber-400");
        walletDot.classList.add("bg-green-500");
    }

    document.getElementById("connectBtn").textContent =
        shortAddress(address);

    document.getElementById("walletStatus").textContent =
        `Connected: ${address} | บทบาทจริง: ${roleText}${orgText}`;

    if (previewRoleOverride === null) {
        document.getElementById("walletCard").textContent = roleText;
    }

    if (readError) {
        showMessage(
            `เชื่อมต่อ Wallet แล้ว แต่ไม่สามารถอ่าน Role จาก Contract ได้: ${readError}`,
            "error"
        );
        return false;
    }

    await Promise.all([
        loadStakeholders(),
        loadProductsList()
    ]);

    return true;
}

function resetWalletUI() {
    currentAccount = null;
    actualWalletRole = 0;
    disconnectWalletState();

    const effectiveRole = previewRoleOverride !== null ? previewRoleOverride : 0;
    applyRolePermissions(effectiveRole);

    const walletDot = document.getElementById("walletDot");
    if (walletDot) {
        walletDot.classList.remove("bg-green-500");
        walletDot.classList.add("bg-amber-400");
    }

    document.getElementById("connectBtn").textContent =
        "🔗 เชื่อมต่อ Wallet";

    document.getElementById("walletStatus").textContent =
        "โหมดอ่านข้อมูลสาธารณะ (เชื่อมต่อ MetaMask เพื่อทำรายการบน Blockchain)";

    if (previewRoleOverride === null) {
        document.getElementById("walletCard").textContent =
            "ผู้บริโภค (Read-Only)";
    }
}

async function handleConnect() {
    try {
        const address = await connectWallet(true);

        if (address) {
            const ok = await updateWalletUI(address);
            if (ok) {
                showMessage(`เชื่อมต่อ MetaMask สำเร็จ — บทบาท: ${ROLE_LABELS[actualWalletRole]}`);
            }
        }
    } catch (error) {
        handleError(error);
    }
}

// ==========================================
// INITIALIZATION (READ-ONLY FIRST + AUTO-CONNECT)
// ==========================================

initContractInfoUI();
applyRolePermissions(0);

window.addEventListener("load", async () => {
    await Promise.all([
        loadStakeholders(),
        loadProductsList()
    ]);

    try {
        const address = await connectWallet(false);
        if (address) {
            await updateWalletUI(address);
        }
    } catch (error) {
        console.warn("Auto-connect skipped:", error);
    }
});

// Listen for MetaMask Account & Network Changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (!accounts || accounts.length === 0) {
            resetWalletUI();
            showMessage("ยกเลิกการเชื่อมต่อกระเป๋าเงินแล้ว", "error");
            return;
        }

        try {
            const address = await connectWallet(false);
            if (address) {
                const ok = await updateWalletUI(address);
                if (ok) {
                    showMessage(`สลับบัญชีเป็น ${shortAddress(address)} — บทบาท: ${ROLE_LABELS[actualWalletRole]}`);
                }
            }
        } catch (error) {
            handleError(error);
        }
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

// ==========================================
// RENDER STAKEHOLDERS HELPER
// ==========================================

function renderStakeholdersUI(list) {
    const tbody = document.getElementById("stakeholdersTableBody");
    const countEl = document.getElementById("stakeholderCount");
    const receiverSelect = document.getElementById("receiverSelect");
    const statStakeholders = document.getElementById("statStakeholders");

    stakeholderDirectory = {};
    list.forEach(item => {
        stakeholderDirectory[item.wallet.toLowerCase()] = {
            name: item.organizationName,
            role: item.role
        };
    });

    if (statStakeholders) statStakeholders.textContent = `${list.length} ราย`;
    if (countEl) countEl.textContent = `ทั้งหมด ${list.length} รายการ`;

    if (tbody) {
        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="p-4 text-center text-gray-400">
                        ยังไม่มีข้อมูลสมาชิกในระบบ
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML = list.map(item => {
                const roleLabel = ROLE_LABELS[item.role] || "Unknown";
                const badgeClass = ROLE_BADGES[item.role] || "bg-gray-100 text-gray-800";
                const isMe = currentAccount &&
                    item.wallet.toLowerCase() === currentAccount.toLowerCase();

                return `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3 font-medium">
                            ${item.organizationName}
                            ${isMe ? '<span class="ml-2 text-xs bg-green-700 text-white px-2 py-0.5 rounded">บัญชีของคุณ</span>' : ''}
                        </td>
                        <td class="p-3">
                            <span class="px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}">
                                ${roleLabel}
                            </span>
                        </td>
                        <td class="p-3 font-mono text-xs text-gray-600">
                            ${item.wallet}
                        </td>
                        <td class="p-3 text-center">
                            <button
                                type="button"
                                onclick="copyText('${item.wallet}', ' Wallet Address ')"
                                class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-medium transition">
                                คัดลอก
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }

    if (receiverSelect) {
        const eligibleRecipients = list.filter(item => {
            const isNotAdmin = item.role !== 4 && item.role !== 0;
            const isNotMe = !currentAccount ||
                item.wallet.toLowerCase() !== currentAccount.toLowerCase();
            return item.active && isNotAdmin && isNotMe;
        });

        receiverSelect.innerHTML =
            `<option value="">-- เลือกผู้รับโอนจากรายชื่อ (${eligibleRecipients.length} รายการ) --</option>` +
            eligibleRecipients.map(item => {
                const roleLabel = ROLE_LABELS[item.role] || "";
                return `<option value="${item.wallet}">[${roleLabel}] ${item.organizationName} (${shortAddress(item.wallet)})</option>`;
            }).join("");
    }
}

// ==========================================
// LOAD STAKEHOLDERS (MULTI-SOURCE SYNC)
// ==========================================

async function loadStakeholders() {
    const tbody = document.getElementById("stakeholdersTableBody");
    const countEl = document.getElementById("stakeholderCount");

    try {
        const contract = await getReadContract();
        const memberMap = new Map(sessionStakeholderCache);
        const candidateWallets = new Set(getSavedWallets());

        if (currentAccount) {
            candidateWallets.add(currentAccount);
        }

        // 1. ดึงจาก getStakeholders() หาก Contract รองรับ
        try {
            const rawList = await contract.getStakeholders();
            rawList.forEach(item => {
                const wallet = item.wallet ?? item[0];
                if (!wallet) return;
                saveWalletToCache(wallet);
                memberMap.set(wallet.toLowerCase(), {
                    wallet: wallet,
                    organizationName: item.organizationName ?? item[1] ?? "ไม่ระบุชื่อ",
                    role: Number(item.role ?? item[2] ?? 0),
                    active: Boolean(item.active ?? item[3])
                });
            });
        } catch (err) {
            console.warn("getStakeholders() fallback triggered:", err.message);
        }

        // 2. ดึง Address ของ Admin
        try {
            const adminAddr = await contract.admin();
            if (adminAddr) {
                candidateWallets.add(adminAddr);
                saveWalletToCache(adminAddr);
            }
        } catch (_) {}

        // 3. ดึงจาก Event ย้อนหลังแบบแบ่งช่วงบล็อก (กัน Error ช่วงบล็อกเกินกำหนดบน Sepolia)
        try {
            const runnerProvider = contract.runner?.provider || contract.runner;
            if (runnerProvider && typeof runnerProvider.getBlockNumber === "function") {
                const latestBlock = await runnerProvider.getBlockNumber();
                const chunkSize = 45000;
                const maxLookback = 180000;
                const minBlock = Math.max(0, latestBlock - maxLookback);

                for (let toBlock = latestBlock; toBlock > minBlock; toBlock -= chunkSize) {
                    const fromBlock = Math.max(minBlock, toBlock - chunkSize + 1);
                    try {
                        const events = await contract.queryFilter(
                            contract.filters.StakeholderRegistered(),
                            fromBlock,
                            toBlock
                        );
                        events.forEach(ev => {
                            const wallet = ev.args?.wallet ?? ev.args?.[0];
                            if (wallet) {
                                candidateWallets.add(wallet);
                                saveWalletToCache(wallet);
                            }
                        });
                    } catch (_) {}
                }
            }
        } catch (_) {}

        // 4. ตรวจสอบสถานะล่าสุดของทุก Address ที่พบกับ contract.stakeholders(wallet)
        for (const wallet of candidateWallets) {
            try {
                const st = await contract.stakeholders(wallet);
                const isActive = Boolean(st.active ?? st[2]);
                const roleNum = Number(st.role ?? st[1] ?? 0);
                const orgName = st.organizationName ?? st[0] ?? "";

                if (isActive && roleNum > 0) {
                    memberMap.set(wallet.toLowerCase(), {
                        wallet: wallet,
                        organizationName: orgName || (roleNum === 4 ? "GreenFarm Admin" : "ไม่ระบุชื่อ"),
                        role: roleNum,
                        active: true
                    });
                } else {
                    // เช็กกรณีเป็น Admin ที่ไม่ได้ถูกบันทึก active ใน mapping
                    try {
                        const adminAddr = await contract.admin();
                        if (adminAddr && adminAddr.toLowerCase() === wallet.toLowerCase()) {
                            memberMap.set(wallet.toLowerCase(), {
                                wallet: wallet,
                                organizationName: orgName || "GreenFarm Admin",
                                role: 4,
                                active: true
                            });
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }

        sessionStakeholderCache = new Map(memberMap);
        const list = Array.from(memberMap.values());
        renderStakeholdersUI(list);

    } catch (error) {
        console.error("Load stakeholders error:", error);
        const errMsg = error.reason || error.shortMessage || error.message || "ไม่สามารถเชื่อมต่อ Blockchain ได้";
        if (countEl) countEl.textContent = "ไม่สามารถโหลดรายชื่อสมาชิกได้";
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="p-5 text-center text-red-600 text-xs">
                        เกิดข้อผิดพลาด: ${errMsg}
                    </td>
                </tr>`;
        }
    }
}

function handleSelectReceiver(walletAddress) {
    if (walletAddress) {
        document.getElementById("receiverAddress").value = walletAddress;
    }
}

// ==========================================
// LOAD PRODUCTS LIST TABLE & HISTORY QUICK-SELECT
// ==========================================

async function loadProductsList() {
    const tbody = document.getElementById("productsTableBody");
    const countEl = document.getElementById("productCount");
    const statProducts = document.getElementById("statProducts");
    const sampleContainer = document.getElementById("sampleProductsContainer");

    try {
        const contract = await getReadContract();
        const nextId = Number(await contract.nextProductId());
        const total = nextId - 1;

        if (statProducts) statProducts.textContent = `${total} ล็อต`;
        if (countEl) countEl.textContent = `ทั้งหมด ${total} รายการ`;

        if (total <= 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="p-4 text-center text-gray-400">
                            ยังไม่มีสินค้าในระบบ
                        </td>
                    </tr>`;
            }
            if (sampleContainer) {
                sampleContainer.innerHTML = `<span class="text-xs text-slate-400">ยังไม่มีสินค้าลงทะเบียนในระบบ</span>`;
            }
            return;
        }

        const promises = [];
        for (let i = 1; i <= total; i++) {
            promises.push(contract.getProduct(i));
        }

        const products = await Promise.all(promises);
        const reversedProducts = [...products].reverse();

        if (sampleContainer) {
            sampleContainer.innerHTML = reversedProducts.map(p => {
                const id = p.id.toString();
                return `
                    <button type="button"
                        onclick="quickViewHistory('${id}')"
                        class="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-xs font-medium transition">
                        #${id} ${p.productName} <span class="font-mono text-cyan-700">(${p.batchCode})</span>
                    </button>
                `;
            }).join("");
        }

        if (!tbody) return;

        tbody.innerHTML = reversedProducts.map(p => {
            const id = p.id.toString();
            const statusNum = Number(p.status);
            const statusText = STATUS_LABELS[statusNum] || statusNum;
            const isMine = currentAccount &&
                p.currentCustodian.toLowerCase() === currentAccount.toLowerCase();
            const canTransfer = (isMine || previewRoleOverride !== null) &&
                [1, 2, 3].includes(activeDisplayRole) && !p.recalled;

            return `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-bold text-green-800">#${id}</td>
                    <td class="p-3 font-mono text-xs">${p.batchCode}</td>
                    <td class="p-3 font-medium">${p.productName}</td>
                    <td class="p-3 text-xs">${statusText}</td>
                    <td class="p-3 font-mono text-xs text-gray-600">
                        ${formatActorLabel(p.currentCustodian)}
                        ${isMine ? '<span class="ml-1 text-xs text-green-700 font-sans font-bold">(คุณ)</span>' : ''}
                    </td>
                    <td class="p-3 text-center space-x-1">
                        ${canTransfer ? `
                        <button
                            type="button"
                            onclick="quickTransferProduct('${id}')"
                            class="bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded text-xs font-medium">
                            โอนย้าย
                        </button>` : ''}
                        <button
                            type="button"
                            onclick="quickViewHistory('${id}')"
                            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-xs font-medium">
                            ประวัติ
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Load products error:", error);
        const errMsg = error.reason || error.shortMessage || error.message || "ไม่สามารถโหลดข้อมูลสินค้าได้";
        if (countEl) countEl.textContent = "ไม่สามารถโหลดรายการสินค้าได้";
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-5 text-center text-red-600 text-xs">
                        เกิดข้อผิดพลาด: ${errMsg}
                    </td>
                </tr>`;
        }
    }
}

function quickTransferProduct(productId) {
    showPage("transfer");
    document.getElementById("transferProductId").value = productId;
}

function quickViewHistory(productId) {
    showPage("history");
    document.getElementById("historyProductId").value = productId;
    loadProductHistory();
}

// ==========================================
// REGISTER STAKEHOLDER
// ==========================================

document.getElementById("stakeholderForm")
.addEventListener("submit", async function(event) {
    event.preventDefault();

    try {
        const contract = getContract();
        const address = document.getElementById("stakeholderAddress").value.trim();
        const organization = document.getElementById("organizationName").value.trim();
        const role = Number(document.getElementById("stakeholderRole").value);

        if (!ethers.isAddress(address)) {
            throw new Error("Invalid Wallet Address");
        }

        showMessage("กำลังส่งคำขอลงทะเบียนไปยัง MetaMask...");

        const tx = await contract.registerStakeholder(address, organization, role);
        await sendTransaction(tx);

        // บันทึกลง Cache ทันทีและอัปเดตตารางทันทีหลัง Transaction ยืนยัน
        saveWalletToCache(address);
        sessionStakeholderCache.set(address.toLowerCase(), {
            wallet: address,
            organizationName: organization,
            role: role,
            active: true
        });
        renderStakeholdersUI(Array.from(sessionStakeholderCache.values()));

        showMessage(`ลงทะเบียน "${organization}" (${ROLE_LABELS[role]}) สำเร็จ!`);
        this.reset();
        await loadStakeholders();
    } catch (error) {
        handleError(error);
    }
});

// ==========================================
// REGISTER PRODUCT (WITH AUTO PRODUCT ID)
// ==========================================

document.getElementById("productForm")
.addEventListener("submit", async function(event) {
    event.preventDefault();

    try {
        const contract = getContract();
        const batchCode = document.getElementById("batchCode").value.trim();
        const productName = document.getElementById("productName").value.trim();
        const date = document.getElementById("harvestDate").value;
        const harvestTimestamp = Math.floor(new Date(date + "T00:00:00").getTime() / 1000);
        const origin = document.getElementById("origin").value.trim();
        const certification = document.getElementById("certification").value.trim();

        if (!Number.isSafeInteger(harvestTimestamp) || harvestTimestamp <= 0) {
            throw new Error("Invalid harvest date");
        }

        showMessage("Registering Product on Blockchain...");

        const tx = await contract.registerProduct(
            batchCode,
            productName,
            harvestTimestamp,
            origin,
            certification
        );

        const receipt = await sendTransaction(tx);

        let createdProductId = null;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed && parsed.name === "ProductRegistered") {
                    createdProductId = parsed.args.productId.toString();
                    break;
                }
            } catch (e) {}
        }

        if (createdProductId) {
            document.getElementById("createdProductIdText").textContent = createdProductId;
            document.getElementById("createdBatchCodeText").textContent = batchCode;
            document.getElementById("createdProductBanner").classList.remove("hidden");
            document.getElementById("quickTransferCreatedBtn").onclick = () => {
                quickTransferProduct(createdProductId);
            };

            showMessage(
                `ลงทะเบียนสินค้าสำเร็จ! รหัสสินค้า (Product ID): #${createdProductId} | TX: ${receipt.hash}`
            );
        } else {
            showMessage("Product Registered Successfully! TX: " + receipt.hash);
        }

        this.reset();
        await loadProductsList();
    } catch (error) {
        handleError(error);
    }
});

// ==========================================
// REQUEST TRANSFER
// ==========================================

document.getElementById("transferForm")
.addEventListener("submit", async function(event) {
    event.preventDefault();

    try {
        const contract = getContract();
        const productId = document.getElementById("transferProductId").value;
        const receiver = document.getElementById("receiverAddress").value.trim();
        const note = document.getElementById("transferNote").value.trim();

        if (!ethers.isAddress(receiver)) {
            throw new Error("Invalid Receiver Address");
        }

        showMessage("Sending Transfer Request...");

        const tx = await contract.requestTransfer(productId, receiver, note);
        const receipt = await sendTransaction(tx);

        showMessage("Transfer Requested! TX: " + receipt.hash);
        this.reset();
        await loadProductsList();
    } catch (error) {
        handleError(error);
    }
});

// ==========================================
// ACCEPT / REJECT TRANSFER
// ==========================================

async function handleTransferDecision(accept) {
    try {
        const contract = getContract();
        const productIdInput = document.getElementById("decisionProductId");
        const productId = productIdInput.value;

        if (!productId || Number(productId) <= 0) {
            throw new Error("Please enter Product ID");
        }

        showMessage("Processing Transfer...");

        const tx = accept
            ? await contract.acceptTransfer(productId)
            : await contract.rejectTransfer(productId);

        const receipt = await sendTransaction(tx);

        showMessage(
            (accept ? "Transfer Accepted" : "Transfer Rejected") +
            "! TX: " + receipt.hash
        );

        productIdInput.value = "";
        await loadProductsList();
    } catch (error) {
        handleError(error);
    }
}

// ==========================================
// PRODUCT DETAILS + VISUAL TIMELINE HISTORY
// ==========================================

async function loadProductHistory() {
    try {
        const contract = await getReadContract();
        const productId = document.getElementById("historyProductId").value;

        if (!productId || Number(productId) <= 0) {
            throw new Error("กรุณากรอกรหัสสินค้า (Product ID)");
        }

        showMessage("กำลังดึงข้อมูลประวัติสินค้าจาก Blockchain...");

        const [product, history] = await Promise.all([
            contract.getProduct(productId),
            contract.getProductHistory(productId)
        ]);

        const statusNum = Number(product.status);
        const statusText = STATUS_LABELS[statusNum] || statusNum;
        const statusBadge = STATUS_BADGES[statusNum] || "bg-slate-100 text-slate-800";

        const detailsEl = document.getElementById("productDetails");
        detailsEl.innerHTML = `
            <div class="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-md bg-green-100 text-green-800 font-bold text-xs">
                            ID #${product.id.toString()}
                        </span>
                        <span class="font-mono text-xs text-slate-500">Batch: ${product.batchCode}</span>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 mt-2">${product.productName}</h3>
                </div>
                <span class="px-3 py-1.5 rounded-full text-xs font-bold border ${statusBadge}">
                    ${statusText}
                </span>
            </div>

            ${product.recalled ? `
            <div class="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                <strong>⚠️ สินค้านี้ถูกเรียกคืน (RECALLED):</strong> ${product.recallReason}
            </div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 text-sm">
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">วันที่เก็บเกี่ยว (Harvest Date)</p>
                    <p class="font-semibold mt-1">${formatTimestamp(product.harvestDate)}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">แหล่งเพาะปลูก (Origin)</p>
                    <p class="font-semibold mt-1">${product.origin}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">ใบรับรองมาตรฐาน (Certification)</p>
                    <p class="font-semibold mt-1">${product.certification || "-"}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">เกษตรกรผู้ผลิต (Farmer)</p>
                    <p class="font-semibold mt-1 text-xs">${formatActorLabel(product.farmer)}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">ผู้ถือครองปัจจุบัน (Current Custodian)</p>
                    <p class="font-semibold mt-1 text-xs">${formatActorLabel(product.currentCustodian)}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50">
                    <p class="text-xs text-slate-400">เวลาที่บันทึกเข้าระบบ</p>
                    <p class="font-semibold mt-1">${formatTimestamp(product.createdAt)}</p>
                </div>
            </div>
        `;
        detailsEl.classList.remove("hidden");

        const historyEl = document.getElementById("historyResults");
        historyEl.innerHTML = `
            <h3 class="text-lg font-bold mb-5">เส้นทางการเดินทางของสินค้า (Supply Chain Timeline — ${history.length} ขั้นตอน)</h3>
            <div class="relative border-l-2 border-green-300 ml-3 space-y-6">
                ${history.map((item, idx) => {
                    const stepStatus = Number(item.status);
                    const stepStatusText = STATUS_LABELS[stepStatus] || stepStatus;
                    const stepBadge = STATUS_BADGES[stepStatus] || "bg-slate-100 text-slate-700";

                    return `
                        <div class="relative pl-6">
                            <span class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow"></span>
                            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded">
                                            Step ${idx + 1}
                                        </span>
                                        <span class="font-bold text-sm text-slate-800">${item.action}</span>
                                    </div>
                                    <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stepBadge}">
                                        ${stepStatusText}
                                    </span>
                                </div>

                                <div class="mt-2.5 text-xs text-slate-600 space-y-1">
                                    <p><strong>ผู้ดำเนินการ:</strong> ${formatActorLabel(item.actor)}</p>
                                    ${item.fromCustodian !== "0x0000000000000000000000000000000000000000" ? `
                                        <p><strong>การส่งมอบ:</strong> ${formatActorLabel(item.fromCustodian)} ➔ ${formatActorLabel(item.toCustodian)}</p>
                                    ` : ''}
                                    <p><strong>เวลาบันทึก:</strong> ${formatTimestamp(item.timestamp)}</p>
                                    ${item.note ? `<p><strong>หมายเหตุ:</strong> ${item.note}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
        historyEl.classList.remove("hidden");

        showMessage(`โหลดข้อมูลสินค้า #${productId} สำเร็จ`);
    } catch (error) {
        handleError(error);
    }
}

// ==========================================
// UPDATE PRODUCT STATUS
// ==========================================

async function updateProductStatus() {
    try {
        const contract = getContract();
        const idInput = document.getElementById("statusProductId");
        const noteInput = document.getElementById("statusNote");

        const id = idInput.value;
        const status = Number(document.getElementById("productStatus").value);
        const note = noteInput.value;

        if (!id || Number(id) <= 0) {
            throw new Error("Invalid Product ID");
        }

        showMessage("Updating Product Status...");

        const tx = await contract.updateProductStatus(id, status, note);
        const receipt = await sendTransaction(tx);

        showMessage("Product Status Updated! TX: " + receipt.hash);

        idInput.value = "";
        noteInput.value = "";
        await loadProductsList();
    } catch (error) {
        handleError(error);
    }
}

// ==========================================
// RECALL PRODUCT
// ==========================================

async function recallProduct() {
    try {
        const contract = getContract();
        const idInput = document.getElementById("recallProductId");
        const reasonInput = document.getElementById("recallReason");

        const id = idInput.value;
        const reason = reasonInput.value;

        if (!id || Number(id) <= 0 || !reason.trim()) {
            throw new Error("Please enter Product ID and Recall Reason");
        }

        showMessage("Processing Product Recall...");

        const tx = await contract.recallProduct(id, reason);
        const receipt = await sendTransaction(tx);

        showMessage("Product Recalled! TX: " + receipt.hash);

        idInput.value = "";
        reasonInput.value = "";
        await loadProductsList();
    } catch (error) {
        handleError(error);
    }
}