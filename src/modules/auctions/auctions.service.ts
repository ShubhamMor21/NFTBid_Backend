import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { Bid } from '../../database/entities/bid.entity';
import { CreateAuctionDto } from '../creator/dto/create-auction.dto';
import { GetAuctionsDto } from './dto/get-auctions.dto';
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
        @InjectRepository(Bid)
        private readonly bidRepository: Repository<Bid>,
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

            // Notify Seller
            await this.notificationsService.createNotification(
                auction.sellerWallet,
                'Auction Live',
                `Your auction for NFT ${auction.nftId} is now live!`,
                NotificationType.SYSTEM_ALERT,
            );

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

                // Notify seller
                await this.notificationsService.createNotification(
                    auction.sellerWallet,
                    'Auction Settle Success',
                    `Your auction for NFT ${auction.nftId} has been settled and ownership transferred.`,
                    NotificationType.SYSTEM_ALERT,
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
     * Fetch auction by NFT token ID.
     */
    async getAuctionByTokenId(tokenId: string): Promise<Auction | null> {
        try {
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) return null;

            return await this.auctionRepository.findOne({
                where: { nftId: nft.id, status: AuctionStatus.ACTIVE },
            });
        } catch (error) {
            console.error('getAuctionByTokenId error:', error);
            return null;
        }
    }

    /**
     * List all currently active auctions.
     */
    async getActiveAuctions(): Promise<any[]> {
        try {
            const cacheKey = 'auctions:active';
            const cached = await this.redisService.get<any[]>(cacheKey);
            if (cached) return cached;

            const auctions = await this.auctionRepository.find({
                where: { status: AuctionStatus.ACTIVE },
                relations: ['nft'],
                order: { endTime: 'ASC' },
            });

            // Add totalBids count for each auction
            const auctionsWithBidCount = await Promise.all(
                auctions.map(async (auction) => {
                    const totalBids = await this.bidRepository.count({
                        where: { auctionId: auction.id },
                    });
                    return {
                        ...auction,
                        totalBids,
                    };
                })
            );

            // Cache for 1 minute (feed updates frequently)
            await this.redisService.set(cacheKey, auctionsWithBidCount, 60);
            return auctionsWithBidCount;
        } catch (error) {
            console.error('getActiveAuctions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Update an auction (Draft only).
     */
    async updateAuction(id: string, userId: string, userRole: UserRole, dto: any): Promise<Auction> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id } });
            if (!auction) throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            if (userRole !== UserRole.ADMIN && auction.sellerId !== userId) throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            if (auction.status !== AuctionStatus.DRAFT) throw new BadRequestException('Only DRAFT auctions can be edited.');

            Object.assign(auction, dto);
            const savedAuction = await this.auctionRepository.save(auction);
            await this.redisService.del(`auction:${id}`);

            return savedAuction;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error;
            }
            console.error('updateAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Delete an auction (Draft only).
     */
    async deleteAuction(id: string, userId: string, userRole: UserRole): Promise<void> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id }, relations: ['nft'] });
            if (!auction) throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            if (userRole !== UserRole.ADMIN && auction.sellerId !== userId) throw new ForbiddenException(MESSAGES.CREATOR.NOT_OWNER);
            if (auction.status !== AuctionStatus.DRAFT) throw new BadRequestException('Only DRAFT auctions can be deleted.');

            const nft = auction.nft;
            await this.auctionRepository.remove(auction);

            // Re-list the NFT
            if (nft) {
                nft.is_listed = false;
                await this.nftRepository.save(nft);
            }

            await this.redisService.del(`auction:${id}`);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error;
            }
            console.error('deleteAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Handle on-chain AuctionCreated event.
     */
    async handleOnChainAuctionCreated(tokenId: string, seller: string, startingPrice: number, startTime: number, endTime: number) {
        try {
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) {
                console.warn(`NFT with token_id ${tokenId} not found during AuctionCreated event.`);
                return;
            }

            let auction = await this.auctionRepository.findOne({ where: { nftId: nft.id, status: AuctionStatus.DRAFT } });

            if (!auction) {
                // If no draft exists, create a new record (system sync)
                auction = this.auctionRepository.create({
                    nftId: nft.id,
                    sellerWallet: seller.toLowerCase(),
                    sellerId: 'SYSTEM', // Marked as system-created or we look up user by wallet
                    startPrice: startingPrice,
                    startTime: new Date(startTime * 1000),
                    endTime: new Date(endTime * 1000),
                    status: AuctionStatus.ACTIVE,
                    minBidIncrement: 0, // Default or fetch from config
                });
            } else {
                auction.status = AuctionStatus.ACTIVE;
                auction.startTime = new Date(startTime * 1000);
                auction.endTime = new Date(endTime * 1000);
                auction.startPrice = startingPrice;
            }

            await this.auctionRepository.save(auction);
            nft.is_listed = true;
            await this.nftRepository.save(nft);

            await this.redisService.del('auctions:active');

            // Broadcast real-time update
            this.websocketGateway.emitAuctionStatusChanged('auction_started', {
                auctionId: auction.id,
                status: AuctionStatus.ACTIVE,
            });

            // Notify Seller
            await this.notificationsService.createNotification(
                auction.sellerWallet,
                'Auction Live (On-Chain)',
                `Your on-chain auction for NFT ${nft.token_id} is now live!`,
                NotificationType.SYSTEM_ALERT,
            );

            console.log(`Successfully synced on-chain AuctionCreated for Token ${tokenId}`);
        } catch (error) {
            console.error(`handleOnChainAuctionCreated error for ${tokenId}:`, error);
        }
    }

    /**
     * Handle on-chain AuctionEnded event.
     */
    async handleOnChainAuctionEnd(tokenId: string, winner: string, amount: number) {
        try {
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) return;

            const auction = await this.auctionRepository.findOne({
                where: { nftId: nft.id, status: AuctionStatus.ACTIVE },
            });

            if (auction) {
                auction.status = AuctionStatus.ENDED;
                auction.endTime = new Date();
                auction.highest_bidder = winner.toLowerCase() === '0x0000000000000000000000000000000000000000' ? null : winner.toLowerCase();
                auction.highest_bid = amount;
                await this.auctionRepository.save(auction);

                nft.is_listed = false;
                await this.nftRepository.save(nft);

                await this.redisService.del(`auction:${auction.id}`);
                await this.redisService.del('auctions:active');

                // Broadcast real-time update
                this.websocketGateway.emitAuctionStatusChanged('auction_ended', {
                    auctionId: auction.id,
                    status: AuctionStatus.ENDED,
                });

                // Notify winner and seller
                if (auction.highest_bidder) {
                    await this.notificationsService.createNotification(
                        auction.highest_bidder,
                        'Auction Ended',
                        `You won the auction for Token ${tokenId}!`,
                        NotificationType.AUCTION_WON
                    );
                }

                await this.notificationsService.createNotification(
                    auction.sellerWallet,
                    'Auction Ended',
                    `The auction for Token ${tokenId} has ended.`,
                    NotificationType.AUCTION_ENDED
                );

                console.log(`Successfully synced on-chain AuctionEnded for Token ${tokenId}`);
            }
        } catch (error) {
            console.error(`handleOnChainAuctionEnd error for ${tokenId}:`, error);
        }
    }

    /**
     * Handle on-chain AuctionCanceled event.
     */
    async handleOnChainAuctionCanceled(tokenId: string) {
        try {
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) return;

            const auction = await this.auctionRepository.findOne({
                where: { nftId: nft.id, status: AuctionStatus.ACTIVE },
            });

            if (auction) {
                auction.status = AuctionStatus.CANCELLED;
                await this.auctionRepository.save(auction);

                nft.is_listed = false;
                await this.nftRepository.save(nft);

                await this.redisService.del(`auction:${auction.id}`);
                await this.redisService.del('auctions:active');

                // Broadcast real-time update
                this.websocketGateway.emitAuctionStatusChanged('auction_canceled', {
                    auctionId: auction.id,
                    status: AuctionStatus.CANCELLED,
                });

                await this.notificationsService.createNotification(
                    auction.sellerWallet,
                    'Auction Canceled',
                    `Your auction for Token ${tokenId} has been canceled.`,
                    NotificationType.SYSTEM_ALERT
                );

                console.log(`Successfully synced on-chain AuctionCanceled for Token ${tokenId}`);
            }
        } catch (error) {
            console.error(`handleOnChainAuctionCanceled error for ${tokenId}:`, error);
        }
    }
    /**
     * Dashboard: Statistics and Paginated List with search/filter.
     */
    async getAuctionsDashboard(query: GetAuctionsDto) {
        try {
            const { page = 1, limit = 10, search, status, startTime, endTime } = query;
            const skip = (page - 1) * limit;

            // 1. Calculate Stats (Global)
            const activeCount = await this.auctionRepository.count({ where: { status: AuctionStatus.ACTIVE } });
            const totalBids = await this.bidRepository.count();

            // Volume = sum of all winning bids (SETTLED or ENDED with winner)
            const volumeResult = await this.auctionRepository
                .createQueryBuilder('auction')
                .select('SUM(auction.highest_bid)', 'total')
                .where('auction.status IN (:...statuses)', { statuses: [AuctionStatus.SETTLED, AuctionStatus.ENDED] })
                .andWhere('auction.highest_bidder IS NOT NULL')
                .getRawOne();

            const totalVolume = parseFloat(volumeResult?.total || '0');

            // 2. Fetch Paginated & Filtered List
            const queryBuilder = this.auctionRepository.createQueryBuilder('auction')
                .leftJoinAndSelect('auction.nft', 'nft')
                .skip(skip)
                .take(limit)
                .orderBy('auction.created_at', 'DESC');

            if (status) {
                queryBuilder.andWhere('auction.status = :status', { status });
            }

            if (search) {
                queryBuilder.andWhere('(nft.name LIKE :search OR nft.token_id LIKE :search)', { search: `%${search}%` });
            }

            if (startTime) {
                queryBuilder.andWhere('auction.startTime >= :startTime', { startTime: new Date(startTime) });
            }

            if (endTime) {
                queryBuilder.andWhere('auction.endTime <= :endTime', { endTime: new Date(endTime) });
            }

            const [auctions, totalItems] = await queryBuilder.getManyAndCount();

            return {
                stats: {
                    activeAuctions: activeCount,
                    totalBids,
                    totalVolume,
                },
                list: {
                    data: auctions,
                    meta: {
                        totalItems,
                        itemCount: auctions.length,
                        itemsPerPage: limit,
                        totalPages: Math.ceil(totalItems / limit),
                        currentPage: page,
                    }
                }
            };
        } catch (error) {
            console.error('getAuctionsDashboard error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
