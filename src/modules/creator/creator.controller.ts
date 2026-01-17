import { Controller, Post, Get, Body, UseGuards, Req, Res, Patch, Param, Delete } from '@nestjs/common';
import type { Response } from 'express';
import { CreatorService } from './creator.service';
import { CreateNftDto } from './dto/create-nft.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('creator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CREATOR)
export class CreatorController {
    constructor(private readonly creatorService: CreatorService) { }

    /**
     * POST /creator/nfts
     * Create a new NFT record.
     */
    @Post('nfts')
    async createNft(@Req() req: any, @Body() dto: CreateNftDto, @Res() res: Response) {
        try {
            const nft = await this.creatorService.createNft(req.user.userId, req.user.walletAddress, dto);
            return successResponse(MESSAGES.NFT.CREATED, nft, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /creator/nfts
     * List NFTs owned by the creator.
     */
    @Get('nfts')
    async getMyNfts(@Req() req: any, @Res() res: Response) {
        try {
            const nfts = await this.creatorService.getMyNfts(req.user.userId);
            return successResponse(MESSAGES.CREATOR.NFTS_FETCHED, nfts, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /creator/nfts/:id
     * Update NFT metadata.
     */
    @Patch('nfts/:id')
    async updateNft(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateNftDto, @Res() res: Response) {
        try {
            const nft = await this.creatorService.updateNft(id, req.user.userId, dto);
            return successResponse('NFT updated successfully.', nft, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * DELETE /creator/nfts/:id
     * Delete an NFT record.
     */
    @Delete('nfts/:id')
    async deleteNft(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            await this.creatorService.deleteNft(id, req.user.userId);
            return successResponse('NFT deleted successfully.', null, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /creator/auctions
     * Start a new auction.
     */
    @Post('auctions')
    async createAuction(@Req() req: any, @Body() dto: CreateAuctionDto, @Res() res: Response) {
        try {
            const auction = await this.creatorService.createAuction(req.user.userId, req.user.walletAddress, dto);
            return successResponse(MESSAGES.AUCTION.CREATED, auction, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /creator/auctions
     * List auctions managed by the creator.
     */
    @Get('auctions')
    async getMyAuctions(@Req() req: any, @Res() res: Response) {
        try {
            const auctions = await this.creatorService.getMyAuctions(req.user.userId);
            return successResponse(MESSAGES.CREATOR.AUCTIONS_FETCHED, auctions, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
