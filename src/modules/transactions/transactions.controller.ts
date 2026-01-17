import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { TransactionsService } from './transactions.service';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { successResponse, failResponse } from '../../common/util/response.handler';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    /**
     * GET /transactions
     * Get transactions based on user role.
     * - Admin: All transactions with filters
     * - Creator/User: Only their own transactions
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    async getTransactions(@Req() req: any, @Query() query: GetTransactionsDto, @Res() res: Response) {
        try {
            const { role, userId } = req.user;

            let result;
            if (role === UserRole.ADMIN) {
                result = await this.transactionsService.getAllTransactions(query);
            } else {
                result = await this.transactionsService.getUserTransactions(userId, query);
            }

            return successResponse('Transactions fetched successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
