import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Auction } from '../../database/entities/auction.entity';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { AuctionsGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';

import { AuctionsService } from '../auctions/auctions.service';
import { TransactionType, TransactionStatus } from '../../database/entities/transaction.entity';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        private readonly websocketGateway: AuctionsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly auctionsService: AuctionsService,
        private readonly transactionsService: TransactionsService,
    ) { }

    /**
     * Run every 30 seconds to manage auction transitions.
     */
    @Cron('*/30 * * * * *')
    async processAuctionTransitions() {
        this.logger.log('Running cron: processAuctionTransitions');
        try {
            const now = new Date();

            // 1. DRAFT -> ACTIVE (Auto-Start)
            const auctionsToStart = await this.auctionRepository.find({
                where: {
                    status: AuctionStatus.DRAFT,
                    startTime: LessThanOrEqual(now),
                },
                relations: ['nft'],
            });

            for (const auction of auctionsToStart) {
                this.logger.log(`Auto-starting auction: ${auction.id}`);
                auction.status = AuctionStatus.ACTIVE;
                await this.auctionRepository.save(auction);

                // Update NFT listed status
                if (auction.nft) {
                    auction.nft.is_listed = true;
                    await this.auctionRepository.manager.save(auction.nft);
                }

                // Invalidate relevant caches
                // (Assuming service has access to these or just let service handle it)
                // However, since we are in CronService, we manually trigger broadcasts

                this.websocketGateway.emitAuctionStatusChanged('auction_started', {
                    auctionId: auction.id,
                    status: AuctionStatus.ACTIVE,
                });

                // Record Transaction for auto-start
                await this.transactionsService.createTransaction(
                    `start-${auction.id}-${Date.now()}`,
                    auction.sellerWallet,
                    TransactionType.AUCTION_CREATE,
                    0,
                    { tokenId: auction.nft?.token_id, auctionId: auction.id, event: 'AUTO_START' }
                );

                await this.notificationsService.createNotification(
                    auction.sellerWallet,
                    'Auction Live',
                    `Your auction for NFT ${auction.nftId} is now live!`,
                    NotificationType.SYSTEM_ALERT,
                );
            }

            // 2. ACTIVE -> ENDED (Auto-End)
            const expiredAuctions = await this.auctionRepository.find({
                where: {
                    status: AuctionStatus.ACTIVE,
                    endTime: LessThanOrEqual(now),
                },
                relations: ['nft'],
            });

            for (const auction of expiredAuctions) {
                this.logger.log(`Auto-ending auction: ${auction.id}`);

                // We use AuctionsService.handleOnChainAuctionEnd to ensure consistency
                // (It handles status change, nft update, cache invalidation, and notifications)
                // If it's on-chain, we might not have a winner yet from blockchain, 
                // but this logic closes it locally if the timer expires.

                await this.auctionsService.handleOnChainAuctionEnd(
                    auction.nft?.token_id || '',
                    auction.highest_bidder || '0x0000000000000000000000000000000000000000',
                    auction.highest_bid || 0
                );

                // Record Transaction for auto-end
                await this.transactionsService.createTransaction(
                    `end-${auction.id}-${Date.now()}`,
                    auction.sellerWallet,
                    TransactionType.AUCTION_END,
                    auction.highest_bid || 0,
                    {
                        tokenId: auction.nft?.token_id,
                        auctionId: auction.id,
                        winner: auction.highest_bidder,
                        event: 'AUTO_END'
                    }
                );
            }
        } catch (error) {
            this.logger.error('Error in processAuctionTransitions cron:', error);
        }
    }
}
