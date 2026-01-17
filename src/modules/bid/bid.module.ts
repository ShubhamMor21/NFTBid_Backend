import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidsService } from './bid.service';
import { BidsController } from './bid.controller';
import { Bid } from '../../database/entities/bid.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Bid, Auction, Nft, User, Wallet]),
        WebsocketModule,
        NotificationsModule,
    ],
    providers: [BidsService],
    controllers: [BidsController],
    exports: [BidsService],
})
export class BidsModule { }
