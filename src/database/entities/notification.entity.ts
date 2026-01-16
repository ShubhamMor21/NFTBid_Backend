import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum NotificationType {
    OUTBID = 'OUTBID',
    AUCTION_WON = 'AUCTION_WON',
    AUCTION_ENDED = 'AUCTION_ENDED',
    LOGIN = 'LOGIN',
    PROFILE_UPDATE = 'PROFILE_UPDATE',
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    wallet_address: string;

    @Column({
        type: 'enum',
        enum: NotificationType,
    })
    type: NotificationType;

    @Column({ type: 'text' })
    message: string;

    @Column({ default: false })
    is_read: boolean;

    @CreateDateColumn()
    created_at: Date;
}
