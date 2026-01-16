import { Controller, Post, Get, Body, Param, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BidsService } from './bid.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('bids')
export class BidsController {
    constructor(private readonly bidsService: BidsService) { }

    /**
     * POST /bids
     * Place a new bid.
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async placeBid(@Req() req: any, @Body() dto: CreateBidDto, @Res() res: Response) {
        try {
            const bid = await this.bidsService.placeBid(req.user.userId, dto);
            return successResponse(MESSAGES.BID.PLACED, bid, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /bids/auction/:id
     * Fetch all bids for an auction.
     */
    @Get('auction/:id')
    async getBidsByAuction(@Param('id') id: string, @Res() res: Response) {
        try {
            const bids = await this.bidsService.getBidsByAuction(id);
            return successResponse('Bids for auction fetched successfully.', bids, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
