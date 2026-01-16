import { Controller, Get, Patch, UseGuards, Req, Param, Res, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MESSAGES } from '../../common/constants/messages';
import { successResponse, failResponse } from '../../common/util/response.handler';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /**
     * GET /notifications
     * Fetch all notifications for the current user.
     */
    @UseGuards(JwtAuthGuard)
    @Get()
    async getMyNotifications(@Req() req: any, @Res() res: Response) {
        try {
            const notifications = await this.notificationsService.getMyNotifications(req.user.userId);
            return successResponse(MESSAGES.NOTIFICATION.FETCHED, notifications, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /notifications/:id/read
     * Mark a notification as read.
     */
    @UseGuards(JwtAuthGuard)
    @Patch(':id/read')
    async markAsRead(@Param('id') id: string, @Res() res: Response) {
        try {
            const notification = await this.notificationsService.markAsRead(id);
            return successResponse(MESSAGES.NOTIFICATION.READ, notification, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /notifications/read-all
     * Mark all notifications as read for the current user.
     */
    @UseGuards(JwtAuthGuard)
    @Patch('read-all')
    async markAllAsRead(@Req() req: any, @Res() res: Response) {
        try {
            const result = await this.notificationsService.markAllAsRead(req.user.userId);
            return successResponse('All notifications marked as read', result, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
