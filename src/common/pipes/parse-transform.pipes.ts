import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { isUUID, isISO8601 } from 'class-validator';
import { Types } from 'mongoose';

// Parse UUID Pipe
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isUUID(value)) {
      throw new BadRequestException(`${metadata.data} must be a valid UUID`);
    }
    return value;
  }
}

// Parse MongoDB ObjectId Pipe
@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${metadata.data ?? 'Value'} must be a valid MongoDB ObjectId`);
    }
    return value;
  }
}

// Parse Date Pipe
@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string, metadata: ArgumentMetadata): Date {
    // Try to parse as ISO 8601
    if (isISO8601(value)) {
      return new Date(value);
    }

    // Try to parse as timestamp
    const timestamp = parseInt(value, 10);
    if (!isNaN(timestamp) && timestamp > 0) {
      return new Date(timestamp);
    }

    throw new BadRequestException(`${metadata.data} must be a valid ISO 8601 date or timestamp`);
  }
}

// Parse Boolean Pipe
@Injectable()
export class ParseBoolPipe implements PipeTransform<string | boolean, boolean> {
  transform(value: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const strValue = String(value).toLowerCase();

    if (strValue === 'true' || strValue === '1' || strValue === 'yes') {
      return true;
    }

    if (strValue === 'false' || strValue === '0' || strValue === 'no') {
      return false;
    }

    throw new BadRequestException('Value must be a valid boolean (true/false, 1/0, yes/no)');
  }
}

// Parse Integer Pipe
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  constructor(
    private min?: number,
    private max?: number,
  ) {}

  transform(value: string, metadata: ArgumentMetadata): number {
    const num = parseInt(value, 10);

    if (isNaN(num)) {
      throw new BadRequestException(`${metadata.data} must be a valid integer`);
    }

    if (this.min !== undefined && num < this.min) {
      throw new BadRequestException(`${metadata.data} must be at least ${this.min}`);
    }

    if (this.max !== undefined && num > this.max) {
      throw new BadRequestException(`${metadata.data} must be at most ${this.max}`);
    }

    return num;
  }
}

// Parse Enum Pipe
@Injectable()
export class ParseEnumPipe implements PipeTransform<string, any> {
  constructor(private enumType: Record<string, any>) {}

  transform(value: string, metadata: ArgumentMetadata): string {
    const enumValues = Object.values(this.enumType);

    if (!enumValues.includes(value)) {
      throw new BadRequestException(`${metadata.data} must be one of: ${enumValues.join(', ')}`);
    }

    return value;
  }
}

// Custom transformation pipe for complex types
@Injectable()
export class TransformPipe implements PipeTransform {
  constructor(private transformer: (value: any) => any) {}

  transform(value: any, metadata: ArgumentMetadata): any {
    try {
      return this.transformer(value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Transformation failed for ${metadata.data ?? 'value'}: ${errorMessage}`);
    }
  }
}

// Sanitization Pipe for strings
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (this.isObject(value)) {
      return this.sanitizeObject(value);
    }

    return value;
  }

  private isObject(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }

  private sanitizeString(value: string): string {
    // Trim whitespace
    let sanitized = value.trim();

    // Remove potentially harmful characters
    sanitized = sanitized
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return sanitized;
  }

  private sanitizeObject(value: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = Array.isArray(value) ? [] : {};

    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = this.transform(value[key]);
      }
    }

    return sanitized;
  }
}

// Pagination query parameter transformation
export interface PaginationQuery {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class ParsePaginationPipe implements PipeTransform<Record<string, any>, PaginationQuery> {
  constructor(
    private defaultPage = 1,
    private defaultLimit = 10,
    private maxLimit = 100,
  ) {}

  transform(value: Record<string, any>): PaginationQuery {
    let page = parseInt(String(value.page ?? this.defaultPage), 10);
    let limit = parseInt(String(value.limit ?? this.defaultLimit), 10);
    const sort = String(value.sort ?? '');
    const order = value.order === 'desc' ? 'desc' : 'asc';

    // Validate page
    if (isNaN(page) || page < 1) {
      page = this.defaultPage;
    }

    // Validate limit
    if (isNaN(limit) || limit < 1) {
      limit = this.defaultLimit;
    }

    if (limit > this.maxLimit) {
      limit = this.maxLimit;
    }

    return {
      page,
      limit,
      sort,
      order,
    };
  }
}
