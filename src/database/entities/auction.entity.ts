import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Nft } from './nft.entity';
import { Bid } from './bid.entity';
import { AuctionStatus } from '../../common/enums/auction-status.enum';

@Entity('auctions')
export class Auction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Nft, (nft) => nft.auctions)
    nft: Nft;

    @Column()
    nftId: string;

    @Column()
    sellerWallet: string;

    @Column()
    sellerId: string;

    @Column({ type: 'decimal', precision: 18, scale: 8 })
    startPrice: number;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
    reservePrice: number;

    @Column({ type: 'decimal', precision: 18, scale: 8 })
    minBidIncrement: number;

    @Column({ type: 'timestamp' })
    startTime: Date;

    @Column({ type: 'timestamp' })
    endTime: Date;

    @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
    highest_bid: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    highest_bidder: string | null;

    @Column({
        type: 'enum',
        enum: AuctionStatus,
        default: AuctionStatus.DRAFT,
    })
    status: AuctionStatus;

    @Column({ nullable: true })
    auction_tx_hash: string;

    @OneToMany(() => Bid, (bid) => bid.auction)
    bids: Bid[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
