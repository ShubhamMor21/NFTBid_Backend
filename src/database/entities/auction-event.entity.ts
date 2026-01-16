import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuctionEventType {
    BID_PLACED = 'BID_PLACED',
    AUCTION_STARTED = 'AUCTION_STARTED',
    AUCTION_ENDED = 'AUCTION_ENDED',
}

@Entity('auction_events')
export class AuctionEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    auction_id: string;

    @Column({
        type: 'enum',
        enum: AuctionEventType,
    })
    event_type: AuctionEventType;

    @Column()
    tx_hash: string;

    @Column({ type: 'json' })
    payload: any;

    @CreateDateColumn()
    created_at: Date;
}
