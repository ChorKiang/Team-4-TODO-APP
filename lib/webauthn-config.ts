import { NextRequest } from 'next/server';

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function extractRpIdFromOrigin(origin: string): string {
  const url = new URL(origin);
  return url.hostname;
}

export function getWebAuthnConfig(request: NextRequest): {
  rpName: string;
  rpID: string;
  rpOrigin: string;
} {
  const rpOrigin = process.env.RP_ORIGIN || getRequestOrigin(request);
  const rpID = process.env.RP_ID || extractRpIdFromOrigin(rpOrigin);

  return {
    rpName: process.env.RP_NAME || 'Todo App',
    rpID,
    rpOrigin,
  };
}
