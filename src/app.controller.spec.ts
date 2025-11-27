import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return a standardized response with success message', () => {
      const result = appController.getHello();

      expect(result).toEqual({
        statusCode: 200,
        success: true,
        message: 'Hello World!',
      });
    });

    it('should return status code 200', () => {
      const result = appController.getHello();
      expect(result.statusCode).toBe(200);
    });

    it('should return success as true', () => {
      const result = appController.getHello();
      expect(result.success).toBe(true);
    });

    it('should return message "Hello World!"', () => {
      const result = appController.getHello();
      expect(result.message).toBe('Hello World!');
    });
  });
});
