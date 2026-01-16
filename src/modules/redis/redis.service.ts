import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) { }

    /**
     * Set a value in Redis with an optional TTL (in seconds).
     */
    async set(key: string, value: any, ttl?: number): Promise<void> {
        try {
            const strValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (ttl) {
                await this.redis.setex(key, ttl, strValue);
            } else {
                await this.redis.set(key, strValue);
            }
        } catch (error) {
            this.logger.error(`Error setting key ${key} in Redis`, error);
        }
    }

    /**
     * Get a value from Redis.
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.redis.get(key);
            if (!value) return null;

            try {
                return JSON.parse(value) as T;
            } catch {
                return value as unknown as T;
            }
        } catch (error) {
            this.logger.error(`Error getting key ${key} from Redis`, error);
            return null;
        }
    }

    /**
     * Delete a key from Redis.
     */
    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            this.logger.error(`Error deleting key ${key} from Redis`, error);
        }
    }

    /**
     * Clear keys by pattern (e.g. 'auction:*').
     */
    async clearPattern(pattern: string): Promise<void> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            this.logger.error(`Error clearing pattern ${pattern} in Redis`, error);
        }
    }
}
