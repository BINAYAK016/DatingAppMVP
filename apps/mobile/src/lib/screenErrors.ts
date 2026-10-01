export function isUnavailable(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status !== undefined && [400, 401, 403, 404, 410, 422].includes(status);
}
