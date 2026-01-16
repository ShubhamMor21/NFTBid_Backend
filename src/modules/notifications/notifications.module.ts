import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Notification, User, Wallet])],
    providers: [NotificationsService, MailService],
    controllers: [NotificationsController],
    exports: [NotificationsService, MailService],
})
export class NotificationsModule { }
