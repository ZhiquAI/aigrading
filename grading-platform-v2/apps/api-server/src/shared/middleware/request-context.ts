export const getRequestId = (request: Request): string => {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
};
