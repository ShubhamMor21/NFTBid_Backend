import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, LinkWalletDto, WalletLoginDto, NonceRequestDto } from './dto/auth.dto';
import { MESSAGES } from '../../common/constants/messages';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Signup with email and password.
     */
    @Post('signup')
    async signup(@Body() dto: SignupDto, @Res() res: Response) {
        try {
            const user = await this.authService.signup(dto);
            return successResponse(MESSAGES.AUTH.SIGNUP_SUCCESS, user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * Primary login method via email and password.
     */
    @Post('login')
    async login(@Body() dto: LoginDto, @Res() res: Response) {
        try {
            const result = await this.authService.login(dto);
            return successResponse(MESSAGES.AUTH.LOGIN_SUCCESS, result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * Generates a nonce for wallet operations.
     */
    @Post('nonce')
    async getNonce(@Body() body: NonceRequestDto, @Res() res: Response) {
        try {
            const result = await this.authService.generateNonce(body.walletAddress);
            return successResponse(MESSAGES.AUTH.NONCE_GENERATED, result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * Link a wallet address to an authenticated user's account.
     */
    @UseGuards(JwtAuthGuard)
    @Post('link-wallet')
    async linkWallet(@Req() req: any, @Body() dto: LinkWalletDto, @Res() res: Response) {
        try {
            const wallet = await this.authService.linkWallet(
                req.user.userId,
                dto.walletAddress,
                dto.signature,
                dto.nonce,
            );
            return successResponse(MESSAGES.AUTH.WALLET_LINK_SUCCESS, wallet, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * Login via an already linked wallet.
     */
    @Post('wallet-login')
    async walletLogin(@Body() dto: WalletLoginDto | LinkWalletDto, @Res() res: Response) {
        try {
            const result = await this.authService.walletLogin(dto.walletAddress, dto.signature, (dto as any).nonce);
            return successResponse(MESSAGES.AUTH.LOGIN_SUCCESS, result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * Logout for all roles.
     */
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Req() req: any, @Res() res: Response) {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                await this.authService.logout(token);
            }
            return successResponse(MESSAGES.AUTH.LOGOUT_SUCCESS, null, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
