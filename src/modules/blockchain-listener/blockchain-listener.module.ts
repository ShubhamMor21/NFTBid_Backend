import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainListenerService } from './blockchain-listener.service';
import { NftsModule } from '../nfts/nfts.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { BidsModule } from '../bid/bid.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
    imports: [
        ConfigModule,
        NftsModule,
        AuctionsModule,
        BidsModule,
        NotificationsModule,
        TransactionsModule,
    ],
    providers: [BlockchainListenerService],
    exports: [BlockchainListenerService],
})
export class BlockchainListenerModule { }
