import 'server-only';

import crypto from 'node:crypto';

import { db } from '@/lib/db';

export interface StoredZohoConnection {
  portalId: string;
  portalName: string | null;
  refreshToken: string;
  apiDomain: string | null;
}

function getEncryptionKey(): Buffer {
  const value =
    process.env.ZOHO_TOKEN_ENCRYPTION_KEY;

  if (
    !value ||
    !/^[0-9a-fA-F]{64}$/.test(value)
  ) {
    throw new Error(
      'ZOHO_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal value.',
    );
  }

  return Buffer.from(
    value,
    'hex',
  );
}

function encryptToken(
  value: string,
): string {
  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        'utf8',
      ),

      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('base64'),
  ].join('.');
}

function decryptToken(
  value: string,
): string {
  const parts =
    value.split('.');

  if (
    parts.length !== 4 ||
    parts[0] !== 'v1'
  ) {
    throw new Error(
      'Invalid encrypted Zoho token format.',
    );
  }

  const iv =
    Buffer.from(
      parts[1],
      'hex',
    );

  const authTag =
    Buffer.from(
      parts[2],
      'hex',
    );

  const encrypted =
    Buffer.from(
      parts[3],
      'base64',
    );

  const decipher =
    crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv,
    );

  decipher.setAuthTag(
    authTag,
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        encrypted,
      ),

      decipher.final(),
    ]);

  return decrypted.toString(
    'utf8',
  );
}

export async function saveZohoConnection(
  input: {
    portalId: string;
    portalName: string;
    refreshToken?: string;
    apiDomain?: string;
  },
): Promise<void> {
  const existing =
    await db.query<{
      refresh_token_ciphertext: string;
    }>(
      `
      SELECT
        refresh_token_ciphertext

      FROM zoho_connections

      WHERE portal_id = $1

      LIMIT 1
      `,
      [
        input.portalId,
      ],
    );

  let encryptedToken =
    existing.rows[0]
      ?.refresh_token_ciphertext;

  if (input.refreshToken) {
    encryptedToken =
      encryptToken(
        input.refreshToken,
      );
  }

  if (!encryptedToken) {
    throw new Error(
      'Zoho did not return a refresh token. Reconnect Zoho with consent so a refresh token can be stored.',
    );
  }

  await db.query(
    `
    INSERT INTO zoho_connections (
      portal_id,
      portal_name,
      refresh_token_ciphertext,
      api_domain,
      connected_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      NOW(),
      NOW()
    )

    ON CONFLICT (portal_id)

    DO UPDATE SET
      portal_name =
        EXCLUDED.portal_name,

      refresh_token_ciphertext =
        EXCLUDED.refresh_token_ciphertext,

      api_domain =
        COALESCE(
          EXCLUDED.api_domain,
          zoho_connections.api_domain
        ),

      connected_at =
        NOW(),

      updated_at =
        NOW()
    `,
    [
      input.portalId,
      input.portalName,
      encryptedToken,
      input.apiDomain ?? null,
    ],
  );
}

export async function getZohoConnection():
Promise<StoredZohoConnection | null> {
  const result =
    await db.query<{
      portal_id: string;
      portal_name: string | null;

      refresh_token_ciphertext:
        string;

      api_domain: string | null;
    }>(
      `
      SELECT
        portal_id,
        portal_name,
        refresh_token_ciphertext,
        api_domain

      FROM zoho_connections

      ORDER BY
        connected_at DESC

      LIMIT 1
      `,
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return {
    portalId:
      row.portal_id,

    portalName:
      row.portal_name,

    refreshToken:
      decryptToken(
        row.refresh_token_ciphertext,
      ),

    apiDomain:
      row.api_domain,
  };
}