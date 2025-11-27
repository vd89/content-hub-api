import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): { statusCode: number; success: boolean; message: string } {
    return this.appService.getHello();
  }
}
