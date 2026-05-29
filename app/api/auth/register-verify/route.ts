import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { challengeStore } from '@/lib/challenge-store';
import { authenticatorDB, userDB } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { getWebAuthnConfig } from '@/lib/webauthn-config';

export async function POST(request: NextRequest) {
  const { username, response } = await request.json();

  const cleanUsername = String(username ?? '').trim();
  const expectedChallenge = challengeStore.get(cleanUsername);
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }
  const config = getWebAuthnConfig(request);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.rpOrigin,
    expectedRPID: config.rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  challengeStore.delete(cleanUsername);

  let user = userDB.getByUsername(cleanUsername);
  if (!user) {
    user = userDB.create(cleanUsername);
  }

  const { credential } = verification.registrationInfo;
  authenticatorDB.create(user.id, {
    credential_id: credential.id,
    credential_public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter ?? 0,
    transports: JSON.stringify(response?.response?.transports ?? []),
  });

  await createSession({ userId: user.id, username: user.username });
  return NextResponse.json({ success: true });
}
