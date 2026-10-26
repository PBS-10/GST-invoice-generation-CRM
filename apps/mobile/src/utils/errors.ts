export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super('DATABASE', message);
    this.name = 'DatabaseError';
  }
}

export class InvoiceStateError extends AppError {
  constructor(message: string) {
    super('INVOICE_STATE', message);
    this.name = 'InvoiceStateError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
