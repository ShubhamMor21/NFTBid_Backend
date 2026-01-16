import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Nft } from '../../database/entities/nft.entity';
import { Bid } from '../../database/entities/bid.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Report } from '../../database/entities/report.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Wallet, Nft, Bid, Auction, Report, ActivityLog])],
    providers: [UsersService],
    controllers: [UsersController],
    exports: [UsersService],
})
export class UsersModule { }
