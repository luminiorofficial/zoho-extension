import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

/**
 * Get unread notifications for the current user
 */
export async function GET(request: NextRequest) {
  const rawSession = request.cookies.get('session')?.value;
  let memberId: string | null = null;

  if (rawSession) {
    try {
      const sessionData = JSON.parse(rawSession) as { userId?: string };
      memberId = typeof sessionData.userId === 'string' ? sessionData.userId : null;
    } catch {
      memberId = null;
    }
  }

  if (!memberId) {
    return NextResponse.json({ notifications: [] });
  }

  try {
    const notifications = await db.query<{
      id: string;
      title: string;
      message: string;
      type: string;
      entity_type: string | null;
      entity_id: string | null;
      is_read: boolean;
    }>(
      `SELECT id, title, message, type, entity_type, entity_id, is_read
       FROM notifications
       WHERE member_id = $1 AND is_read = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [memberId]
    );

    return NextResponse.json({
      notifications: notifications.rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        entityType: n.entity_type || 'none',
        entityId: n.entity_id || null,
        isRead: n.is_read,
      })),
    });
  } catch (error) {
    console.error('Notification fetch failed:', error);
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }
}