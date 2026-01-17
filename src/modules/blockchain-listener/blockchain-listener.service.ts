import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NftsService } from '../nfts/nfts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { AuctionsService } from '../auctions/auctions.service';
import { BidsService } from '../bid/bid.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '../../database/entities/transaction.entity';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainListenerService implements OnModuleInit {
    private readonly logger = new Logger(BlockchainListenerService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly nftsService: NftsService,
        private readonly notificationsService: NotificationsService,
        private readonly auctionsService: AuctionsService,
        private readonly bidsService: BidsService,
        private readonly transactionsService: TransactionsService,
    ) { }

    onModuleInit() {
        this.logger.log('Blockchain Listener Service Initialized. Ready to listen for events...');
        this.listenForEvents();
    }

    private listenForEvents() {
        const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
        const contractAddress = this.configService.get<string>('blockchain.nftContractAddress');

        if (!rpcUrl || !contractAddress) {
            this.logger.warn('Blockchain config missing (RPC_URL or NFT_CONTRACT_ADDRESS). Listener skipped.');
            return;
        }

        this.logger.log(`Initializing Blockchain Listener... Config: RPC=${rpcUrl}, Address=${contractAddress}`);

        try {
            // Extended ABI for Auction events
            const abi = [
                "event Minted(address indexed to, uint256 tokenId, string tokenURI)",
                "event AuctionCreated(uint256 indexed tokenId, address indexed seller, uint256 startingPrice, uint256 startTime, uint256 endTime)",
                "event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount)",
                "event AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount)",
                "event AuctionCanceled(uint256 indexed tokenId)"
            ];

            // Initialize Provider
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // Initialize Contract
            const contract = new ethers.Contract(contractAddress, abi, provider);

            this.logger.log('Listening for Blockchain events...');

            // Minted Event
            contract.on("Minted", async (to: string, tokenId: any, tokenURI: string, event: any) => {
                this.logger.log(`On-chain Mint Detected: TokenID=${tokenId.toString()} to ${to}`);
                await this.handleMintedEvent(to, tokenId.toString(), tokenURI, event.log.transactionHash);
            });

            // Auction Created Event
            contract.on("AuctionCreated", async (tokenId: any, seller: string, startingPrice: any, startTime: any, endTime: any, event: any) => {
                this.logger.log(`Auction Created: TokenID=${tokenId.toString()}`);
                await this.handleAuctionCreated(tokenId.toString(), seller, startingPrice.toString(), startTime.toString(), endTime.toString(), event.log.transactionHash);
            });

            // Bid Placed Event
            contract.on("BidPlaced", async (tokenId: any, bidder: string, amount: any, event: any) => {
                this.logger.log(`Bid Placed: TokenID=${tokenId.toString()} by ${bidder}`);
                await this.handleBidPlaced(tokenId.toString(), bidder, amount.toString(), event.log.transactionHash);
            });

            // Auction Ended Event
            contract.on("AuctionEnded", async (tokenId: any, winner: string, amount: any, event: any) => {
                this.logger.log(`Auction Ended: TokenID=${tokenId.toString()}`);
                await this.handleAuctionEnded(tokenId.toString(), winner, amount.toString(), event.log.transactionHash);
            });

            // Auction Canceled Event
            contract.on("AuctionCanceled", async (tokenId: any, event: any) => {
                this.logger.log(`Auction Canceled: TokenID=${tokenId.toString()}`);
                await this.handleAuctionCanceled(tokenId.toString(), event.log.transactionHash);
            });

        } catch (error) {
            this.logger.error('Failed to initialize blockchain listener', error);
        }
    }

    /**
     * Handle Minted Event: Update NFT owner and notify user.
     */
    async handleMintedEvent(to: string, tokenId: string, tokenURI: string, txHash?: string) {
        try {
            this.logger.log(`Processing Minted event for Token ID: ${tokenId}`);

            // 1. Record Transaction
            if (txHash) {
                await this.transactionsService.createTransaction(
                    txHash,
                    to,
                    TransactionType.MINT,
                    0,
                    { tokenId, tokenURI }
                );
            }

            // 2. Update NFT Owner in Database
            const nft = await this.nftsService.updateOwner(tokenId, to);

            if (nft) {
                // 2. Send Notification and Email
                await this.notificationsService.createNotification(
                    to,
                    'NFT Minted Successfully',
                    `Your NFT with Token ID ${tokenId} has been successfully minted on the blockchain!`,
                    NotificationType.SYSTEM_ALERT // Or a more specific type if valid
                );
                this.logger.log(`NFT ${tokenId} ownership updated and notification sent.`);
            } else {
                this.logger.warn(`NFT ${tokenId} record not found, skipping notification.`);
            }
        } catch (error) {
            this.logger.error(`Error handling Minted event for ${tokenId}`, error);
        }
    }

    /**
     * Manual trigger for syncing a specific transaction.
     */
    async syncTransaction(txHash: string) {
        this.logger.log(`Manual sync requested for transaction: ${txHash}`);
        // Logic to fetch transaction receipt and update local database
    }

    async handleAuctionCreated(tokenId: string, seller: string, startingPrice: string, startTime: string, endTime: string, txHash?: string) {
        try {
            this.logger.log(`Syncing Auction Created for Token ${tokenId}`);

            // 1. Record Transaction
            if (txHash) {
                await this.transactionsService.createTransaction(
                    txHash,
                    seller,
                    TransactionType.AUCTION_CREATE,
                    0,
                    { tokenId, startingPrice, startTime, endTime }
                );
            }

            await this.auctionsService.handleOnChainAuctionCreated(
                tokenId,
                seller,
                parseFloat(ethers.formatEther(startingPrice)),
                parseInt(startTime),
                parseInt(endTime)
            );
        } catch (error) {
            this.logger.error(`Error handling AuctionCreated for ${tokenId}`, error);
        }
    }

    async handleBidPlaced(tokenId: string, bidder: string, amount: string, txHash: string) {
        try {
            this.logger.log(`Syncing Bid Placed for Token ${tokenId} by ${bidder}`);

            // 1. Record Transaction
            await this.transactionsService.createTransaction(
                txHash,
                bidder,
                TransactionType.BID,
                parseFloat(ethers.formatEther(amount)),
                { tokenId }
            );

            await this.bidsService.handleOnChainBid(
                tokenId,
                bidder,
                parseFloat(ethers.formatEther(amount)),
                txHash
            );
        } catch (error) {
            this.logger.error(`Error handling BidPlaced for ${tokenId}`, error);
        }
    }

    async handleAuctionEnded(tokenId: string, winner: string, amount: string, txHash?: string) {
        try {
            this.logger.log(`Syncing Auction Ended for Token ${tokenId}`);

            // 1. Record Transaction (Seller or Winner? Usually seller ends but winner is relevant. Let's use winner for clarity if it's about movement of funds)
            // Actually, AuctionEnded event in contract might not specify who triggered it, but winner/amount are there.
            if (txHash) {
                await this.transactionsService.createTransaction(
                    txHash,
                    winner,
                    TransactionType.AUCTION_END,
                    parseFloat(ethers.formatEther(amount)),
                    { tokenId }
                );
            }

            await this.auctionsService.handleOnChainAuctionEnd(
                tokenId,
                winner,
                parseFloat(ethers.formatEther(amount))
            );
        } catch (error) {
            this.logger.error(`Error handling AuctionEnded for ${tokenId}`, error);
        }
    }

    async handleAuctionCanceled(tokenId: string, txHash?: string) {
        try {
            this.logger.log(`Syncing Auction Canceled for Token ${tokenId}`);

            // 1. Record Transaction
            if (txHash) {
                // We don't have the seller address here easily without fetching auction, 
                // but let's see if we can get it from auctionsService later or just record it.
                // For now use a placeholder or omit wallet if unknown (though tx_hash needs it in entity)
                // Let's look up the auction first to get sellerWallet.
                const auction = await this.auctionsService.getAuctionByTokenId(tokenId);
                if (auction) {
                    await this.transactionsService.createTransaction(
                        txHash,
                        auction.sellerWallet,
                        TransactionType.AUCTION_CANCEL,
                        0,
                        { tokenId }
                    );
                }
            }

            await this.auctionsService.handleOnChainAuctionCanceled(tokenId);
        } catch (error) {
            this.logger.error(`Error handling AuctionCanceled for ${tokenId}`, error);
        }
    }
}
