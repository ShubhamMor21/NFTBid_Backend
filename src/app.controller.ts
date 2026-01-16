import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { successResponse } from './common/util/response.handler';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(@Res() res: Response) {
    const result = this.appService.getHello();
    return successResponse("Status OK", result, res);
  }
}
