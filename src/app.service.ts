import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { statusCode: number; success: boolean; message: string } {
    return {
      statusCode: 200,
      success: true,
      message: 'Hello World!',
    };
  }
}
