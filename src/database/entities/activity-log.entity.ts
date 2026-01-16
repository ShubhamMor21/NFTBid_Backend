import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    adminId: string;

    @Column()
    adminName: string;

    @Column()
    action: string;

    @Column({ nullable: true })
    target: string;

    @CreateDateColumn()
    timestamp: Date;
}
