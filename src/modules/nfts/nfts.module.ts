import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftsService } from './nfts.service';
import { NftsController } from './nfts.controller';
import { Nft } from '../../database/entities/nft.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Nft])],
    providers: [NftsService],
    controllers: [NftsController],
    exports: [NftsService],
})
export class NftsModule { }
