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

// Sanitize text inputs
function sanitizeText(input: string, maxLen: number): string {
  return input.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim().slice(0, maxLen);
}

// GET /api/legion?coachUid=xxx — fetch coach's legion
export async function GET(request: NextRequest) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const coachUid = searchParams.get('coachUid');

  if (!coachUid) return NextResponse.json({ error: 'coachUid required' }, { status: 400 });

  // Verify the requesting user is asking for their own data
  if (coachUid !== decodedToken.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = initAdmin();
  if (!admin) return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });

  const db = admin.db;
  const legionsSnap = await db.ref('legions').orderByChild('coachUid').equalTo(coachUid).get();

  if (!legionsSnap.exists()) return NextResponse.json({ legion: null });

  const legions = Object.values(legionsSnap.val() as object);
  return NextResponse.json({ legion: legions[0] });
}

// POST /api/legion — create new legion
export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { coachUid, name, sport } = body;

    if (!coachUid || !name || !sport) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the requesting user is the coach
    if (coachUid !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden: coachUid mismatch' }, { status: 403 });
    }

    // Sanitize inputs
    const cleanName = sanitizeText(name, 100);
    const cleanSport = sanitizeText(sport, 50);

    if (cleanName.length < 2) {
      return NextResponse.json({ error: 'Legion name must be at least 2 characters' }, { status: 400 });
    }

    const admin = initAdmin();
    if (!admin) return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });

    const db = admin.db;
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const newRef = db.ref('legions').push();
    const legionId = newRef.key!;

    await newRef.set({
      id: legionId,
      name: cleanName,
      coachUid,
      inviteCode,
      sport: cleanSport,
      createdAt: Date.now(),
      athleteUids: {},
    });

    await db.ref(`users/${coachUid}`).update({ legionId, legionCode: inviteCode });

    return NextResponse.json({ legionId, inviteCode });
  } catch (error) {
    console.error('Legion API error:', error);
    return NextResponse.json({ error: 'Failed to create legion' }, { status: 500 });
  }
}
