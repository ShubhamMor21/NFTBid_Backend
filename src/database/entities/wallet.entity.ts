import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    walletAddress: string;

    @Column({ default: 'My Wallet' })
    name: string;

    @Column({ default: false })
    isPrimary: boolean;

    @Column({ nullable: true })
    nonce: string;

    @Column({ default: false })
    is_blocked: boolean;

    @ManyToOne(() => User, (user) => user.wallets)
    user: User;

    @Column()
    userId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
