export class NetworkError extends Error {
  constructor(message = 'Network unavailable') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export class DeviceRevokedError extends Error {
  constructor(message = 'This device was signed out') {
    super(message);
    this.name = 'DeviceRevokedError';
  }
}

export class ServerError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ServerError';
    this.status = status;
    this.code = code;
  }
}
