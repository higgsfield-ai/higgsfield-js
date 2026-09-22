import {
  APIError,
  AuthenticationError,
  BadInputError,
  NotEnoughCreditsError,
  ValidationError,
} from '../errors';

export type ErrorDetail =
  | string
  | Array<{
      type: string;
      loc: string[];
      msg: string;
      input?: any;
      ctx?: Record<string, any>;
    }>
  | undefined;

export const STATUS_ERROR_FACTORIES: Record<number, (detail: ErrorDetail) => Error> = {
  401: () => new AuthenticationError('Invalid API credentials'),
  403: () => new NotEnoughCreditsError(),
  422: (detail) => new ValidationError(detail),
  400: (detail) => new BadInputError(detail),
};

export function errorFromResponse(
  status: number,
  message: string,
  detail: ErrorDetail,
  data?: any
): Error {
  const factory = STATUS_ERROR_FACTORIES[status];
  return factory ? factory(detail) : new APIError(message, status, data);
}
