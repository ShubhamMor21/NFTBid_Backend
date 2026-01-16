import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum ReportType {
    NFT = 'NFT',
    USER = 'USER',
}

export enum ReportStatus {
    PENDING = 'PENDING',
    RESOLVED = 'RESOLVED',
    DISMISSED = 'DISMISSED',
}

@Entity('reports')
export class Report {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: ReportType,
    })
    type: ReportType;

    @Column()
    targetId: string;

    @Column()
    targetName: string;

    @Column({ type: 'text' })
    reason: string;

    @Column()
    reporterId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'reporterId' })
    reporter: User;

    @Column({
        type: 'enum',
        enum: ReportStatus,
        default: ReportStatus.PENDING,
    })
    status: ReportStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
