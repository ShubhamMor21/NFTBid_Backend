import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Nft } from '../../database/entities/nft.entity';
import { Bid } from '../../database/entities/bid.entity';
import { Auction } from '../../database/entities/auction.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MESSAGES } from '../../common/constants/messages';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { RedisService } from '../redis/redis.service';
import { MyBidsQueryDto, BidStatus } from './dto/my-bids-query.dto';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        @InjectRepository(Bid)
        private readonly bidRepository: Repository<Bid>,
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        private readonly notificationsService: NotificationsService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Fetch current user's full profile including wallets.
     */
    async getMe(userId: string): Promise<User | any> {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId },
                relations: ['wallets'],
            });

            if (!user) {
                throw new NotFoundException(MESSAGES.USER.NOT_FOUND);
            }

            if (user.role === UserRole.ADMIN) {
                const totalNfts = await this.nftRepository.count({ where: { is_listed: true } });
                const totalBids = await this.bidRepository.count();
                const totalAuctions = await this.auctionRepository.count();

                return {
                    ...user,
                    totalNfts,
                    totalBids,
                    totalAuctions,
                };
            }

            return user;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('getMe error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Update user profile details.
     */
    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new NotFoundException(MESSAGES.USER.NOT_FOUND);
            }

            // Merge DTO into user
            Object.assign(user, dto);
            const savedUser = await this.userRepository.save(user);

            // Invalidate caches
            await this.redisService.del(`user:public:${userId}`);

            // Trigger notification
            const wallets = await this.walletRepository.find({ where: { userId } });
            if (wallets && wallets.length > 0) {
                await this.notificationsService.createNotification(
                    wallets[0].walletAddress,
                    'Profile Updated',
                    'Your profile information has been successfully updated.',
                    NotificationType.PROFILE_UPDATE,
                );
            }

            return savedUser;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('updateProfile error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List all wallets linked to the current user.
     */
    async getMyWallets(userId: string): Promise<Wallet[]> {
        try {
            return await this.walletRepository.find({
                where: { userId: userId },
                order: { isPrimary: 'DESC', createdAt: 'ASC' },
            });
        } catch (error) {
            console.error('getMyWallets error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Update a specific wallet's name.
     */
    async updateWalletName(userId: string, walletId: string, name: string): Promise<Wallet> {
        try {
            const wallet = await this.walletRepository.findOne({
                where: { id: walletId, userId },
            });

            if (!wallet) {
                throw new NotFoundException('Wallet not found.');
            }

            wallet.name = name;
            return await this.walletRepository.save(wallet);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('updateWalletName error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Set a wallet as the primary wallet for the user.
     */
    async setPrimaryWallet(userId: string, walletId: string): Promise<Wallet> {
        try {
            const wallet = await this.walletRepository.findOne({
                where: { id: walletId, userId },
            });

            if (!wallet) {
                throw new NotFoundException('Wallet not found.');
            }

            // Unset current primary wallet
            await this.walletRepository.update(
                { userId, isPrimary: true },
                { isPrimary: false },
            );

            // Set new primary wallet
            wallet.isPrimary = true;
            return await this.walletRepository.save(wallet);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('setPrimaryWallet error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Delete a specific wallet.
     */
    async deleteWallet(userId: string, walletId: string): Promise<void> {
        try {
            const wallet = await this.walletRepository.findOne({
                where: { id: walletId, userId },
            });

            if (!wallet) {
                throw new NotFoundException('Wallet not found.');
            }

            if (wallet.isPrimary) {
                throw new BadRequestException('Cannot delete the primary wallet. Please set another wallet as primary first.');
            }

            await this.walletRepository.remove(wallet);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
            console.error('deleteWallet error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * View public profile of another user.
     */
    async getPublicProfile(userId: string): Promise<any> {
        try {
            const cacheKey = `user:public:${userId}`;
            const cached = await this.redisService.get<any>(cacheKey);
            if (cached) return cached;

            const user = await this.userRepository.findOne({
                where: { id: userId },
                select: ['id', 'firstName', 'lastName', 'bio', 'profileImage', 'createdAt'],
            });

            if (!user) {
                throw new NotFoundException(MESSAGES.USER.NOT_FOUND);
            }

            // Cache for 15 minutes
            await this.redisService.set(cacheKey, user, 900);
            return user;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('getPublicProfile error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Logic to block/unblock a user (Access Control).
     */
    async toggleBlockStatus(userId: string, status: boolean): Promise<User> {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new NotFoundException(MESSAGES.USER.NOT_FOUND);
            }

            user.isActive = !status; // if status=true (block), isActive=false
            return await this.userRepository.save(user);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('toggleBlockStatus error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Get all bids placed by the user with filtering and pagination.
     */
    async getMyBids(userId: string, queryDto: MyBidsQueryDto): Promise<{ items: any[]; total: number; page: number; limit: number; activeBids: number; winningBids: number; outbidBids: number }> {
        try {
            const { page = 1, limit = 10, status } = queryDto;
            const skip = (page - 1) * limit;

            const query = this.bidRepository.createQueryBuilder('bid')
                .leftJoinAndSelect('bid.auction', 'auction')
                .leftJoinAndSelect('auction.nft', 'nft')
                .where('bid.bidderId = :userId', { userId });

            // Apply status filter
            if (status) {
                switch (status) {
                    case BidStatus.ACTIVE:
                        query.andWhere('auction.status = :status', { status: AuctionStatus.ACTIVE });
                        break;
                    case BidStatus.WINNING:
                        query.andWhere('auction.status = :status', { status: AuctionStatus.ACTIVE })
                            .andWhere('auction.highest_bidder = bid.bidderWallet');
                        break;
                    case BidStatus.OUTBID:
                        query.andWhere('auction.status = :status', { status: AuctionStatus.ACTIVE })
                            .andWhere('auction.highest_bidder != bid.bidderWallet');
                        break;
                    case BidStatus.WON:
                        query.andWhere('auction.status = :status', { status: AuctionStatus.SETTLED })
                            .andWhere('auction.highest_bidder = bid.bidderWallet');
                        break;
                    case BidStatus.LOST:
                        query.andWhere('auction.status IN (:...statuses)', { statuses: [AuctionStatus.SETTLED, AuctionStatus.ENDED] })
                            .andWhere('auction.highest_bidder != bid.bidderWallet');
                        break;
                    case BidStatus.SETTLED:
                        query.andWhere('auction.status = :status', { status: AuctionStatus.SETTLED });
                        break;
                }
            }

            const total = await query.getCount();
            const bids = await query
                .orderBy('bid.createdAt', 'DESC')
                .skip(skip)
                .take(limit)
                .getMany();

            // Map to include computed status
            const items = bids.map(bid => ({
                ...bid,
                computedStatus: this.computeBidStatus(bid, bid.auction),
            }));

            // Compute summary counts (always fetch all bids for counts, regardless of filters)
            const allBidsQuery = this.bidRepository.createQueryBuilder('bid')
                .leftJoinAndSelect('bid.auction', 'auction')
                .where('bid.bidderId = :userId', { userId });

            const allBids = await allBidsQuery.getMany();

            const activeBids = allBids.filter(bid => bid.auction?.status === AuctionStatus.ACTIVE).length;
            const winningBids = allBids.filter(bid =>
                bid.auction?.status === AuctionStatus.ACTIVE &&
                bid.auction?.highest_bidder?.toLowerCase() === bid.bidderWallet?.toLowerCase()
            ).length;
            const outbidBids = allBids.filter(bid =>
                bid.auction?.status === AuctionStatus.ACTIVE &&
                bid.auction?.highest_bidder?.toLowerCase() !== bid.bidderWallet?.toLowerCase()
            ).length;

            return { items, total, page, limit, activeBids, winningBids, outbidBids };
        } catch (error) {
            console.error('getMyBids error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Helper to compute bid status.
     */
    private computeBidStatus(bid: Bid, auction: Auction): BidStatus {
        if (auction.status === AuctionStatus.ACTIVE) {
            return auction.highest_bidder?.toLowerCase() === bid.bidderWallet?.toLowerCase()
                ? BidStatus.WINNING
                : BidStatus.OUTBID;
        }
        if (auction.status === AuctionStatus.SETTLED) {
            return auction.highest_bidder?.toLowerCase() === bid.bidderWallet?.toLowerCase()
                ? BidStatus.WON
                : BidStatus.LOST;
        }
        if (auction.status === AuctionStatus.ENDED) {
            return auction.highest_bidder?.toLowerCase() === bid.bidderWallet?.toLowerCase()
                ? BidStatus.WON
                : BidStatus.LOST;
        }
        return BidStatus.LOST;
    }
}
