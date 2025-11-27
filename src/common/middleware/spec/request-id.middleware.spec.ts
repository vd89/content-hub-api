import { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from '../request-id.middleware';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid');

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should use existing x-request-id from headers', () => {
      const existingRequestId = 'existing-uuid-1234';
      mockRequest.headers = { 'x-request-id': existingRequestId };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['requestId']).toBe(existingRequestId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', existingRequestId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new UUID when x-request-id header is not provided', () => {
      const generatedUuid = 'generated-uuid-5678';
      (uuidv4 as jest.Mock).mockReturnValue(generatedUuid);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(uuidv4).toHaveBeenCalled();
      expect(mockRequest['requestId']).toBe(generatedUuid);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', generatedUuid);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set requestId property on request object', () => {
      const requestId = 'test-request-id';
      mockRequest.headers = { 'x-request-id': requestId };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest['requestId']).toBeDefined();
      expect(mockRequest['requestId']).toBe(requestId);
    });

    it('should set x-request-id header in response', () => {
      const requestId = 'response-header-test';
      mockRequest.headers = { 'x-request-id': requestId };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', requestId);
      expect(mockResponse.setHeader).toHaveBeenCalledTimes(1);
    });

    it('should call next function', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle empty string in x-request-id header by generating new UUID', () => {
      const generatedUuid = 'fallback-uuid-9999';
      (uuidv4 as jest.Mock).mockReturnValue(generatedUuid);
      mockRequest.headers = { 'x-request-id': '' };

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(uuidv4).toHaveBeenCalled();
      expect(mockRequest['requestId']).toBe(generatedUuid);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', generatedUuid);
    });
  });
});
