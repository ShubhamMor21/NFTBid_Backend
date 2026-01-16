import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from './cron.service';
import { Auction } from '../../database/entities/auction.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Auction]),
        ScheduleModule.forRoot(),
        WebsocketModule,
        NotificationsModule,
    ],
    providers: [CronService],
})
export class CronModule { }
