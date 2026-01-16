import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { MESSAGES } from '../../common/constants/messages';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { Bid } from '../../database/entities/bid.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { AdminAuctionsQueryDto } from './dto/admin-auctions-query.dto';
import { Report, ReportStatus } from '../../database/entities/report.entity';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        @InjectRepository(Bid)
        private readonly bidRepository: Repository<Bid>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
        @InjectRepository(ActivityLog)
        private readonly logRepository: Repository<ActivityLog>,
        private readonly notificationsService: NotificationsService,
    ) { }

    /**
     * List all users for moderation with aggregated data, pagination, and filtering.
     */
    async getAllUsers(queryDto: AdminUserQueryDto): Promise<{ items: any[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, search, role } = queryDto;
            const skip = (page - 1) * limit;

            const query = this.userRepository.createQueryBuilder('user')
                .select([
                    'user.id',
                    'user.email',
                    'user.firstName',
                    'user.lastName',
                    'user.role',
                    'user.isActive',
                    'user.createdAt'
                ])
                .addSelect((subQuery) => {
                    return subQuery
                        .select('COUNT(bid.id)', 'bidCount')
                        .from(Bid, 'bid')
                        .where('bid.bidderId = user.id');
                }, 'totalBids')
                .addSelect((subQuery) => {
                    return subQuery
                        .select('COUNT(nft.id)', 'nftCount')
                        .from(Nft, 'nft')
                        .where('nft.current_owner_wallet IN ' +
                            subQuery.subQuery()
                                .select('w.walletAddress')
                                .from(Wallet, 'w')
                                .where('w.userId = user.id')
                                .getQuery()
                        );
                }, 'totalNfts')
                .where('user.role != :adminRole', { adminRole: UserRole.ADMIN });

            if (search) {
                query.andWhere(
                    '(user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
                    { search: `%${search}%` }
                );
            }

            if (role) {
                query.andWhere('user.role = :role', { role });
            }

            const total = await query.getCount();

            const rawResults = await query
                .orderBy('user.createdAt', 'DESC')
                .limit(limit)
                .offset(skip)
                .getRawMany();

            const items = rawResults.map(item => ({
                id: item.user_id,
                email: item.user_email,
                firstName: item.user_firstName,
                lastName: item.user_lastName,
                role: item.user_role as UserRole,
                isActive: !!item.user_isActive,
                createdAt: item.user_createdAt,
                totalBids: parseInt(item.totalBids) || 0,
                totalNfts: parseInt(item.totalNfts) || 0,
            }));

            return {
                items,
                total,
                page,
                limit
            };
        } catch (error) {
            console.error('getAllUsers error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Ban a user.
     */
    async banUser(userId: string, reason: string, adminId: string, adminName: string): Promise<User> {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            if (!user) throw new NotFoundException('User not found.');

            user.isActive = false;
            user.bannedAt = new Date();
            user.banReason = reason;

            const savedUser = await this.userRepository.save(user);

            // Send notification
            if (user.wallets && user.wallets.length > 0) {
                await this.notificationsService.createNotification(
                    user.wallets[0].walletAddress,
                    'Account Suspended',
                    `Your account has been suspended. Reason: ${reason}`,
                    NotificationType.AUCTION_ENDED, // Generic type for now
                );
            }

            await this.logActivity(adminId, adminName, 'BANNED_USER', `User ${user.email}`);

            return savedUser;
        } catch (error) {
            console.error('banUser error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Unban a user.
     */
    async unbanUser(userId: string, reason: string, adminId: string, adminName: string): Promise<User> {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['wallets'] });
            if (!user) throw new NotFoundException('User not found.');

            user.isActive = true;
            user.bannedAt = null;
            user.banReason = null;

            const savedUser = await this.userRepository.save(user);

            if (user.wallets && user.wallets.length > 0) {
                await this.notificationsService.createNotification(
                    user.wallets[0].walletAddress,
                    'Account Restored',
                    `Your account has been restored. Reason: ${reason}`,
                    NotificationType.PROFILE_UPDATE, // Generic type for now
                );
            }

            await this.logActivity(adminId, adminName, 'UNBANNED_USER', `User ${user.email}`);

            return savedUser;
        } catch (error) {
            console.error('unbanUser error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Get banned users.
     */
    async getBannedUsers(page: number = 1, limit: number = 10, search?: string): Promise<{ items: User[]; total: number }> {
        try {
            const query = this.userRepository.createQueryBuilder('user')
                .where('user.isActive = :isActive', { isActive: false })
                .andWhere('user.bannedAt IS NOT NULL');

            if (search) {
                query.andWhere(
                    '(user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
                    { search: `%${search}%` }
                );
            }

            const total = await query.getCount();
            const items = await query
                .orderBy('user.bannedAt', 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            return { items, total };
        } catch (error) {
            console.error('getBannedUsers error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List all auctions for moderation.
     */
    async getAllAuctions(queryDto: AdminAuctionsQueryDto): Promise<{ items: Auction[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, search, status } = queryDto;
            const skip = (page - 1) * limit;

            const query = this.auctionRepository.createQueryBuilder('auction')
                .leftJoinAndSelect('auction.nft', 'nft');

            if (status) {
                query.andWhere('auction.status = :status', { status });
            }

            if (search) {
                query.andWhere(
                    '(nft.token_id LIKE :search OR auction.sellerWallet LIKE :search)',
                    { search: `%${search}%` }
                );
            }

            const total = await query.getCount();
            const items = await query
                .orderBy('auction.created_at', 'DESC')
                .skip(skip)
                .take(limit)
                .getMany();

            return {
                items,
                total,
                page,
                limit
            };
        } catch (error) {
            console.error('getAllAuctions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Delete or cancel an auction (Moderation).
     */
    async deleteAuction(auctionId: string): Promise<void> {
        try {
            const auction = await this.auctionRepository.findOne({ where: { id: auctionId }, relations: ['nft'] });
            if (!auction) {
                throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            }

            const sellerWallet = auction.sellerWallet;
            const sellerId = auction.sellerId;

            // Unlist NFT if it was listed
            if (auction.nft) {
                auction.nft.is_listed = false;
                await this.nftRepository.save(auction.nft);
            }

            await this.auctionRepository.remove(auction);

            // Log activity
            // Assuming we have adminId from request context, but for now passing 'System' or we need to update signature
            // This method signature update might be needed if we want to log *who* deleted it. 
            // For now, let's keep it simple or assume we'll fix the controller to pass admin info later.

            // Notify seller
            await this.notificationsService.createNotification(
                sellerWallet,
                'Auction Removed',
                'Your auction has been removed by an administrator for moderation reasons.',
                NotificationType.AUCTION_ENDED,
            );

        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('deleteAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List all reports.
     */
    async getAllReports(queryDto: AdminReportsQueryDto): Promise<{ items: Report[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, status, type } = queryDto;
            const skip = (page - 1) * limit;

            const query = this.reportRepository.createQueryBuilder('report')
                .leftJoinAndSelect('report.reporter', 'reporter');

            if (status) {
                query.andWhere('report.status = :status', { status });
            }

            if (type) {
                query.andWhere('report.type = :type', { type });
            }

            const total = await query.getCount();
            const items = await query
                .orderBy('report.createdAt', 'DESC')
                .skip(skip)
                .take(limit)
                .getMany();

            return {
                items,
                total,
                page,
                limit
            };
        } catch (error) {
            console.error('getAllReports error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Resolve a report (Take action).
     */
    async resolveReport(id: string, adminId: string, adminName: string): Promise<Report> {
        try {
            const report = await this.reportRepository.findOne({ where: { id } });
            if (!report) throw new NotFoundException('Report not found');

            report.status = ReportStatus.RESOLVED;
            const savedReport = await this.reportRepository.save(report);

            await this.logActivity(adminId, adminName, 'RESOLVED_REPORT', `Report ${id}`);

            return savedReport;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('resolveReport error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Dismiss a report.
     */
    async dismissReport(id: string, adminId: string, adminName: string): Promise<Report> {
        try {
            const report = await this.reportRepository.findOne({ where: { id } });
            if (!report) throw new NotFoundException('Report not found');

            report.status = ReportStatus.DISMISSED;
            const savedReport = await this.reportRepository.save(report);

            await this.logActivity(adminId, adminName, 'DISMISSED_REPORT', `Report ${id}`);

            return savedReport;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('dismissReport error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Log an admin activity.
     */
    async logActivity(adminId: string, adminName: string, action: string, target?: string): Promise<void> {
        try {
            const log = this.logRepository.create({
                adminId,
                adminName,
                action,
                target,
            });
            await this.logRepository.save(log);
        } catch (error) {
            console.error('logActivity error:', error);
            // Don't throw, just log error so main flow isn't interrupted
        }
    }

    /**
     * Get activity logs.
     */
    async getActivityLogs(page: number = 1, limit: number = 20): Promise<{ items: ActivityLog[]; total: number }> {
        try {
            const [items, total] = await this.logRepository.findAndCount({
                order: { timestamp: 'DESC' },
                skip: (page - 1) * limit,
                take: limit,
            });
            return { items, total };
        } catch (error) {
            console.error('getActivityLogs error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
