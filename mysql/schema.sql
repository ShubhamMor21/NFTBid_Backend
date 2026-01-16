-- Database: nft_bid
-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `firstName` VARCHAR(255) NOT NULL,
  `lastName` VARCHAR(255) NOT NULL,
  `mobileNumber` VARCHAR(255) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `bio` VARCHAR(255) DEFAULT NULL,
  `profileImage` VARCHAR(255) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT '1',
  `role` ENUM('user', 'creator', 'admin') NOT NULL DEFAULT 'user',
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: wallets
CREATE TABLE IF NOT EXISTS `wallets` (
  `id` CHAR(36) NOT NULL,
  `walletAddress` VARCHAR(255) NOT NULL,
  `nonce` VARCHAR(255) DEFAULT NULL,
  `is_blocked` TINYINT(1) NOT NULL DEFAULT '0',
  `userId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_walletAddress` (`walletAddress`),
  KEY `FK_wallets_users` (`userId`),
  CONSTRAINT `FK_wallets_users` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: nfts
CREATE TABLE IF NOT EXISTS `nfts` (
  `id` CHAR(36) NOT NULL,
  `token_id` VARCHAR(255) NOT NULL,
  `contract_address` VARCHAR(255) NOT NULL,
  `chain_id` INT DEFAULT NULL,
  `creator_wallet` VARCHAR(255) DEFAULT NULL,
  `current_owner_wallet` VARCHAR(255) DEFAULT NULL,
  `metadata_url` TEXT DEFAULT NULL,
  `image_url` TEXT DEFAULT NULL,
  `is_listed` TINYINT(1) NOT NULL DEFAULT '0',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: auctions
CREATE TABLE IF NOT EXISTS `auctions` (
  `id` CHAR(36) NOT NULL,
  `nftId` CHAR(36) NOT NULL,
  `sellerWallet` VARCHAR(255) NOT NULL,
  `sellerId` VARCHAR(255) NOT NULL,
  `startPrice` DECIMAL(18,8) NOT NULL,
  `reservePrice` DECIMAL(18,8) DEFAULT NULL,
  `minBidIncrement` DECIMAL(18,8) NOT NULL,
  `startTime` TIMESTAMP NOT NULL,
  `endTime` TIMESTAMP NOT NULL,
  `highest_bid` DECIMAL(18,8) DEFAULT NULL,
  `highest_bidder` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'ENDED', 'SETTLED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `auction_tx_hash` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_auctions_nfts` (`nftId`),
  CONSTRAINT `FK_auctions_nfts` FOREIGN KEY (`nftId`) REFERENCES `nfts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: bids
CREATE TABLE IF NOT EXISTS `bids` (
  `id` CHAR(36) NOT NULL,
  `auctionId` CHAR(36) NOT NULL,
  `bidderWallet` VARCHAR(255) NOT NULL,
  `bidAmount` DECIMAL(18,8) NOT NULL,
  `tx_hash` VARCHAR(255) DEFAULT NULL,
  `is_valid` TINYINT(1) NOT NULL DEFAULT '1',
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_bids_auctions` (`auctionId`),
  CONSTRAINT `FK_bids_auctions` FOREIGN KEY (`auctionId`) REFERENCES `auctions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: auction_participants
CREATE TABLE IF NOT EXISTS `auction_participants` (
  `id` CHAR(36) NOT NULL,
  `auction_id` CHAR(36) NOT NULL,
  `wallet_address` VARCHAR(255) NOT NULL,
  `last_bid_amount` DECIMAL(18,8) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_participants_auctions` (`auction_id`),
  CONSTRAINT `FK_participants_auctions` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` CHAR(36) NOT NULL,
  `wallet_address` VARCHAR(255) NOT NULL,
  `tx_hash` VARCHAR(255) NOT NULL,
  `type` ENUM('BID', 'AUCTION_CREATE', 'AUCTION_SETTLE', 'REFUND') NOT NULL,
  `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `amount` DECIMAL(18,8) NOT NULL,
  `chain_id` INT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_tx_hash` (`tx_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: auction_events
CREATE TABLE IF NOT EXISTS `auction_events` (
  `id` CHAR(36) NOT NULL,
  `auction_id` CHAR(36) NOT NULL,
  `event_type` ENUM('BID_PLACED', 'AUCTION_STARTED', 'AUCTION_ENDED') NOT NULL,
  `tx_hash` VARCHAR(255) NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL,
  `wallet_address` VARCHAR(255) NOT NULL,
  `type` ENUM('OUTBID', 'AUCTION_WON', 'AUCTION_ENDED') NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT '0',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
