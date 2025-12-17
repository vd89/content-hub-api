import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger, Optional } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import sanitizeHtml from 'sanitize-html';

export interface ValidationPipeOptions {
  skipMissingProperties?: boolean;
  skipNullProperties?: boolean;
  forbidNonWhitelisted?: boolean;
  forbidUnknownValues?: boolean;
  transformOptions?: {
    enableImplicitConversion?: boolean;
    excludeExtraneousValues?: boolean;
  };
  sanitizeHtml?: boolean;
  sanitizeConfig?: sanitizeHtml.IOptions;
}

const DEFAULT_SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

@Injectable()
export class CustomValidationPipe implements PipeTransform {
  private readonly logger = new Logger('CustomValidationPipe');

  constructor(@Optional() private options: ValidationPipeOptions = {}) {
    this.options = {
      skipMissingProperties: false,
      skipNullProperties: false,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
      sanitizeHtml: true,
      ...this.options,
    };
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const { metatype } = metadata;

    // Skip validation if no metatype or it's a primitive type
    if (!metatype || !this.isValidationNeeded(metatype)) {
      return value;
    }

    // Sanitize input if needed
    if (this.options.sanitizeHtml && this.isObject(value)) {
      value = this.sanitizeInput(value);
    }

    // Strip unknown properties
    if (this.options.forbidNonWhitelisted && this.isRecord(value)) {
      value = this.stripUnknownProperties(value, metatype);
    }

    // Transform to DTO class
    const object = plainToInstance(metatype, value, {
      enableImplicitConversion: this.options.transformOptions?.enableImplicitConversion,
      excludeExtraneousValues: this.options.transformOptions?.excludeExtraneousValues,
    });

    // Validate
    const errors = await validate(object as object, {
      skipMissingProperties: this.options.skipMissingProperties,
      skipNullProperties: this.options.skipNullProperties,
      forbidNonWhitelisted: this.options.forbidNonWhitelisted,
      forbidUnknownValues: this.options.forbidUnknownValues,
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.formatValidationErrors(errors));
    }

    return object;
  }

  private isValidationNeeded(metatype: new (...args: any[]) => any): metatype is new (...args: any[]) => any {
    const primitives: Array<new (...args: any[]) => any> = [String, Boolean, Number, Array, Object];
    return !primitives.includes(metatype);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private sanitizeInput(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized = Array.isArray(value) ? [] : {};

      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          sanitized[key] = this.sanitizeInput(value[key]);
        }
      }

      return sanitized;
    }

    return value;
  }

  private sanitizeString(str: string): string {
    // Remove potential XSS vectors
    const config = {
      ...DEFAULT_SANITIZE_CONFIG,
      ...this.options.sanitizeConfig,
    };

    return sanitizeHtml(str, config);
  }

  private stripUnknownProperties(
    value: Record<string, any>,
    metatype: new (...args: any[]) => any,
  ): Record<string, any> {
    const instance = new metatype();
    const allowedProps = Object.getOwnPropertyNames(instance);

    const stripped: Record<string, any> = {};
    for (const prop of allowedProps) {
      if (Object.prototype.hasOwnProperty.call(value, prop)) {
        stripped[prop] = value[prop];
      }
    }

    return stripped;
  }

  private formatValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    for (const error of errors) {
      const property = prefix ? `${prefix}.${error.property}` : error.property;

      if (error.constraints) {
        formatted[property] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        const nestedErrors = this.formatValidationErrors(error.children, property);
        Object.assign(formatted, nestedErrors);
      }
    }

    return formatted;
  }
}
