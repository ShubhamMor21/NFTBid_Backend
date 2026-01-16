import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Auction, Nft]),
        WebsocketModule,
        NotificationsModule,
    ],
    providers: [AuctionsService],
    controllers: [AuctionsController],
    exports: [AuctionsService],
})
export class AuctionsModule { }
