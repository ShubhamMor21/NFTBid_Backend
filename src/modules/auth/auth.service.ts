import { Injectable, UnauthorizedException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { verifyMessage } from 'ethers';
import { Wallet } from '../../database/entities/wallet.entity';
import { User } from '../../database/entities/user.entity';
import { MESSAGES } from '../../common/constants/messages';
import { SignupDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Wallet)
        private walletRepository: Repository<Wallet>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
        private notificationsService: NotificationsService,
        private redisService: RedisService,
    ) { }

    /**
     * Logout user by blacklisting the token.
     */
    async logout(token: string): Promise<void> {
        try {
            const decoded: any = this.jwtService.decode(token);
            if (!decoded || !decoded.exp) {
                // If token is invalid or has no exp, just return
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const ttl = decoded.exp - now;

            if (ttl > 0) {
                // Store in Redis with TTL
                await this.redisService.set(`blacklist:${token}`, 'true', ttl);
            }
        } catch (error) {
            console.error('Logout error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Register a new user with email and password.
     */
    async signup(dto: SignupDto): Promise<User> {
        try {
            const existingUser = await this.userRepository.findOne({ where: { email: dto.email } });
            if (existingUser) {
                throw new ConflictException(MESSAGES.AUTH.USER_EXISTS);
            }

            const hashedPassword = await bcrypt.hash(dto.password, 10);
            const user = this.userRepository.create({
                ...dto,
                password: hashedPassword,
                role: (dto.role as any) || UserRole.USER,
            });

            return await this.userRepository.save(user);
        } catch (error) {
            if (error instanceof ConflictException) throw error;
            console.error('Signup error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Authenticate user via email and password.
     */
    async login(dto: LoginDto): Promise<{ accessToken: string; user: any }> {
        try {
            const user = await this.userRepository.findOne({
                where: { email: dto.email },
                select: ['id', 'email', 'firstName', 'lastName', 'password', 'role', 'isActive'],
            });

            if (!user || !user.password || !(await bcrypt.compare(dto.password, user.password))) {
                throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED);
            }

            if (!user.isActive) {
                throw new UnauthorizedException(MESSAGES.AUTH.ACCOUNT_BLOCKED);
            }

            const payload = { sub: user.id, email: user.email, role: user.role };
            const { password, ...userData } = user;

            // Trigger login notification
            const wallet = await this.walletRepository.findOne({ where: { userId: user.id } });
            if (wallet) {
                await this.notificationsService.createNotification(
                    wallet.walletAddress,
                    'New Login Detected',
                    `A new login was detected for your account at ${new Date().toLocaleString()}.`,
                    NotificationType.LOGIN,
                );
            }

            return {
                accessToken: this.jwtService.sign(payload),
                user: userData,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) throw error;
            console.error('Login error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Generates a nonce for wallet linking or login.
     */
    async generateNonce(walletAddress: string): Promise<{ nonce: string }> {
        const nonce = `Sign this message to confirm wallet ownership: ${uuidv4()}`;
        return { nonce };
    }

    /**
     * Links a wallet to an authenticated user.
     */
    async linkWallet(userId: string, walletAddress: string, signature: string, nonce: string): Promise<Wallet> {
        try {
            const recoveredAddr = verifyMessage(nonce, signature);
            if (recoveredAddr.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new UnauthorizedException('Invalid signature');
            }

            const existingWallet = await this.walletRepository.findOne({ where: { walletAddress: walletAddress.toLowerCase() } });
            if (existingWallet) {
                throw new ConflictException('Wallet already linked to an account');
            }

            const wallet = this.walletRepository.create({
                walletAddress: walletAddress.toLowerCase(),
                userId: userId,
            });

            return await this.walletRepository.save(wallet);
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof ConflictException) throw error;
            console.error('Link wallet error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Authenticate via wallet signature.
     */
    async walletLogin(walletAddress: string, signature: string, nonce: string): Promise<{ accessToken: string; user: any }> {
        try {
            const recoveredAddr = verifyMessage(nonce, signature);
            if (recoveredAddr.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new UnauthorizedException(MESSAGES.AUTH.UNAUTHORIZED);
            }

            const wallet = await this.walletRepository.findOne({
                where: { walletAddress: walletAddress.toLowerCase() },
                relations: ['user'],
            });

            if (!wallet) {
                throw new UnauthorizedException('Wallet not linked to any account');
            }

            if (wallet.is_blocked || (wallet.user && !wallet.user.isActive)) {
                throw new UnauthorizedException(MESSAGES.AUTH.ACCOUNT_BLOCKED);
            }

            // Trigger login notification
            await this.notificationsService.createNotification(
                wallet.walletAddress,
                'New Login Detected (Wallet)',
                `A new wallet login was detected for your account at ${new Date().toLocaleString()}.`,
                NotificationType.LOGIN,
            );

            const payload = {
                sub: wallet.user.id,
                email: wallet.user.email,
                walletAddress: wallet.walletAddress,
                role: wallet.user.role
            };
            return {
                accessToken: this.jwtService.sign(payload),
                user: wallet.user,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            console.error('Wallet login error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
