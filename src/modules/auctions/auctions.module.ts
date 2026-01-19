import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionsService } from './auctions.service';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { Bid } from '../../database/entities/bid.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuctionsController } from './auctions.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Auction, Nft, Bid]),
        WebsocketModule,
        NotificationsModule,
    ],
    providers: [AuctionsService],
    controllers: [AuctionsController],
    exports: [AuctionsService],
})
export class AuctionsModule { }
