import { Controller, Get, Patch, Body, Param, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { successResponse, failResponse } from '../../common/util/response.handler';
import { MESSAGES } from '../../common/constants/messages';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    /**
     * GET /settings
     * Get all public settings.
     */
    @Get()
    async getPublic(@Res() res: Response) {
        try {
            const settings = await this.settingsService.getPublicSettings();
            return successResponse('Public settings fetched.', settings, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }

    /**
     * PATCH /settings/:key
     * Update a setting (Admin only).
     */
    @Patch(':key')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(@Param('key') key: string, @Body('value') value: any, @Res() res: Response) {
        try {
            const updated = await this.settingsService.updateSetting(key, value);
            return successResponse(`Setting ${key} updated.`, updated, res);
        } catch (error) {
            return failResponse(true, error.message, res);
        }
    }
}
