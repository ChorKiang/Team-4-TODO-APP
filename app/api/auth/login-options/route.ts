import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { challengeStore } from '@/lib/challenge-store';
import { getWebAuthnConfig } from '@/lib/webauthn-config';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = String(body.username ?? '').trim();
  const user = userDB.getByUsername(username);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const authenticators = authenticatorDB.getByUserId(user.id);
  const config = getWebAuthnConfig(request);
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: 'preferred',
    allowCredentials: authenticators.map((a) => ({
      id: a.credential_id,
      transports: JSON.parse(a.transports ?? '[]'),
    })),
  });

  challengeStore.set(username, options.challenge);
  return NextResponse.json(options);
}
