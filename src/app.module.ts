import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './modules/redis/redis.module';
import { RabbitMqModule } from './modules/rabbitmq/rabbitmq.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CreatorModule } from './modules/creator/creator.module';
import { NftsModule } from './modules/nfts/nfts.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuctionsModule } from './modules/auctions/auctions.module';
import { BidsModule } from './modules/bid/bid.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { CronModule } from './modules/cron/cron.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { BlockchainListenerModule } from './modules/blockchain-listener/blockchain-listener.module';
import { FileModule } from './modules/files/file.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    DatabaseModule,
    RedisModule,
    // RabbitMqModule,
    // WebsocketModule,
    AuthModule,
    UsersModule,
    CreatorModule,
    NftsModule,
    AdminModule,
    AuctionsModule,
    BidsModule,
    NotificationsModule,
    TransactionsModule,
    CronModule,
    BlockchainListenerModule,
    FileModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
