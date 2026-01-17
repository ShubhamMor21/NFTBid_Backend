import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from './cron.service';
import { Auction } from '../../database/entities/auction.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { NftsModule } from '../nfts/nfts.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Auction]),
        ScheduleModule.forRoot(),
        WebsocketModule,
        NotificationsModule,
        AuctionsModule,
        NftsModule,
        TransactionsModule,
    ],
    providers: [CronService],
})
export class CronModule { }
