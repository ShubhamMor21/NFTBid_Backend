import { Controller, Get, Patch, Delete, Param, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { AdminAuctionsQueryDto } from './dto/admin-auctions-query.dto';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { Req, Body, Post } from '@nestjs/common';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /**
     * GET /admin/users
     * List all users with pagination and filters.
     */
    @Get('users')
    async getAllUsers(@Query() query: AdminUserQueryDto, @Res() res: Response) {
        try {
            const result = await this.adminService.getAllUsers(query);
            return successResponse(MESSAGES.ADMIN.USERS_FETCHED, result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /admin/users/banned
     * List all banned users.
     */
    @Get('users/banned')
    async getBannedUsers(@Query('page') page: number, @Query('limit') limit: number, @Query('search') search: string, @Res() res: Response) {
        try {
            const result = await this.adminService.getBannedUsers(page, limit, search);
            return successResponse('Banned users fetched successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /admin/users/:id/ban
     * Ban a user.
     */
    @Post('users/:id/ban')
    async banUser(@Param('id') id: string, @Body() dto: BanUserDto, @Req() req: any, @Res() res: Response) {
        try {
            const user = await this.adminService.banUser(id, dto.reason, req.user.userId, `${req.user.firstName} ${req.user.lastName}`);
            return successResponse('User banned successfully.', user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * POST /admin/users/:id/unban
     * Unban a user.
     */
    @Post('users/:id/unban')
    async unbanUser(@Param('id') id: string, @Body() dto: BanUserDto, @Req() req: any, @Res() res: Response) {
        try {
            const user = await this.adminService.unbanUser(id, dto.reason, req.user.userId, `${req.user.firstName} ${req.user.lastName}`);
            return successResponse('User unbanned successfully.', user, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /admin/auctions
     * List all auctions.
     */
    @Get('auctions')
    async getAllAuctions(@Query() query: AdminAuctionsQueryDto, @Res() res: Response) {
        try {
            const result = await this.adminService.getAllAuctions(query);
            return successResponse(MESSAGES.ADMIN.AUCTIONS_FETCHED, result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * DELETE /admin/auctions/:id
     * Force delete an auction.
     */
    @Delete('auctions/:id')
    async deleteAuction(@Param('id') id: string, @Res() res: Response) {
        try {
            await this.adminService.deleteAuction(id);
            return successResponse(MESSAGES.ADMIN.AUCTION_DELETED, null, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /admin/reports
     * List all reports properly.
     */
    @Get('reports')
    async getAllReports(@Query() query: AdminReportsQueryDto, @Res() res: Response) {
        try {
            const result = await this.adminService.getAllReports(query);
            return successResponse('Reports fetched successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /admin/reports/:id/resolve
     * Resolve a report.
     */
    @Patch('reports/:id/resolve')
    async resolveReport(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const result = await this.adminService.resolveReport(id, req.user.userId, `${req.user.firstName} ${req.user.lastName}`);
            return successResponse('Report resolved successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /admin/reports/:id/dismiss
     * Dismiss a report.
     */
    @Patch('reports/:id/dismiss')
    async dismissReport(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
        try {
            const result = await this.adminService.dismissReport(id, req.user.userId, `${req.user.firstName} ${req.user.lastName}`);
            return successResponse('Report dismissed successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * GET /admin/logs
     * Get activity logs.
     */
    @Get('logs')
    async getActivityLogs(@Query('page') page: number, @Query('limit') limit: number, @Res() res: Response) {
        try {
            const result = await this.adminService.getActivityLogs(page, limit);
            return successResponse('Activity logs fetched successfully.', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
