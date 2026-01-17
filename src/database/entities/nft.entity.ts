import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, DeleteDateColumn } from 'typeorm';
import { Auction } from './auction.entity';

@Entity('nfts')
export class Nft {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    token_id: string;

    @Column()
    contract_address: string;

    @Column({ type: 'int', nullable: true })
    chain_id: number;

    @Column({ nullable: true })
    creator_wallet: string;

    @Column({ nullable: true })
    current_owner_wallet: string;

    @Column({ type: 'text', nullable: true })
    metadata_url: string;

    @Column({ nullable: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    image_url: string;

    @Column({ default: false })
    is_listed: boolean;

    @OneToMany(() => Auction, (auction) => auction.nft)
    auctions: Auction[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @DeleteDateColumn()
    deleted_at: Date;
}
