/** Error with an HTTP status; thrown from routes and handled by the error middleware. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (m = "Bad request") => new HttpError(400, m);
export const unauthorized = (m = "Not signed in") => new HttpError(401, m);
export const forbidden = (m = "Not allowed") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);

/** Express 5 types params as string | string[] | undefined; narrow to a plain string. */
export function param(params: Record<string, unknown>, name: string): string {
  const value = params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest(`Missing "${name}" in the URL`);
  }
  return value;
}
