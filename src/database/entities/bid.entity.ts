import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Auction } from './auction.entity';

@Entity('bids')
export class Bid {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Auction, (auction) => auction.bids)
    auction: Auction;

    @Column()
    auctionId: string;

    @Column()
    bidderId: string;

    @Column()
    bidderWallet: string;

    @Column({ type: 'decimal', precision: 18, scale: 8 })
    bidAmount: number;

    @Column({ nullable: true })
    tx_hash: string;

    @Column({ default: true })
    is_valid: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
