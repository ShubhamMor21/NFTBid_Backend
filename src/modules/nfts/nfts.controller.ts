import { Controller, Post, Get, Body, Param, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NftsService } from './nfts.service';
import { CreateNftDto } from '../creator/dto/create-nft.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('nfts')
export class NftsController {
    constructor(private readonly nftsService: NftsService) { }

    /**
     * POST /nfts
     * Store & validate NFT metadata.
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Body() dto: CreateNftDto, @Res() res: Response) {
        try {
            const nft = await this.nftsService.create(dto);
            return successResponse(MESSAGES.NFT.CREATED, nft, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /nfts/:id
     * Get NFT metadata by ID.
     */
    @Get(':id')
    async findById(@Param('id') id: string, @Res() res: Response) {
        try {
            const nft = await this.nftsService.findById(id);
            return successResponse(MESSAGES.NFT.FETCHED, nft, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /nfts/wallet/:wallet
     * Get NFTs by owner wallet.
     */
    @Get('wallet/:wallet')
    async findByWallet(@Param('wallet') wallet: string, @Res() res: Response) {
        try {
            const nfts = await this.nftsService.findByWallet(wallet);
            return successResponse(MESSAGES.NFT.WALLET_FETCHED, nfts, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
