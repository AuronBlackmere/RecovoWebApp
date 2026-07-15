import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

export const dynamic = 'force-dynamic';

const initAdmin = () => {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }
  return { db: getDatabase(), auth: getAuth() };
};

// Verify Firebase ID token from Authorization header
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const admin = initAdmin();
  if (!admin) return null;
  try {
    const token = authHeader.split('Bearer ')[1];
    return await admin.auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

// Sanitize input: only allow alphanumeric, hyphens, underscores
function sanitizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawLegionId = searchParams.get('legionId');

    if (!rawLegionId) {
      return NextResponse.json({ error: 'legionId required' }, { status: 400 });
    }

    const legionId = sanitizeId(rawLegionId);
    const admin = initAdmin();
    if (!admin) return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });

    const db = admin.db;
    const legionSnap = await db.ref(`legions/${legionId}`).get();

    if (!legionSnap.exists()) {
      return NextResponse.json({ error: 'Legion not found' }, { status: 404 });
    }

    const legion = legionSnap.val();

    // Verify the requesting user is the coach of this legion
    if (legion.coachUid !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden: not the coach of this legion' }, { status: 403 });
    }

    const athleteUids = Object.keys(legion.athleteUids ?? {});

    const athletes = await Promise.all(
      athleteUids.map(async (uid) => {
        const [profileSnap, statusSnap, recoverySnap, injuriesSnap] = await Promise.all([
          db.ref(`users/${uid}`).get(),
          db.ref(`daily_status/${uid}`).get(),
          db.ref(`recovery/${uid}`).get(),
          db.ref(`injuries/${uid}`).get(),
        ]);

        const profile = profileSnap.val();
        const statuses = statusSnap.exists() ? Object.values(statusSnap.val() as object) : [];
        const recoveries = recoverySnap.exists() ? Object.values(recoverySnap.val() as object) : [];
        const injuries = injuriesSnap.exists() ? Object.values(injuriesSnap.val() as object) : [];

        return {
          profile,
          latestStatus: (statuses as any[]).sort((a, b) => b.date - a.date)[0] ?? null,
          latestRecovery: (recoveries as any[]).sort((a, b) => b.date - a.date)[0] ?? null,
          injuries,
        };
      })
    );

    return NextResponse.json({ athletes, legion });
  } catch (error) {
    console.error('Athletes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
