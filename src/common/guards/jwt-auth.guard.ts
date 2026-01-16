import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly redisService: RedisService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
            if (isBlacklisted) {
                throw new UnauthorizedException('Token is blacklisted (logged out)');
            }
        }

        return super.canActivate(context) as boolean;
    }
}
