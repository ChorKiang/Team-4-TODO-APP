import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { challengeStore } from '@/lib/challenge-store';
import { getWebAuthnConfig } from '@/lib/webauthn-config';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = String(body.username ?? '').trim();

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  const existing = userDB.getByUsername(username);
  const userId = existing?.id ?? Date.now();
  const config = getWebAuthnConfig(request);

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: new TextEncoder().encode(String(userId)),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: existing
      ? authenticatorDB.getByUserId(existing.id).map((a) => ({
          id: a.credential_id,
          transports: JSON.parse(a.transports ?? '[]'),
        }))
      : [],
  });

  challengeStore.set(username, options.challenge);
  return NextResponse.json(options);
}
