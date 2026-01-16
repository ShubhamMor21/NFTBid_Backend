import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { CreateAuctionDto } from '../creator/dto/create-auction.dto';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { MESSAGES } from '../../common/constants/messages';
import { AuctionsGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { RedisService } from '../redis/redis.service';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class AuctionsService {
    constructor(
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        private readonly websocketGateway: AuctionsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Create a new auction in DRAFT status.
     */
    async createAuction(userId: string, walletAddress: string, userRole: UserRole, dto: CreateAuctionDto): Promise<Auction> {
        try {
            // 1. Check if NFT exists and user is the owner
            const nft = await this.nftRepository.findOne({ where: { id: dto.nftId } });
            if (!nft) {
                throw new NotFoundException(MESSAGES.NFT.NOT_FOUND);
            }

            if (userRole !== UserRole.ADMIN && nft.current_owner_wallet.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            }

            // 2. Check if NFT is already listed in an active auction
            const existingAuction = await this.auctionRepository.findOne({
                where: { nftId: dto.nftId, status: AuctionStatus.ACTIVE },
            });
            if (existingAuction) {
                throw new ConflictException(MESSAGES.AUCTION.ALREADY_ACTIVE);
            }

            // 3. Create Auction
            const auction = this.auctionRepository.create({
                ...dto,
                sellerId: userId,
                sellerWallet: walletAddress.toLowerCase(),
                status: AuctionStatus.DRAFT,
            });

            return await this.auctionRepository.save(auction);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof ConflictException) {
                throw error;
            }
            console.error('createAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Start an auction manually (Manual Start).
     */
    async startAuction(id: string, userId: string, userRole: UserRole): Promise<Auction> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id } });
            if (!auction) throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            if (userRole !== UserRole.ADMIN && auction.sellerId !== userId) throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            if (auction.status !== AuctionStatus.DRAFT) throw new BadRequestException('Only DRAFT auctions can be started.');

            auction.status = AuctionStatus.ACTIVE;
            auction.startTime = new Date(); // Start now

            const savedAuction = await this.auctionRepository.save(auction);

            // Invalidate relevant caches
            await this.redisService.del('auctions:active');

            // Broadcast event
            this.websocketGateway.emitAuctionStatusChanged('auction_started', {
                auctionId: auction.id,
                status: AuctionStatus.ACTIVE,
            });

            return savedAuction;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error;
            }
            console.error('startAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * End an auction manually.
     */
    async endAuction(id: string, userId: string, userRole: UserRole): Promise<Auction> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id } });
            if (!auction) throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            if (userRole !== UserRole.ADMIN && auction.sellerId !== userId) throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            if (auction.status !== AuctionStatus.ACTIVE) throw new BadRequestException('Only ACTIVE auctions can be ended.');

            auction.status = AuctionStatus.ENDED;
            auction.endTime = new Date();

            const savedAuction = await this.auctionRepository.save(auction);

            // Invalidate caches
            await this.redisService.del(`auction:${id}`);
            await this.redisService.del('auctions:active');

            this.websocketGateway.emitAuctionStatusChanged('auction_ended', {
                auctionId: auction.id,
                status: AuctionStatus.ENDED,
            });

            // Notify Seller
            await this.notificationsService.createNotification(
                auction.sellerWallet,
                'Auction Ended',
                `Your auction for NFT ${auction.nftId} has ended.`,
                NotificationType.AUCTION_ENDED,
            );

            return savedAuction;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error;
            }
            console.error('endAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Settle an auction.
     */
    async settleAuction(id: string, userId: string, userRole: UserRole): Promise<Auction> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id }, relations: ['nft'] });
            if (!auction) throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            if (userRole !== UserRole.ADMIN && auction.sellerId !== userId) throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            if (auction.status !== AuctionStatus.ENDED) throw new BadRequestException('Only ENDED auctions can be settled.');

            // Logic to transfer NFT ownership (simplified)
            if (auction.highest_bidder) {
                const nft = auction.nft;
                nft.current_owner_wallet = auction.highest_bidder;
                nft.is_listed = false;
                await this.nftRepository.save(nft);

                // Invalidate NFT cache
                await this.redisService.del(`nft:${nft.id}`);

                // Notify winner
                await this.notificationsService.createNotification(
                    auction.highest_bidder,
                    'Auction Won!',
                    `Congratulations! You won the auction for NFT ${auction.nftId}!`,
                    NotificationType.AUCTION_WON,
                );
            }

            auction.status = AuctionStatus.SETTLED;
            const savedAuction = await this.auctionRepository.save(auction);

            // Invalidate caches
            await this.redisService.del(`auction:${id}`);

            this.websocketGateway.emitAuctionStatusChanged('auction_settled', {
                auctionId: auction.id,
                status: AuctionStatus.SETTLED,
            });

            return savedAuction;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error;
            }
            console.error('settleAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Fetch auction detail.
     */
    async getAuctionById(id: string): Promise<Auction> {
        try {
            const cacheKey = `auction:${id}`;
            const cached = await this.redisService.get<Auction>(cacheKey);
            if (cached) return cached;

            const auction = await this.auctionRepository.findOne({
                where: { id },
                relations: ['nft', 'bids'],
            });
            if (!auction) {
                throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            }

            // Cache for 5 minutes
            await this.redisService.set(cacheKey, auction, 300);
            return auction;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('getAuctionById error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List all currently active auctions.
     */
    async getActiveAuctions(): Promise<Auction[]> {
        try {
            const cacheKey = 'auctions:active';
            const cached = await this.redisService.get<Auction[]>(cacheKey);
            if (cached) return cached;

            const auctions = await this.auctionRepository.find({
                where: { status: AuctionStatus.ACTIVE },
                relations: ['nft'],
                order: { endTime: 'ASC' },
            });

            // Cache for 1 minute (feed updates frequently)
            await this.redisService.set(cacheKey, auctions, 60);
            return auctions;
        } catch (error) {
            console.error('getActiveAuctions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
