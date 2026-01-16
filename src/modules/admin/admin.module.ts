import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../../database/entities/user.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Nft } from '../../database/entities/nft.entity';
import { Bid } from '../../database/entities/bid.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Report } from '../../database/entities/report.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Auction, Nft, Bid, Wallet, Report, ActivityLog]),
        NotificationsModule,
    ],
    providers: [AdminService],
    controllers: [AdminController],
    exports: [AdminService],
})
export class AdminModule { }
