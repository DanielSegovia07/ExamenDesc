// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Examen {
    address[] public owners;
    uint public requiredApprovals;
    mapping(address => bool) public isOwner;

    struct Transaction {
        bytes32 txId;
        address to;
        uint amount;
        uint approvalCount;
        bool executed;
    }

    struct Approval {
        address approver;
        uint256 timestamp;
        bytes32 approvalId;
    }

    Transaction[] public transactions;
    mapping(uint => mapping(address => bool)) public approvals;
    mapping(uint => Approval[]) public transactionApprovals;

    address[] public payees;
    mapping(address => uint) public shares;
    uint256 public totalShares;

    uint256 private _status;

    modifier nonReentrant() {
        require(_status != 2, "Reentrancy Guard:Reentrant call");
        _status = 2;
        _;
        _status = 1;
    }

    event Deposit(address indexed sender, uint amount);
    event TransactionSubmitted(
        uint indexed txId,
        bytes32 indexed uniqueTxId,
        address indexed to,
        uint amount
    );

    event TransactionApproved(
        uint indexed txId,
        bytes32 indexed approvalId,
        address owner
    );
    event TransactionExecuted(
        uint indexed txId,
        bytes32 indexed uniqueTxId,
        address indexed to,
        uint amount
    );
    event PaymentReleased(address indexed payee, uint amount);

    struct Product {
        bytes32 productId;
        uint id;
        string name;
        uint price;
        address seller;
        bool active;
    }

    uint public nextProductId;
    mapping(uint => Product) public products;
    mapping(address => uint[]) public purchases;

    event ProductAdded(
        uint id,
        bytes32 indexed productId,
        string name,
        uint price,
        address seller
    );
    event ProductUpdated(
        uint id,
        bytes32 indexed productId,
        string name,
        uint price,
        bool active
    );
    event ProductPurchased(
        uint id,
        bytes32 indexed productId,
        address buyer,
        uint price
    );

    modifier onlyOwner() {
        require(isOwner[msg.sender]);
        _;
    }

    constructor(
        address[] memory _owners,
        uint _requiredApprovals,
        address[] memory _payees,
        uint256[] memory _shares
    ) {
        _status = 1;
        require(_owners.length > 0, "Must have owners");
        require(
            _requiredApprovals > 0 && _requiredApprovals <= _owners.length,
            "Invalid Approvals"
        );
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid address");
            require(!isOwner[owner], "Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }
        requiredApprovals = _requiredApprovals;

        require(_payees.length == _shares.length, "Length mismatch");
        require(_payees.length > 0, "No payees");

        for (uint256 i = 0; i < _payees.length; i++) {
            require(_payees[i] != address(0), "Invalid address");
            require(_shares[i] > 0, "Shares must be > 0");

            payees.push(_payees[i]);
            shares[_payees[i]] = _shares[i];
            totalShares += _shares[i];
        }
    }

    function deposit() public payable {
        require(msg.value > 0, "Debes mandar ether");
        emit Deposit(msg.sender, msg.value);
    }

    function SubmitTransaction(
        address _to,
        uint amount
    ) external onlyOwner returns (uint, bytes32) {
        require(_to != address(0), "Invalid Address");
        require(amount > 0, "Invalid Amount");

        bytes32 uniqueTxId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                transactions.length,
                _to,
                amount
            )
        );

        uint txId = transactions.length;
        transactions.push(
            Transaction({
                txId: uniqueTxId,
                to: _to,
                amount: amount,
                approvalCount: 0,
                executed: false
            })
        );

        emit TransactionSubmitted(txId, uniqueTxId, _to, amount);
        return (txId, uniqueTxId);
    }

    function approveTransaction(
        uint txId
    ) external onlyOwner returns (bytes32) {
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "Already executed");
        require(!approvals[txId][msg.sender], "Already approved");

        bytes32 approvalId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                transactionApprovals[txId].length,
                txId
            )
        );

        approvals[txId][msg.sender] = true;
        transaction.approvalCount++;

        transactionApprovals[txId].push(
            Approval({
                approver: msg.sender,
                timestamp: block.timestamp,
                approvalId: approvalId
            })
        );

        emit TransactionApproved(txId, approvalId, msg.sender);
        return approvalId;
    }

    function executeTransaction(uint txId) external onlyOwner nonReentrant {
        Transaction storage transaction = transactions[txId];
        require(
            transaction.approvalCount >= requiredApprovals,
            "Not enough approvals"
        );
        require(!transaction.executed, "Already executed");
        transaction.executed = true;
        (bool success, ) = payable(transaction.to).call{
            value: transaction.amount
        }("");
        require(success, "Transaction failed");
        emit TransactionExecuted(
            txId,
            transaction.txId,
            transaction.to,
            transaction.amount
        );
    }

    function releasePayments() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay fondos");
        for (uint256 i = 0; i < payees.length; i++) {
            address payee = payees[i];
            uint256 payment = (balance * shares[payee]) / totalShares;
            (bool success, ) = payee.call{value: payment}("");
            require(success, "Fallo el pago");
            emit PaymentReleased(payee, payment);
        }
    }

    function getTransactions() external view returns (Transaction[] memory) {
        return transactions;
    }

    function getBalance() external view returns (uint) {
        return address(this).balance;
    }

    function getTransactionApprovals(
        uint txId
    ) external view returns (Approval[] memory) {
        require(txId < transactions.length, "Invalid transaction ID");
        return transactionApprovals[txId];
    }

    function addProduct(
        string memory _name,
        uint _price
    ) external onlyOwner returns (uint, bytes32) {
        require(_price > 0, "El precio debe ser mayor a 0");
        uint productId = nextProductId;
        nextProductId++;

        bytes32 uniqueProductId = keccak256(
            abi.encodePacked(
                productId,
                msg.sender,
                productId,
                _name,
                _price
            )
        );

        products[productId] = Product({
            productId: uniqueProductId,
            id: productId,
            name: _name,
            price: _price,
            seller: msg.sender,
            active: true
        });
        emit ProductAdded(
            productId,
            uniqueProductId,
            _name,
            _price,
            msg.sender
        );
        return (productId, uniqueProductId);
    }

    function updateProduct(
        uint _productId,
        string memory _name,
        uint _price,
        bool _active
    ) external onlyOwner {
        require(_productId < nextProductId, "Producto no existe");
        Product storage product = products[_productId];
        require(bytes(_name).length > 0, "Nombre no puede estar vacio");
        require(_price > 0, "Precio debe ser mayor a 0");

        product.name = _name;
        product.price = _price;
        product.active = _active;

        emit ProductUpdated(
            _productId,
            product.productId,
            _name,
            _price,
            _active
        );
    }

    function buyProduct(uint _productId) external payable nonReentrant {
        Product storage product = products[_productId];
        require(product.active, "Producto no disponible");
        require(msg.value == product.price, "Monto incorrecto");

        purchases[msg.sender].push(_productId);
        emit ProductPurchased(
            _productId,
            product.productId,
            msg.sender,
            product.price
        );
    }

    function disableProduct(uint _productId) external onlyOwner {
        products[_productId].active = false;
        emit ProductUpdated(
            _productId,
            products[_productId].productId,
            products[_productId].name,
            products[_productId].price,
            false
        );
    }

    function getAllProducts() external view returns (Product[] memory) {
        Product[] memory all = new Product[](nextProductId);
        for (uint i = 0; i < nextProductId; i++) {
            all[i] = products[i];
        }
        return all;
    }
}
