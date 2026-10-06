export function isAuthorizedCronRequest(request: Request, secret: string | undefined): boolean {
  // An unset secret would otherwise accept the literal header "Bearer undefined".
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return constantTimeEqual(header, `Bearer ${secret}`);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
