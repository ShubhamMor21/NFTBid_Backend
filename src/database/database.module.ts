import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { Wallet } from './entities/wallet.entity';
import { Nft } from './entities/nft.entity';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { AuctionParticipant } from './entities/auction-participant.entity';
import { Transaction } from './entities/transaction.entity';
import { AuctionEvent } from './entities/auction-event.entity';
import { Notification } from './entities/notification.entity';
import { Setting } from './entities/setting.entity';
import { Report } from './entities/report.entity';
import { ActivityLog } from './entities/activity-log.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'mysql',
                url: configService.get<string>('database.url'),
                host: configService.get<string>('database.host'),
                port: configService.get<number>('database.port'),
                username: configService.get<string>('database.username'),
                password: configService.get<string>('database.password'),
                database: configService.get<string>('database.database'),
                entities: [
                    User,
                    Wallet,
                    Nft,
                    Auction,
                    Bid,
                    AuctionParticipant,
                    Transaction,
                    AuctionEvent,
                    Notification,
                    Setting,
                    Report,
                    ActivityLog,
                ],
                synchronize: process.env.NODE_ENV !== 'production',
            }),
            inject: [ConfigService],
        }),
    ],
})
export class DatabaseModule { }
