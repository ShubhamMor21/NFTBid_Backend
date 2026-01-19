import { Controller, Post, Get, Body, Param, UseGuards, Req, Res, Patch, Delete, Query } from '@nestjs/common';
import type { Response } from 'express';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from '../creator/dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { GetAuctionsDto } from './dto/get-auctions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('auctions')
export class AuctionsController {
    constructor(private readonly auctionsService: AuctionsService) { }

    /**
     * POST /auctions
     * Create a new auction draft.
     */
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async create(@Req() req: any, @Body() dto: CreateAuctionDto, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.createAuction(req.user.userId, req.user.walletAddress, req.user.role, dto);
            return successResponse(MESSAGES.AUCTION.CREATED, auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /auctions/:id
     * Edit an auction (Draft only).
     */
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateAuctionDto, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.updateAuction(id, req.user.userId, req.user.role, dto);
            return successResponse('Auction updated successfully.', auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * DELETE /auctions/:id
     * Delete an auction (Draft only).
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async delete(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            await this.auctionsService.deleteAuction(id, req.user.userId, req.user.role);
            return successResponse('Auction deleted successfully.', null, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /auctions/:id/start
     * Manually start an auction.
     */
    @Post(':id/start')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async start(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.startAuction(id, req.user.userId, req.user.role);
            return successResponse('Auction started successfully.', auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /auctions/:id/end
     * Manually end an auction.
     */
    @Post(':id/end')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async end(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.endAuction(id, req.user.userId, req.user.role);
            return successResponse('Auction ended successfully.', auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /auctions/:id/settle
     * Settle an auction.
     */
    @Post(':id/settle')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async settle(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.settleAuction(id, req.user.userId, req.user.role);
            return successResponse('Auction settled successfully.', auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /auctions/active
     * Get all active auctions.
     */
    @Get('active')
    async getActive(@Res() res: Response) {
        try {
            const auctions = await this.auctionsService.getActiveAuctions();
            return successResponse('Active auctions fetched successfully.', auctions, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /auctions/:id
     * Get auction detail.
     */
    @Get(':id')
    async findById(@Param('id') id: string, @Res() res: Response) {
        try {
            const auction = await this.auctionsService.getAuctionById(id);
            return successResponse('Auction details fetched successfully.', auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /auctions/dashboard
     * Get auction dashboard with stats and filtered list.
     */
    @Get('dashboard/all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CREATOR, UserRole.ADMIN)
    async findDashboard(@Req() req: any, @Query() query: GetAuctionsDto, @Res() res: Response) {
        try {
            const data = await this.auctionsService.getAuctionsDashboard(req.user.userId, query);
            return successResponse('Auction dashboard fetched successfully.', data, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
