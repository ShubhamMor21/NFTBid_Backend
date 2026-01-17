import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TransactionType {
    BID = 'BID',
    AUCTION_CREATE = 'AUCTION_CREATE',
    AUCTION_SETTLE = 'AUCTION_SETTLE',
    AUCTION_CANCEL = 'AUCTION_CANCEL',
    AUCTION_END = 'AUCTION_END',
    MINT = 'MINT',
    REFUND = 'REFUND',
}

export enum TransactionStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    wallet_address: string;

    @Column({ unique: true })
    tx_hash: string;

    @Column({
        type: 'enum',
        enum: TransactionType,
    })
    type: TransactionType;

    @Column({
        type: 'enum',
        enum: TransactionStatus,
        default: TransactionStatus.PENDING,
    })
    status: TransactionStatus;

    @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
    amount: number;

    @Column({ type: 'int', default: 0 })
    chain_id: number;

    @Column({ type: 'json', nullable: true })
    metadata: any;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
