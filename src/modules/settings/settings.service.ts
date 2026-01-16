import { Injectable, OnModuleInit, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, SettingType } from '../../database/entities/setting.entity';
import { RedisService } from '../redis/redis.service';
import { MESSAGES } from '../../common/constants/messages';

@Injectable()
export class SettingsService implements OnModuleInit {
    private readonly logger = new Logger(SettingsService.name);
    private readonly CACHE_PREFIX = 'setting:';

    constructor(
        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,
        private readonly redisService: RedisService,
    ) { }

    async onModuleInit() {
        await this.ensureDefaultSettings();
    }

    /**
     * Get a setting value, with Redis caching.
     */
    async getSetting<T = any>(key: string): Promise<T | null> {
        try {
            const cacheKey = `${this.CACHE_PREFIX}${key}`;
            const cached = await this.redisService.get<string>(cacheKey);

            if (cached !== null) {
                return this.parseValue(cached, null) as T;
            }

            const setting = await this.settingRepository.findOne({ where: { key } });
            if (!setting) return null;

            await this.redisService.set(cacheKey, setting.value, 3600); // 1 hour cache
            return this.parseValue(setting.value, setting.type) as T;
        } catch (error) {
            this.logger.error(`Error getting setting ${key}:`, error);
            return null;
        }
    }

    /**
     * Update a setting.
     */
    async updateSetting(key: string, value: any): Promise<Setting> {
        try {
            const setting = await this.settingRepository.findOne({ where: { key } });
            if (!setting) throw new NotFoundException(`Setting ${key} not found.`);

            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            setting.value = stringValue;

            const updated = await this.settingRepository.save(setting);

            // Delete specific key using the DB key to ensure case consistency
            await this.redisService.del(`${this.CACHE_PREFIX}${setting.key}`);
            // Delete public settings cache
            await this.redisService.del(`${this.CACHE_PREFIX}public`);

            return updated;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error(`Error updating setting ${key}:`, error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Get all public settings for the frontend.
     */
    async getPublicSettings(): Promise<Record<string, any>> {
        const cacheKey = `${this.CACHE_PREFIX}public`;
        const cached = await this.redisService.get<Record<string, any>>(cacheKey);
        if (cached) return cached;

        const settings = await this.settingRepository.find({ where: { is_public: true } });
        const result = settings.reduce((acc, s) => {
            acc[s.key] = this.parseValue(s.value, s.type);
            return acc;
        }, {});

        await this.redisService.set(cacheKey, result, 3600);
        return result;
    }

    private parseValue(value: string, type: SettingType | null): any {
        if (!type) return value;
        switch (type) {
            case SettingType.NUMBER: return Number(value);
            case SettingType.BOOLEAN: return value === 'true';
            case SettingType.JSON:
                try { return JSON.parse(value); } catch { return value; }
            default: return value;
        }
    }

    /**
     * Initialize critical platform settings if they don't exist.
     */
    private async ensureDefaultSettings() {
        const defaults = [
            { key: 'PLATFORM_FEE_PERCENT', value: '2.5', type: SettingType.NUMBER, is_public: true, description: 'Percentage fee on successful sales.' },
            { key: 'MAINTENANCE_MODE', value: 'false', type: SettingType.BOOLEAN, is_public: true, description: 'Disable bidding and creation.' },
            { key: 'MIN_BID_INCREMENT_PERCENT', value: '5', type: SettingType.NUMBER, is_public: true, description: 'Default min bid increment %' },
            { key: 'SUPPORTED_CHAINS', value: JSON.stringify([1, 137, 11155111]), type: SettingType.JSON, is_public: true, description: 'List of chain IDs.' },
        ];

        for (const def of defaults) {
            const exists = await this.settingRepository.findOne({ where: { key: def.key } });
            if (!exists) {
                await this.settingRepository.save(this.settingRepository.create(def));
            }
        }
    }
}
