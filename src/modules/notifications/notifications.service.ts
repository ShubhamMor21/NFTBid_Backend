import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { MESSAGES } from '../../common/constants/messages';
import { MailService } from './mail.service';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        private readonly mailService: MailService,
    ) { }

    /**
     * Create a notification for a user and send an email alert.
     */
    async createNotification(walletAddress: string, title: string, message: string, type: NotificationType) {
        try {
            // 1. Save in-app notification
            const notification = this.notificationRepository.create({
                wallet_address: walletAddress.toLowerCase(),
                type,
                message,
                is_read: false,
            });
            const savedNotification = await this.notificationRepository.save(notification);

            // 2. Trigger Email via SendGrid
            const wallet = await this.walletRepository.findOne({
                where: { walletAddress: walletAddress.toLowerCase() },
                relations: ['user']
            });

            if (wallet && wallet.user && wallet.user.email) {
                await this.mailService.sendEmail(
                    wallet.user.email,
                    title,
                    message,
                );
            }

            return savedNotification;
        } catch (error) {
            this.logger.error('createNotification error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Fetch all notifications for a user (across all linked wallets).
     */
    async getMyNotifications(userId: string): Promise<Notification[]> {
        try {
            // 1. Find all wallets for this user
            const wallets = await this.walletRepository.find({
                where: { userId: userId },
                select: ['walletAddress'],
            });

            if (!wallets || wallets.length === 0) {
                return [];
            }

            const walletAddresses = wallets.map(w => w.walletAddress.toLowerCase());

            // 2. Find notifications for these wallets (only unread)
            return await this.notificationRepository.createQueryBuilder('notification')
                .where('LOWER(notification.wallet_address) IN (:...walletAddresses)', { walletAddresses })
                .andWhere('notification.is_read = :isRead', { isRead: false })
                .orderBy('notification.created_at', 'DESC')
                .getMany();
        } catch (error) {
            this.logger.error('getMyNotifications error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }


    /**
     * Mark as read.
     */
    async markAsRead(id: string) {
        try {
            const notification = await this.notificationRepository.findOne({ where: { id } });
            if (!notification) throw new NotFoundException('Notification not found.');
            notification.is_read = true;
            return await this.notificationRepository.save(notification);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error('markAsRead error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Mark all notifications as read for a user.
     */
    async markAllAsRead(userId: string): Promise<{ updated: number }> {
        try {
            // Get all wallet addresses for this user
            const wallets = await this.walletRepository.find({
                where: { userId },
                select: ['walletAddress'],
            });

            if (!wallets || wallets.length === 0) {
                return { updated: 0 };
            }

            const walletAddresses = wallets.map(w => w.walletAddress.toLowerCase());

            // Update all unread notifications for these wallets
            const result = await this.notificationRepository
                .createQueryBuilder()
                .update(Notification)
                .set({ is_read: true })
                .where('LOWER(wallet_address) IN (:...wallets)', { wallets: walletAddresses })
                .andWhere('is_read = :isRead', { isRead: false })
                .execute();

            return { updated: result.affected || 0 };
        } catch (error) {
            this.logger.error('markAllAsRead error:', error);
            throw new InternalServerErrorException('Failed to mark all notifications as read');
        }
    }
}
