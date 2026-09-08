class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = this.constructor.name
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', options?: ErrorOptions) {
    super(message, 403, options)
  }
}
