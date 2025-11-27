// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract GameStore is ERC721, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // ========== CONCEPTOS DE NFT.sol ==========
    using Strings for uint256;
    mapping(uint256 => string) private _tokenURIs;
    string private _baseURIextended;

    // ========== CONCEPTOS DE Pagos.sol ==========
    address[] public payees;
    mapping(address => uint256) public shares;
    uint256 public totalShares;

    // ========== CONCEPTOS DE Wallet.sol ==========
    address[] public owners;
    uint256 public requiredApprovals;
    mapping(address => bool) public isOwner;

    struct Transaction {
        address to;
        uint256 amount;
        uint256 approvalCount;
        bool executed;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approvals;

    // ========== MARKETPLACE DE JUEGOS ==========
    mapping(uint256 => uint256) public gamePrices;
    mapping(uint256 => bool) public forSale;
    mapping(uint256 => address) public gameSellers;
    mapping(address => uint256[]) public userPurchases;

   
    struct GameInfo {
        uint256 id;
        string name;
        string description;
        string image;
        string genre;
        uint256 price;
        address seller;
        bool active;
        uint256 createdAt;
    }

    mapping(uint256 => GameInfo) public gameInfo;
    mapping(uint256 => bool) public gameExists;

   
    event GameMinted(uint256 indexed tokenId, address indexed owner, string tokenURI, uint256 price);
    event GameSold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event GameListed(uint256 indexed tokenId, uint256 price);
    event GameUnlisted(uint256 indexed tokenId);
    event GameUpdated(uint256 indexed tokenId, uint256 newPrice);
    event GameRemoved(uint256 indexed tokenId);
    event PaymentReceived(address indexed sender, uint256 amount);
    event PaymentReleased(address indexed to, uint256 amount);
    event TransactionSubmitted(uint256 indexed txId, address indexed to, uint256 amount);
    event TransactionApproved(uint256 indexed txId, address owner);
    event TransactionExecuted(uint256 indexed txId, address indexed to, uint256 amount);

   
    constructor() ERC721("GameStoreNFT", "GAME") {
        address deployer = msg.sender;
        
        
        owners.push(deployer);
        isOwner[deployer] = true;
        requiredApprovals = 1;

       
        payees.push(deployer);
        shares[deployer] = 100;
        totalShares = 100;

        _transferOwnership(deployer);
    }

 
    function setupMultiSig(address[] memory _owners, uint256 _requiredApprovals) external onlyOwner {
        require(_owners.length > 0, "Must have owners");
        require(_requiredApprovals > 0 && _requiredApprovals <= _owners.length, "Invalid approvals");
        
       
        for (uint256 i = 0; i < owners.length; i++) {
            isOwner[owners[i]] = false;
        }
        delete owners;
        
       
        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid address");
            require(!isOwner[owner], "Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }
        requiredApprovals = _requiredApprovals;
    }

    function setupPaymentSplitter(address[] memory _payees, uint256[] memory _shares) external onlyOwner {
        require(_payees.length == _shares.length, "PaymentSplitter: payees and shares length mismatch");
        require(_payees.length > 0, "PaymentSplitter: no payees");

      
        for (uint256 i = 0; i < payees.length; i++) {
            shares[payees[i]] = 0;
        }
        delete payees;
        totalShares = 0;

  
        for (uint256 i = 0; i < _payees.length; i++) {
            _addPayee(_payees[i], _shares[i]);
        }
    }

    // ========== FUNCIONES DE NFT.sol ==========
    function setBaseURI(string memory baseUri) external onlyOwner {
        _baseURIextended = baseUri;
    }

    function _setTokenUri(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721Metadata: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns(string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();
        
        if(bytes(base).length == 0) {
            return _tokenURI;
        }
        if(bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }
        return string(abi.encodePacked(base, tokenId.toString()));
    }

    // ========== FUNCIONES DEL MARKETPLACE ==========
    function mintGame(
        address recipient, 
        string memory _tokenURI, 
        uint256 price,
        string memory name,
        string memory description,
        string memory image,
        string memory genre
    ) public onlyOwner returns(uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _mint(recipient, newItemId);
        _setTokenUri(newItemId, _tokenURI);
        gamePrices[newItemId] = price;
        forSale[newItemId] = true;
        gameSellers[newItemId] = recipient;
        
        gameInfo[newItemId] = GameInfo({
            id: newItemId,
            name: name,
            description: description,
            image: image,
            genre: genre,
            price: price,
            seller: recipient,
            active: true,
            createdAt: block.timestamp
        });
        gameExists[newItemId] = true;
        
        emit GameMinted(newItemId, recipient, _tokenURI, price);
        return newItemId;
    }

    function buyGame(uint256 tokenId) external payable nonReentrant {
        require(forSale[tokenId], "Game not for sale");
        require(gameInfo[tokenId].active, "Game is not active");
        require(msg.value == gamePrices[tokenId], "Incorrect price");
        require(ownerOf(tokenId) != msg.sender, "You already own this game");
        
        address previousOwner = ownerOf(tokenId);
        _transfer(previousOwner, msg.sender, tokenId);
        forSale[tokenId] = false;
        userPurchases[msg.sender].push(tokenId);
        
        payable(previousOwner).transfer(msg.value);
        
        emit GameSold(tokenId, previousOwner, msg.sender, msg.value);
    }

    function listGameForSale(uint256 tokenId, uint256 price) external {
        require(_exists(tokenId), "Game does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be greater than 0");
        require(gameInfo[tokenId].active, "Game is not active");
        
        gamePrices[tokenId] = price;
        gameInfo[tokenId].price = price;
        forSale[tokenId] = true;
        gameSellers[tokenId] = msg.sender;
        
        emit GameListed(tokenId, price);
    }

    // ========== FUNCIONES DE GESTIÓN ==========
    function removeFromSale(uint256 tokenId) external {
        require(_exists(tokenId), "Game does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        forSale[tokenId] = false;
        emit GameUnlisted(tokenId);
    }

    function updateGamePrice(uint256 tokenId, uint256 newPrice) external {
        require(_exists(tokenId), "Game does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(newPrice > 0, "Price must be greater than 0");
        
        gamePrices[tokenId] = newPrice;
        gameInfo[tokenId].price = newPrice;
        emit GameUpdated(tokenId, newPrice);
    }

    function updateGameInfo(
        uint256 tokenId,
        string memory name,
        string memory description, 
        string memory image,
        string memory genre,
        uint256 price
    ) external onlyOwner {
        require(gameExists[tokenId], "Game does not exist");
        
        gameInfo[tokenId].name = name;
        gameInfo[tokenId].description = description;
        gameInfo[tokenId].image = image;
        gameInfo[tokenId].genre = genre;
        gamePrices[tokenId] = price;
        gameInfo[tokenId].price = price;
        
        emit GameUpdated(tokenId, price);
    }

    function disableGame(uint256 tokenId) external onlyOwner {
        require(gameExists[tokenId], "Game does not exist");
        gameInfo[tokenId].active = false;
        forSale[tokenId] = false;
        emit GameRemoved(tokenId);
    }

    function enableGame(uint256 tokenId) external onlyOwner {
        require(gameExists[tokenId], "Game does not exist");
        gameInfo[tokenId].active = true;
        emit GameUpdated(tokenId, gamePrices[tokenId]);
    }

    // ========== FUNCIONES DE CONSULTA ==========
    function getGamesForSale() external view returns(uint256[] memory) {
        uint256 total = _tokenIds.current();
        uint256 count = 0;
        
        for(uint256 i = 1; i <= total; i++) {
            if(forSale[i] && _exists(i) && gameInfo[i].active) {
                count++;
            }
        }
        
        uint256[] memory games = new uint256[](count);
        uint256 index = 0;
        
        for(uint256 i = 1; i <= total; i++) {
            if(forSale[i] && _exists(i) && gameInfo[i].active) {
                games[index] = i;
                index++;
            }
        }
        return games;
    }

    function getAllGames() external view returns(uint256[] memory) {
        uint256 total = _tokenIds.current();
        uint256 count = 0;
        
        for(uint256 i = 1; i <= total; i++) {
            if(_exists(i) && gameInfo[i].active) {
                count++;
            }
        }
        
        uint256[] memory games = new uint256[](count);
        uint256 index = 0;
        
        for(uint256 i = 1; i <= total; i++) {
            if(_exists(i) && gameInfo[i].active) {
                games[index] = i;
                index++;
            }
        }
        return games;
    }

    function getActiveGamesCount() external view returns(uint256) {
        uint256 total = _tokenIds.current();
        uint256 count = 0;
        
        for(uint256 i = 1; i <= total; i++) {
            if(_exists(i) && gameInfo[i].active) {
                count++;
            }
        }
        return count;
    }

    function getGameDetails(uint256 tokenId) external view returns(
        uint256 id,
        string memory name,
        string memory description,
        string memory image,
        string memory genre,
        uint256 price,
        address seller,
        bool isForSale,
        bool active,
        uint256 createdAt
    ) {
        require(gameExists[tokenId], "Game does not exist");
        GameInfo memory game = gameInfo[tokenId];
        
        return (
            game.id,
            game.name,
            game.description,
            game.image,
            game.genre,
            game.price,
            game.seller,
            forSale[tokenId],
            game.active,
            game.createdAt
        );
    }

    // ========== FUNCIONES DE Pagos.sol ==========
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "PaymentSplitter: account is the zero address");
        require(shares_ > 0, "PaymentSplitter: shares are 0");
        require(shares[account] == 0, "PaymentSplitter: account already has shares");

        payees.push(account);
        shares[account] = shares_;
        totalShares += shares_;
    }

    function release() external nonReentrant {
        require(address(this).balance > 0, "PaymentSplitter: no funds to release");
        
        uint256 totalReceived = address(this).balance;
        for (uint256 i = 0; i < payees.length; i++) {
            address payee = payees[i];
            uint256 payment = (totalReceived * shares[payee]) / totalShares;
            
            if (payment > 0) {
                (bool success, ) = payable(payee).call{value: payment}("");
                require(success, "PaymentSplitter: failed to send ether");
                emit PaymentReleased(payee, payment);
            }
        }
    }

    // ========== FUNCIONES DE Wallet.sol ==========
    modifier onlyWalletOwner() {
        require(isOwner[msg.sender], "Not wallet owner");
        _;
    }

    function submitTransaction(address _to, uint256 amount) external onlyWalletOwner {
        require(_to != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");
        
        transactions.push(Transaction({
            to: _to,
            amount: amount,
            approvalCount: 0,
            executed: false
        }));
        
        emit TransactionSubmitted(transactions.length - 1, _to, amount);
    }

    function approveTransaction(uint256 txId) external onlyWalletOwner {
        require(txId < transactions.length, "Invalid transaction ID");
        Transaction storage transaction = transactions[txId];
        
        require(!transaction.executed, "Already executed");
        require(!approvals[txId][msg.sender], "Already approved");

        approvals[txId][msg.sender] = true;
        transaction.approvalCount++;

        emit TransactionApproved(txId, msg.sender);
    }

    function executeTransaction(uint256 txId) external onlyWalletOwner nonReentrant {
        require(txId < transactions.length, "Invalid transaction ID");
        Transaction storage transaction = transactions[txId];
        
        require(transaction.approvalCount >= requiredApprovals, "Not enough approvals");
        require(!transaction.executed, "Already executed");
        require(address(this).balance >= transaction.amount, "Insufficient balance");

        transaction.executed = true;
        
        (bool success, ) = payable(transaction.to).call{value: transaction.amount}("");
        require(success, "Transaction failed");
        
        emit TransactionExecuted(txId, transaction.to, transaction.amount);
    }

    // ========== FUNCIONES UTILITARIAS ==========
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    function getTransactions() external view returns (Transaction[] memory) {
        return transactions;
    }

    function getPayees() external view returns (address[] memory) {
        return payees;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getUserPurchases(address user) external view returns (uint256[] memory) {
        return userPurchases[user];
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIextended;
    }

    
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }
}