// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.1.0/contracts/utils/ReentrancyGuard.sol";

/// @title StampEscrow - pay-to-reach inbox settled in USDC on Arc
/// @notice Sender stakes USDC to message a recipient. Recipient can refund
///         (legit) or forfeit (spam). Protocol takes a bps fee on forfeits.
contract StampEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { Pending, Refunded, Forfeited, Expired }

    struct Stamp {
        address sender;
        address recipient;
        uint128 amount;
        uint40 createdAt;
        Status status;
        bytes32 messageHash;
    }

    IERC20 public immutable usdc;
    uint256 public protocolFeeBps; // forfeit fee in bps (e.g. 500 = 5%)
    uint256 public expiryWindow;   // seconds after which sender can self-refund
    address public feeSink;

    uint256 public nextId = 1;
    mapping(uint256 => Stamp) public stamps;

    event StampSent(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint128 amount,
        bytes32 messageHash
    );
    event StampRefunded(uint256 indexed id, address indexed by);
    event StampForfeited(uint256 indexed id, address indexed recipient, uint256 feeTaken);
    event StampExpired(uint256 indexed id);
    event ConfigUpdated(uint256 feeBps, uint256 expiryWindow, address feeSink);

    constructor(IERC20 _usdc, address _feeSink) Ownable(msg.sender) {
        require(address(_usdc) != address(0), "bad usdc");
        require(_feeSink != address(0), "bad feeSink");
        usdc = _usdc;
        feeSink = _feeSink;
        protocolFeeBps = 500;          // 5%
        expiryWindow = 7 days;
    }

    // ---------- sender ----------

    /// @notice Stake USDC to deliver a message. Caller must have approved the
    ///         contract for `amount` first.
    function sendStamp(
        address recipient,
        uint128 amount,
        bytes32 messageHash
    ) external nonReentrant returns (uint256 id) {
        require(recipient != address(0) && recipient != msg.sender, "bad recipient");
        require(amount > 0, "zero amount");

        id = nextId++;
        stamps[id] = Stamp({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            createdAt: uint40(block.timestamp),
            status: Status.Pending,
            messageHash: messageHash
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit StampSent(id, msg.sender, recipient, amount, messageHash);
    }

    /// @notice Sender can reclaim stake after expiryWindow if recipient never acted.
    function expire(uint256 id) external nonReentrant {
        Stamp storage s = stamps[id];
        require(s.status == Status.Pending, "not pending");
        require(msg.sender == s.sender, "not sender");
        require(block.timestamp >= s.createdAt + expiryWindow, "too early");
        s.status = Status.Expired;
        usdc.safeTransfer(s.sender, s.amount);
        emit StampExpired(id);
    }

    // ---------- recipient ----------

    function refund(uint256 id) external nonReentrant {
        Stamp storage s = stamps[id];
        require(s.status == Status.Pending, "not pending");
        require(msg.sender == s.recipient, "not recipient");
        s.status = Status.Refunded;
        usdc.safeTransfer(s.sender, s.amount);
        emit StampRefunded(id, msg.sender);
    }

    function forfeit(uint256 id) external nonReentrant {
        Stamp storage s = stamps[id];
        require(s.status == Status.Pending, "not pending");
        require(msg.sender == s.recipient, "not recipient");
        s.status = Status.Forfeited;

        uint256 fee = (uint256(s.amount) * protocolFeeBps) / 10_000;
        uint256 payout = s.amount - fee;
        if (fee > 0) usdc.safeTransfer(feeSink, fee);
        usdc.safeTransfer(s.recipient, payout);
        emit StampForfeited(id, s.recipient, fee);
    }

    /// @notice Bulk forfeit — critical for the "spam wave" demo flow.
    function forfeitBatch(uint256[] calldata ids) external nonReentrant {
        for (uint256 i; i < ids.length; ++i) {
            uint256 id = ids[i];
            Stamp storage s = stamps[id];
            if (s.status != Status.Pending || s.recipient != msg.sender) continue;
            s.status = Status.Forfeited;
            uint256 fee = (uint256(s.amount) * protocolFeeBps) / 10_000;
            uint256 payout = s.amount - fee;
            if (fee > 0) usdc.safeTransfer(feeSink, fee);
            usdc.safeTransfer(s.recipient, payout);
            emit StampForfeited(id, s.recipient, fee);
        }
    }

    function refundBatch(uint256[] calldata ids) external nonReentrant {
        for (uint256 i; i < ids.length; ++i) {
            uint256 id = ids[i];
            Stamp storage s = stamps[id];
            if (s.status != Status.Pending || s.recipient != msg.sender) continue;
            s.status = Status.Refunded;
            usdc.safeTransfer(s.sender, s.amount);
            emit StampRefunded(id, msg.sender);
        }
    }

    // ---------- owner ----------

    function setConfig(uint256 _feeBps, uint256 _expiryWindow, address _feeSink) external onlyOwner {
        require(_feeBps <= 2_000, "fee too high"); // cap at 20%
        require(_feeSink != address(0), "bad sink");
        protocolFeeBps = _feeBps;
        expiryWindow = _expiryWindow;
        feeSink = _feeSink;
        emit ConfigUpdated(_feeBps, _expiryWindow, _feeSink);
    }

    // ---------- views ----------

    function getStamp(uint256 id) external view returns (Stamp memory) {
        return stamps[id];
    }
}
