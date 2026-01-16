import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('auction_participants')
export class AuctionParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    auction_id: string;

    @Column()
    wallet_address: string;

    @Column({ type: 'decimal', precision: 18, scale: 8 })
    last_bid_amount: number;

    @CreateDateColumn()
    created_at: Date;
}
