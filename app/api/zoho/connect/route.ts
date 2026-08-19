import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getZohoAuthorizationUrl } from '@/lib/zoho/oauth';

export async function GET() {
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();

  cookieStore.set('zoho_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  const authorizationUrl =
    getZohoAuthorizationUrl(state);

  return NextResponse.redirect(authorizationUrl);
}