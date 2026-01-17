import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorService } from './creator.service';
import { CreatorController } from './creator.controller';
import { Nft } from '../../database/entities/nft.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Bid } from '../../database/entities/bid.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Nft, Auction, Wallet, Bid])],
    providers: [CreatorService],
    controllers: [CreatorController],
    exports: [CreatorService],
})
export class CreatorModule { }
