import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bid } from '../../database/entities/bid.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { CreateBidDto } from './dto/create-bid.dto';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { MESSAGES } from '../../common/constants/messages';
import { AuctionsGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BidsService {
    constructor(
        @InjectRepository(Bid)
        private readonly bidRepository: Repository<Bid>,
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        private readonly websocketGateway: AuctionsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Place a new bid.
     */
    async placeBid(userId: string, dto: CreateBidDto): Promise<Bid> {
        try {
            // 1. Validate User eligibility
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user || !user.isActive) {
                throw new ForbiddenException('User is not active or not found.');
            }

            // 2. Fetch User's Wallet
            const wallet = await this.walletRepository.findOne({
                where: { userId, is_blocked: false },
                order: { createdAt: 'ASC' }  // Get the first (primary) wallet
            });
            if (!wallet) {
                throw new NotFoundException('No active wallet found for this user.');
            }
            const walletAddress = wallet.walletAddress;

            // 3. Fetch & Validate Auction
            const auction = await this.auctionRepository.findOne({ where: { id: dto.auctionId } });
            if (!auction) {
                throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            }

            const previousHighestBidder = auction.highest_bidder;
            await this.validateBid(auction, userId, dto.amount);

            // 4. Record Bid
            const bid = this.bidRepository.create({
                auctionId: dto.auctionId,
                bidderId: userId,
                bidderWallet: walletAddress.toLowerCase(),
                bidAmount: dto.amount,
                tx_hash: dto.transactionHash,
            });

            const savedBid = await this.bidRepository.save(bid);

            // 4. Update Highest Bid in Auction
            await this.updateHighestBid(auction, dto.amount, walletAddress);

            // Invalidate Auction Detail Cache
            await this.redisService.del(`auction:${dto.auctionId}`);
            await this.redisService.del('auctions:active');

            // 5. Broadcast Real-time Update
            this.websocketGateway.emitBidPlaced({
                auctionId: auction.id,
                bidder: walletAddress,
                amount: dto.amount,
            });

            // 6. Notify Outbid User
            if (previousHighestBidder && previousHighestBidder.toLowerCase() !== walletAddress.toLowerCase()) {
                await this.notificationsService.createNotification(
                    previousHighestBidder,
                    'Outbid!',
                    `You have been outbid on auction for NFT ${auction.nftId}. New bid: ${dto.amount}`,
                    NotificationType.OUTBID,
                );
            }

            return savedBid;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException ||
                error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }
            console.error('placeBid error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Validation logic for bids.
     */
    private async validateBid(auction: Auction, userId: string, amount: number): Promise<void> {
        if (auction.status !== AuctionStatus.ACTIVE) {
            throw new BadRequestException(MESSAGES.AUCTION.NOT_ACTIVE);
        }

        if (auction.sellerId === userId) {
            throw new ConflictException(MESSAGES.BID.OWN_AUCTION);
        }

        const currentHighest = Number(auction.highest_bid) || Number(auction.startPrice);
        const minRequired = currentHighest + Number(auction.minBidIncrement);

        if (amount < minRequired) {
            throw new BadRequestException(MESSAGES.BID.TOO_LOW);
        }
    }

    /**
     * Update the auction's highest bid.
     */
    private async updateHighestBid(auction: Auction, amount: number, walletAddress: string): Promise<void> {
        auction.highest_bid = amount;
        auction.highest_bidder = walletAddress.toLowerCase();
        await this.auctionRepository.save(auction);
    }

    /**
     * Fetch all bids for a specific auction.
     */
    async getBidsByAuction(auctionId: string): Promise<Bid[]> {
        try {
            return await this.bidRepository.find({
                where: { auctionId },
                order: { bidAmount: 'DESC', createdAt: 'DESC' },
            });
        } catch (error) {
            console.error('getBidsByAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Handle on-chain BidPlaced event.
     */
    async handleOnChainBid(tokenId: string, bidderWallet: string, amount: number, txHash: string) {
        try {
            // 1. Find the NFT to get the Auction
            const walletLower = bidderWallet.toLowerCase();
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) {
                console.warn(`NFT with token_id ${tokenId} not found during BidPlaced event.`);
                return;
            }

            const auction = await this.auctionRepository.findOne({
                where: { nftId: nft.id, status: AuctionStatus.ACTIVE },
            });

            if (!auction) {
                console.warn(`No active auction found for NFT ${nft.id} during BidPlaced event.`);
                return;
            }

            const previousHighestBidder = auction.highest_bidder;

            // 2. Look up the user by wallet address if possible
            const walletRecord = await this.walletRepository.findOne({ where: { walletAddress: walletLower } });
            const bidderId = walletRecord ? walletRecord.userId : 'SYSTEM';

            // 3. Record Bid
            const bid = this.bidRepository.create({
                auctionId: auction.id,
                bidderId: bidderId,
                bidderWallet: walletLower,
                bidAmount: amount,
                tx_hash: txHash,
            });

            await this.bidRepository.save(bid);

            // 4. Update Highest Bid in Auction
            auction.highest_bid = amount;
            auction.highest_bidder = walletLower;
            await this.auctionRepository.save(auction);

            // 5. Broadcast Real-time Update
            this.websocketGateway.emitBidPlaced({
                auctionId: auction.id,
                bidder: walletLower,
                amount: amount,
            });

            // 6. Invalidate Caches
            await this.redisService.del(`auction:${auction.id}`);
            await this.redisService.del('auctions:active');

            // 7. Notify Outbid User
            if (previousHighestBidder && previousHighestBidder.toLowerCase() !== walletLower) {
                await this.notificationsService.createNotification(
                    previousHighestBidder,
                    'Outbid!',
                    `You have been outbid on auction for Token ${tokenId}. New bid: ${amount}`,
                    NotificationType.OUTBID,
                );
            }

            // 8. Notify Seller
            await this.notificationsService.createNotification(
                auction.sellerWallet,
                'New Bid',
                `A new bid of ${amount} has been placed on your auction for Token ${tokenId}.`,
                NotificationType.SYSTEM_ALERT,
            );

            console.log(`Successfully synced on-chain BidPlaced for Token ${tokenId}`);
        } catch (error) {
            console.error(`handleOnChainBid error for ${tokenId}:`, error);
        }
    }
}
