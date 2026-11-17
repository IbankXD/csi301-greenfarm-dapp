// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GreenFarm {

    // =========================================
    // 1. ADMIN
    // =========================================

    address public immutable admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // =========================================
    // 2. STAKEHOLDER ROLES
    // =========================================

    enum Role {
        None,
        Farmer,
        Transporter,
        Distributor,
        Admin
    }

    struct Stakeholder {
        string organizationName;
        Role role;
        bool active;
    }

    mapping(address => Stakeholder) public stakeholders;

    struct StakeholderInfo {
        address wallet;
        string organizationName;
        Role role;
        bool active;
    }

    address[] private stakeholderWallets;

    modifier onlyRegistered() {
        require(
            stakeholders[msg.sender].active,
            "Not registered"
        );
        _;
    }

    modifier onlyRole(Role _role) {
        require(
            stakeholders[msg.sender].active &&
            stakeholders[msg.sender].role == _role,
            "Unauthorized role"
        );
        _;
    }

    // =========================================
    // 3. PRODUCT STATUS
    // =========================================

    enum ProductStatus {
        Harvested,
        InTransit,
        AtWarehouse,
        AtRetailer,
        Recalled
    }

    // =========================================
    // 4. PRODUCT DATA
    // =========================================

    struct Product {
        uint256 id;
        string batchCode;
        string productName;
        uint64 harvestDate;
        string origin;
        string certification;
        address farmer;
        address currentCustodian;
        ProductStatus status;
        bool recalled;
        string recallReason;
        uint256 createdAt;
    }

    uint256 public nextProductId = 1;

    mapping(uint256 => Product) private products;

    mapping(bytes32 => uint256) private batchCodeToId;

    // =========================================
    // 5. PRODUCT HISTORY
    // =========================================

    struct History {
        string action;
        address actor;
        address fromCustodian;
        address toCustodian;
        ProductStatus status;
        uint256 timestamp;
        string note;
    }

    mapping(uint256 => History[]) private productHistories;

    // =========================================
    // 6. TRANSFER REQUEST
    // =========================================

    struct TransferRequest {
        address from;
        address to;
        ProductStatus previousStatus;
        uint256 requestedAt;
        string note;
        bool pending;
    }

    mapping(uint256 => TransferRequest) private transferRequests;

    // =========================================
    // 7. EVENTS
    // =========================================

    event StakeholderRegistered(
        address indexed wallet,
        Role role,
        string organizationName
    );

    event ProductRegistered(
        uint256 indexed productId,
        string batchCode,
        address indexed farmer
    );

    event TransferRequested(
        uint256 indexed productId,
        address indexed from,
        address indexed to
    );

    event TransferAccepted(
        uint256 indexed productId,
        address indexed from,
        address indexed to
    );

    event TransferRejected(
        uint256 indexed productId,
        address indexed from,
        address indexed to
    );

    event ProductStatusUpdated(
        uint256 indexed productId,
        ProductStatus status
    );

    event ProductRecalled(
        uint256 indexed productId,
        string reason
    );

    // =========================================
    // 8. CONSTRUCTOR
    // =========================================

    constructor() {
        admin = msg.sender;

        stakeholders[msg.sender] = Stakeholder({
            organizationName: "GreenFarm Admin",
            role: Role.Admin,
            active: true
        });

        stakeholderWallets.push(msg.sender);
    }

    // =========================================
    // 9. REGISTER STAKEHOLDER
    // =========================================

    function registerStakeholder(
        address _wallet,
        string calldata _organizationName,
        Role _role
    ) external onlyAdmin {

        require(_wallet != address(0), "Invalid wallet");

        require(
            _role == Role.Farmer ||
            _role == Role.Transporter ||
            _role == Role.Distributor,
            "Invalid role"
        );

        require(
            !stakeholders[_wallet].active,
            "Already registered"
        );

        stakeholders[_wallet] = Stakeholder({
            organizationName: _organizationName,
            role: _role,
            active: true
        });

        stakeholderWallets.push(_wallet);

        emit StakeholderRegistered(
            _wallet,
            _role,
            _organizationName
        );
    }

    // =========================================
    // 10. REGISTER PRODUCT BATCH
    // =========================================

    function registerProduct(
        string calldata _batchCode,
        string calldata _productName,
        uint64 _harvestDate,
        string calldata _origin,
        string calldata _certification
    )
        external
        onlyRole(Role.Farmer)
        returns (uint256)
    {

        require(
            bytes(_batchCode).length > 0,
            "Batch code required"
        );

        require(
            bytes(_productName).length > 0,
            "Product name required"
        );

        require(
            _harvestDate > 0 &&
            uint256(_harvestDate) <= block.timestamp,
            "Invalid harvest date"
        );

        bytes32 batchHash = keccak256(
            bytes(_batchCode)
        );

        require(
            batchCodeToId[batchHash] == 0,
            "Batch already exists"
        );

        uint256 productId = nextProductId++;

        products[productId] = Product({
            id: productId,
            batchCode: _batchCode,
            productName: _productName,
            harvestDate: _harvestDate,
            origin: _origin,
            certification: _certification,
            farmer: msg.sender,
            currentCustodian: msg.sender,
            status: ProductStatus.Harvested,
            recalled: false,
            recallReason: "",
            createdAt: block.timestamp
        });

        batchCodeToId[batchHash] = productId;

        _addHistory(
            productId,
            "PRODUCT_REGISTERED",
            msg.sender,
            address(0),
            msg.sender,
            "Product batch registered"
        );

        emit ProductRegistered(
            productId,
            _batchCode,
            msg.sender
        );

        return productId;
    }

    // =========================================
    // 11. REQUEST PRODUCT TRANSFER
    // =========================================

    function requestTransfer(
        uint256 _productId,
        address _recipient,
        string calldata _note
    ) external onlyRegistered {

        Product storage product = products[_productId];

        require(
            product.id != 0,
            "Product not found"
        );

        require(!product.recalled, "Product recalled");

        require(
            product.currentCustodian == msg.sender,
            "Not current custodian"
        );

        require(
            _recipient != address(0) &&
            _recipient != msg.sender,
            "Invalid recipient"
        );

        require(
            stakeholders[_recipient].active &&
            stakeholders[_recipient].role != Role.Admin,
            "Recipient not authorized"
        );

        require(
            !transferRequests[_productId].pending,
            "Transfer already pending"
        );

        ProductStatus previousStatus = product.status;

        transferRequests[_productId] = TransferRequest({
            from: msg.sender,
            to: _recipient,
            previousStatus: previousStatus,
            requestedAt: block.timestamp,
            note: _note,
            pending: true
        });

        product.status = ProductStatus.InTransit;

        _addHistory(
            _productId,
            "TRANSFER_REQUESTED",
            msg.sender,
            msg.sender,
            _recipient,
            _note
        );

        emit TransferRequested(
            _productId,
            msg.sender,
            _recipient
        );

    }

    // =========================================
    // 12. ACCEPT PRODUCT TRANSFER
    // =========================================

    function acceptTransfer(
        uint256 _productId
    ) external onlyRegistered {

        Product storage product = products[_productId];

        TransferRequest storage request =
            transferRequests[_productId];

        require(product.id != 0, "Product not found");

        require(!product.recalled, "Product recalled");

        require(request.pending, "No pending transfer");

        require(
            msg.sender == request.to,
            "Only recipient can accept"
        );

        address previousOwner = request.from;

        product.currentCustodian = msg.sender;

        request.pending = false;

        _addHistory(
            _productId,
            "TRANSFER_ACCEPTED",
            msg.sender,
            previousOwner,
            msg.sender,
            request.note
        );

        emit TransferAccepted(
            _productId,
            previousOwner,
            msg.sender
        );

    }

    // =========================================
    // 13. REJECT PRODUCT TRANSFER
    // =========================================

    function rejectTransfer(
        uint256 _productId
    ) external onlyRegistered {

        Product storage product = products[_productId];

        TransferRequest storage request =
            transferRequests[_productId];

        require(product.id != 0, "Product not found");

        require(request.pending, "No pending transfer");

        require(
            msg.sender == request.to,
            "Only recipient can reject"
        );

        address sender = request.from;

        product.status = request.previousStatus;

        request.pending = false;

        _addHistory(
            _productId,
            "TRANSFER_REJECTED",
            msg.sender,
            sender,
            msg.sender,
            request.note
        );

        emit TransferRejected(
            _productId,
            sender,
            msg.sender
        );

    }

    // =========================================
    // 14. UPDATE PRODUCT STATUS
    // =========================================

    function updateProductStatus(
        uint256 _productId,
        ProductStatus _newStatus,
        string calldata _note
    ) external onlyRegistered {

        Product storage product = products[_productId];

        require(product.id != 0, "Product not found");

        require(!product.recalled, "Product recalled");

        require(
            product.currentCustodian == msg.sender,
            "Not current custodian"
        );

        require(
            !transferRequests[_productId].pending,
            "Transfer pending"
        );

        require(
            _newStatus != ProductStatus.InTransit &&
            _newStatus != ProductStatus.Recalled,
            "Invalid status update"
        );

        product.status = _newStatus;

        _addHistory(
            _productId,
            "STATUS_UPDATED",
            msg.sender,
            msg.sender,
            msg.sender,
            _note
        );

        emit ProductStatusUpdated(
            _productId,
            _newStatus
        );

    }

    // =========================================
    // 15. PRODUCT RECALL
    // =========================================

    function recallProduct(
        uint256 _productId,
        string calldata _reason
    ) external onlyAdmin {

        Product storage product = products[_productId];

        require(product.id != 0, "Product not found");

        require(!product.recalled, "Already recalled");

        require(
            bytes(_reason).length > 0,
            "Reason required"
        );

        product.recalled = true;

        product.status = ProductStatus.Recalled;

        product.recallReason = _reason;

        // Cancel pending transfer if one exists.
        transferRequests[_productId].pending = false;

        _addHistory(
            _productId,
            "PRODUCT_RECALLED",
            msg.sender,
            product.currentCustodian,
            address(0),
            _reason
        );

        emit ProductRecalled(
            _productId,
            _reason
        );

    }

    // =========================================
    // 16. GET STAKEHOLDERS
    // =========================================

    function getStakeholders()
        external
        view
        returns (StakeholderInfo[] memory list)
    {
        uint256 length = stakeholderWallets.length;

        list = new StakeholderInfo[](length);

        for (uint256 i = 0; i < length; i++) {
            address wallet = stakeholderWallets[i];
            Stakeholder storage stakeholder = stakeholders[wallet];

            list[i] = StakeholderInfo({
                wallet: wallet,
                organizationName: stakeholder.organizationName,
                role: stakeholder.role,
                active: stakeholder.active
            });
        }
    }

    // =========================================
    // 17. GET PRODUCT INFORMATION
    // =========================================

    function getProduct(
        uint256 _productId
    ) external view returns (Product memory) {

        require(
            products[_productId].id != 0,
            "Product not found"
        );

        return products[_productId];
    }

    // =========================================
    // 18. GET PRODUCT HISTORY
    // =========================================

    function getProductHistory(
        uint256 _productId
    ) external view returns (History[] memory) {

        require(
            products[_productId].id != 0,
            "Product not found"
        );

        return productHistories[_productId];
    }

    // =========================================
    // 19. GET PRODUCT ID BY BATCH CODE
    // =========================================

    function getProductIdByBatchCode(
        string calldata _batchCode
    ) external view returns (uint256) {

        uint256 productId = batchCodeToId[
            keccak256(bytes(_batchCode))
        ];

        require(
            productId != 0,
            "Batch not found"
        );

        return productId;
    }

    // =========================================
    // 20. GET TRANSFER REQUEST
    // =========================================

    function getTransferRequest(
        uint256 _productId
    ) external view returns (TransferRequest memory) {

        require(
            products[_productId].id != 0,
            "Product not found"
        );

        return transferRequests[_productId];
    }

    // =========================================
    // 21. INTERNAL HISTORY FUNCTION
    // =========================================

    function _addHistory(
        uint256 _productId,
        string memory _action,
        address _actor,
        address _from,
        address _to,
        string memory _note
    ) internal {

        productHistories[_productId].push(
            History({
                action: _action,
                actor: _actor,
                fromCustodian: _from,
                toCustodian: _to,
                status: products[_productId].status,
                timestamp: block.timestamp,
                note: _note
            })
        );

    }

}
