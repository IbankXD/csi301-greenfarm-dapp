# 🌱 GreenFarm — Blockchain Agricultural Supply Chain Traceability DApp
**CSI301 Blockchain & Smart Contract Technologies**

---

### 👥 ข้อมูลกลุ่มผู้พัฒนา (Group Info)
* **ชื่อกลุ่ม:** **DoubleFatZ**
* **สมาชิกในกลุ่ม:**
  1. `66026188` — นายศิวัฒน์ แก้วหนองสังข์
  2. `66084733` — นายธนวัฒน์ ณรงค์วงศ์วัฒนา

---

## 📌 บทสรุปโครงการ (Executive Summary)
ระบบจัดการและตรวจสอบย้อนกลับสินค้าเกษตรตลอดห่วงโซ่อุปทานบนเครือข่าย **Ethereum Blockchain (Sepolia Testnet)** พัฒนาในรูปแบบ **Serverless Decentralized Application (DApp)** เพื่อบันทึกข้อมูลแหล่งที่มา การเก็บเกี่ยว การขนส่ง และการจัดจำหน่ายอย่างโปร่งใส ป้องกันการปลอมแปลง และตรวจสอบย้อนหลังได้ทุกขั้นตอน

---

## 🔗 ข้อมูลการ Deploy ระบบ (Deployment Info)

* **🌐 Live Web Application (GitHub Pages):** `https://ibankxd.github.io/csi301-greenfarm-dapp/`
* **📜 Smart Contract Address (Sepolia):** `0x866d29Ff8Ea51fE95556D4686AA9a75d73C605BB`
* **🔍 Sepolia Etherscan:** `https://sepolia.etherscan.io/address/0x866d29Ff8Ea51fE95556D4686AA9a75d73C605BB`
* **⛓️ Blockchain Network:** Ethereum Sepolia Testnet (`Chain ID: 11155111`)
* **👑 Contract Admin:** `0x6c6Ba97164350DCccd114B697aCeaCA6Df6CC75b`

---

## ✨ ฟีเจอร์หลักของระบบ (Key Features)

1. **Role-Based Access Control (RBAC):** กำหนดสิทธิ์การเข้าถึงฟังก์ชันและเมนูหน้าเว็บตามบทบาทจริงบน Smart Contract (`Admin`, `Farmer`, `Transporter`, `Distributor`, `Consumer`)
2. **End-to-End Traceability & Visual Timeline:** แสดงข้อมูลล็อตสินค้าเกษตร (Batch Code, วันที่เก็บเกี่ยว, แหล่งเพาะปลูก, ใบรับรองมาตรฐาน) พร้อมเส้นทางการส่งมอบสินค้าแบบ Timeline ที่อ่านง่าย
3. **2-Step Custody Transfer (Request & Accept/Reject):** ระบบโอนย้ายการถือครองสินค้าแบบ 2 ขั้นตอน ผู้ส่งสร้างคำขอโอนย้าย และผู้รับปลายทางต้องกดยืนยันรับสินค้า (หรือปฏิเสธ) เพื่อป้องกันการโอนผิดพลาด
4. **Product Recall System:** ระบบเรียกคืนสินค้าฉุกเฉินโดย Admin พร้อมระบุเหตุผล ซึ่งจะแสดงแถบแจ้งเตือนทันทีเมื่อผู้บริโภคสแกนหรือค้นหาล็อตสินค้านั้น
5. **Public Read-Only Mode:** ผู้บริโภคและผู้ตรวจสามารถเปิดดูข้อมูลสถิติและค้นหาประวัติสินค้าได้ทันทีโดยไม่จำเป็นต้องเชื่อมต่อกระเป๋า MetaMask
6. **Evaluator Role Preview Switcher:** แถบสลับมุมมอง UI สำหรับผู้ตรวจระบบ เพื่อให้สามารถดูหน้าจอและแบบฟอร์มของทุกบทบาทได้ทันทีโดยไม่ต้องสลับหลายกระเป๋าเงิน

---

## 👥 บทบาทและสิทธิ์ในห่วงโซ่อุปทาน (Supply Chain Roles)

| Role ID | บทบาท (Role) | หน้าที่และสิทธิ์การทำงานบน Smart Contract |
| :---: | :--- | :--- |
| **4** | **Admin** (ผู้ดูแลระบบ) | ลงทะเบียนผู้มีส่วนได้ส่วนเสียเข้าสู่ระบบ (`registerStakeholder`) และสั่งเรียกคืนสินค้า (`recallProduct`) |
| **1** | **Farmer** (เกษตรกร) | ลงทะเบียนล็อตสินค้าเกษตรใหม่ (`registerProduct`) อัปเดตสถานะ และส่งคำขอโอนย้ายสินค้าให้ผู้ขนส่ง |
| **2** | **Transporter** (ผู้ขนส่ง) | ยืนยันรับสินค้า (`acceptTransfer`) ดูแลระหว่างขนส่ง และส่งมอบสินค้าต่อให้ผู้จัดจำหน่าย |
| **3** | **Distributor** (ผู้จัดจำหน่าย) | ยืนยันรับสินค้า อัปเดตสถานะเข้าคลังสินค้า (`AtWarehouse`) หรือกระจายสู่หน้าร้าน (`AtRetailer`) |
| **0** | **Consumer** (ผู้บริโภค / บุคคลทั่วไป) | ตรวจสอบข้อมูลแหล่งที่มา วันเก็บเกี่ยว และประวัติการเดินทางทั้งหมดของสินค้า |

---

## 🧪 คู่มือการทดสอบระบบสำหรับอาจารย์ผู้ตรวจ (Testing Guide)

1. **เข้าใช้งานผ่านลิงก์ GitHub Pages:**
   * ระบบจะทำงานในโหมดอ่านข้อมูลสาธารณะ (Read-Only) อัตโนมัติ แสดงจำนวนล็อตสินค้าและสมาชิกจริงบนเครือข่าย Sepolia
2. **ทดสอบการตรวจสอบย้อนกลับ (Consumer View):**
   * ไปที่เมนู **`ประวัติสินค้า`**
   * คลิกเลือกปุ่มสินค้าตัวอย่างด้านล่างช่องค้นหา (แนะนำ **`Product ID: 1`**) เพื่อดูรายละเอียดสินค้าและ Timeline การส่งมอบครบทุกขั้นตอน
3. **ทดสอบดูหน้าจอการทำงานของแต่ละบทบาท (UI Preview):**
   * คลิกเลือกปุ่มบนแถบ **`👁️ โหมดสลับมุมมองบทบาท (สำหรับผู้ตรวจระบบ)`** ด้านบนหน้าเว็บ (`Admin` / `Farmer` / `Transporter` / `Distributor`) เพื่อตรวจสอบโครงสร้างฟอร์มและเมนูของแต่ละบทบาท
   * *(หมายเหตุ: การส่ง Transaction จริงยังคงถูกตรวจสอบสิทธิ์ความปลอดภัยจาก Smart Contract บน Blockchain)*
4. **ทดสอบทำรายการจริงบน Blockchain (Write Transaction):**
   * เชื่อมต่อ **MetaMask** และเลือกเครือข่ายเป็น **Sepolia Testnet** เพื่อทำรายการตามสิทธิ์ของกระเป๋าเงินนั้น ๆ

---

## 🛠️ เทคโนโลยีที่ใช้พัฒนา (Tech Stack)

* **Smart Contract:** Solidity (`^0.8.20`)
* **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript (ES6+)
* **Web3 Library:** Ethers.js (`v6.13.5`)
* **Hosting & Network:** GitHub Pages & Ethereum Sepolia Testnet

---

## 📂 โครงสร้างไฟล์ในโปรเจกต์ (Project Structure)

```text
Project2_GreenFarm_Traceability/
├── index.html              # หน้าเว็บหลัก (Dashboard, Stakeholders, Products, Transfer, History)
├── config.js               # ตั้งค่า Contract Address, Sepolia Chain ID และ Path ของ ABI
├── contract.js             # จัดการการเชื่อมต่อ MetaMask, Read-Only RPC และ Smart Contract
├── app.js                  # Logic ควบคุมหน้าเว็บ ระบบสิทธิ์ตาม Role และแสดงผล Timeline
├── greenfarm-abi.json      # ไฟล์ ABI ของ Smart Contract
├── GreenFarm.sol           # ซอร์สโค้ด Smart Contract (Solidity)
├── deployment-info.txt     # บันทึกข้อมูลการ Deploy และสถานะบน Sepolia
└── README.md               # เอกสารอธิบายโครงงานและคู่มือการใช้งาน
```
