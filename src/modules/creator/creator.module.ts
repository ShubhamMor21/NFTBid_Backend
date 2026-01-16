import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorService } from './creator.service';
import { CreatorController } from './creator.controller';
import { Nft } from '../../database/entities/nft.entity';
import { Auction } from '../../database/entities/auction.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Nft, Auction])],
    providers: [CreatorService],
    controllers: [CreatorController],
    exports: [CreatorService],
})
export class CreatorModule { }
