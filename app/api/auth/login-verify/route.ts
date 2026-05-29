import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { challengeStore } from '@/lib/challenge-store';
import { authenticatorDB, userDB } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { getWebAuthnConfig } from '@/lib/webauthn-config';

export async function POST(request: NextRequest) {
  const { username, response } = await request.json();
  const cleanUsername = String(username ?? '').trim();

  const user = userDB.getByUsername(cleanUsername);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const expectedChallenge = challengeStore.get(cleanUsername);
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
  }

  const authenticator = authenticatorDB.getByCredentialId(response.id);
  if (!authenticator || authenticator.user_id !== user.id) {
    return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 });
  }
  const config = getWebAuthnConfig(request);

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.rpOrigin,
    expectedRPID: config.rpID,
    credential: {
      id: authenticator.credential_id,
      publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
      counter: authenticator.counter ?? 0,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  challengeStore.delete(cleanUsername);
  authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0);

  await createSession({ userId: user.id, username: user.username });
  return NextResponse.json({ success: true });
}
