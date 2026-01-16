import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SettingType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    JSON = 'json',
}

@Entity('settings')
export class Setting {
    @PrimaryColumn()
    key: string;

    @Column({ type: 'text' })
    value: string;

    @Column({
        type: 'enum',
        enum: SettingType,
        default: SettingType.STRING,
    })
    type: SettingType;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: true })
    is_public: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
