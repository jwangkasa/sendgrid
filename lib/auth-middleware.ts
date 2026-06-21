import { type NextRequest } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header');
  }

  const idToken = authHeader.slice(7);

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken, true);
    uid   = decoded.uid;
    email = decoded.email;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed';
    throw new AuthError(`Invalid Firebase ID token: ${msg}`);
  }

  if (!email) {
    throw new AuthError('Token has no email claim', 403);
  }

  const doc = await getAdminFirestore()
    .collection('allowedUsers')
    .doc(email.toLowerCase())
    .get();

  if (!doc.exists) {
    throw new AuthError('Access not granted. Contact your administrator.', 403);
  }

  return { uid, email };
}

