export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', options?: ErrorOptions) {
    super(message, 400, options)
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', options?: ErrorOptions) {
    super(message, 401, options)
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', options?: ErrorOptions) {
    super(message, 403, options)
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', options?: ErrorOptions) {
    super(message, 404, options)
  }
}
