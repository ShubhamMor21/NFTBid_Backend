import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Auction } from '../../database/entities/auction.entity';
import { AuctionStatus } from '../../common/enums/auction-status.enum';
import { AuctionsGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
        private readonly websocketGateway: AuctionsGateway,
        private readonly notificationsService: NotificationsService,
    ) { }

    /**
     * Run every 30 seconds to close expired auctions.
     */
    // @Cron('*/30 * * * * *')
    // async closeExpiredAuctions() {
    //     this.logger.log('Running cron: closeExpiredAuctions');
    //     try {
    //         const now = new Date();
    //         // Find ACTIVE auctions that should have ended
    //         const expiredAuctions = await this.auctionRepository.find({
    //             where: {
    //                 status: AuctionStatus.ACTIVE,
    //                 endTime: LessThanOrEqual(now),
    //             },
    //             relations: ['nft'],
    //         });

    //         for (const auction of expiredAuctions) {
    //             this.logger.log(`Closing auction: ${auction.id}`);
    //             auction.status = AuctionStatus.ENDED;
    //             await this.auctionRepository.save(auction);

    //             // Notify via WebSocket
    //             this.websocketGateway.emitAuctionStatusChanged('auction_ended', {
    //                 auctionId: auction.id,
    //                 status: AuctionStatus.ENDED,
    //             });

    //             // Notify Seller
    //             await this.notificationsService.createNotification(
    //                 auction.sellerWallet,
    //                 'Auction Ended',
    //                 `Your auction for NFT ${auction.nftId} has ended.`,
    //                 NotificationType.AUCTION_ENDED,
    //             );

    //             // Notify Winner if exists
    //             if (auction.highest_bidder) {
    //                 // In a real app we'd need to map wallet to userId or just use wallet
    //                 // For now let's assume we notify the winner if we can find them
    //                 // This is a simplified version
    //             }
    //         }
    //     } catch (error) {
    //         this.logger.error('Error in closeExpiredAuctions cron:', error);
    //     }
    // }
}
