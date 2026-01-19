import { Controller, Get, Patch, Delete, Body, UseGuards, Req, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';
import { MyBidsQueryDto } from './dto/my-bids-query.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * GET /users/me
     * Fetch current user's profile and wallets.
     */
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: any, @Res() res: Response) {
        try {
            const user = await this.usersService.getMe(req.user.userId);
            return successResponse(MESSAGES.USER.PROFILE_FETCHED, user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /users/profile
     * Update current user's profile.
     */
    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto, @Res() res: Response) {
        try {
            const user = await this.usersService.updateProfile(req.user.userId, dto);
            return successResponse(MESSAGES.USER.PROFILE_UPDATED, user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /users/me/wallets
     * List all wallets linked to the account.
     */
    @UseGuards(JwtAuthGuard)
    @Get('me/wallets')
    async getMyWallets(@Req() req: any, @Res() res: Response) {
        try {
            const wallets = await this.usersService.getMyWallets(req.user.userId);
            return successResponse(MESSAGES.USER.WALLETS_FETCHED, wallets, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /users/wallets/:id/name
     * Rename a specific wallet.
     */
    @UseGuards(JwtAuthGuard)
    @Patch('wallets/:id/name')
    async updateWalletName(@Req() req: any, @Param('id') walletId: string, @Body() dto: UpdateWalletDto, @Res() res: Response) {
        try {
            if (!dto.name) {
                return failResponse(true, 'Wallet name is required', res);
            }
            const wallet = await this.usersService.updateWalletName(req.user.userId, walletId, dto.name);
            return successResponse('Wallet renamed successfully', wallet, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /users/wallets/:id/primary
     * Set a wallet as the primary wallet.
     */
    @UseGuards(JwtAuthGuard)
    @Patch('wallets/:id/primary')
    async setPrimaryWallet(@Req() req: any, @Param('id') walletId: string, @Res() res: Response) {
        try {
            const wallet = await this.usersService.setPrimaryWallet(req.user.userId, walletId);
            return successResponse('Primary wallet updated successfully', wallet, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * DELETE /users/me/wallets/:id
     * Delete a specific wallet.
     */
    @UseGuards(JwtAuthGuard)
    @Delete('me/wallets/:id')
    async deleteWallet(@Req() req: any, @Param('id') walletId: string, @Res() res: Response) {
        try {
            await this.usersService.deleteWallet(req.user.userId, walletId);
            return successResponse('Wallet deleted successfully', null, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /users/me/bids
     * Get all bids placed by the current user.
     */
    @UseGuards(JwtAuthGuard)
    @Get('me/bids')
    async getMyBids(@Req() req: any, @Query() query: MyBidsQueryDto, @Res() res: Response) {
        try {
            const result = await this.usersService.getMyBids(req.user.userId, query);
            return successResponse('Bids fetched successfully', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /users/:id
     * Public profile view.
     */
    @Get(':id')
    async getPublicProfile(@Param('id') id: string, @Res() res: Response) {
        try {
            const user = await this.usersService.getPublicProfile(id);
            return successResponse(MESSAGES.USER.PROFILE_FETCHED, user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /users/me/nfts
     * Get all NFTs owned by the current user.
     */
    @UseGuards(JwtAuthGuard)
    @Get('me/nfts')
    async getMyNfts(@Req() req: any, @Res() res: Response) {
        try {
            const nfts = await this.usersService.getMyNfts(req.user.userId);
            return successResponse('User NFTs fetched successfully', nfts, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /users/:id/block
     * Admin/Logic to block/unblock users.
     */
    @UseGuards(JwtAuthGuard)
    @Patch(':id/block')
    async toggleBlock(@Param('id') id: string, @Query('block') block: string, @Res() res: Response) {
        try {
            const isBlocked = block === 'true';
            const user = await this.usersService.toggleBlockStatus(id, isBlocked);
            const msg = isBlocked ? MESSAGES.USER.USER_BLOCKED : MESSAGES.USER.USER_UNBLOCKED;
            return successResponse(msg, user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
