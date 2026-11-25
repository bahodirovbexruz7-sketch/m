import type { Auth, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let authInstance: Auth | null = null;
let isSigningIn = false;
// Access token is kept strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;
let signedOutListener: (() => void) | null = null;

async function ensureAuth(): Promise<{
  auth: Auth;
  signInWithPopup: typeof import('firebase/auth').signInWithPopup;
  GoogleAuthProvider: typeof import('firebase/auth').GoogleAuthProvider;
}> {
  const [{ initializeApp, getApps, getApp }, authMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);

  if (!authInstance) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = authMod.getAuth(app);
    authMod.onAuthStateChanged(authInstance, (user: User | null) => {
      if (!user && !isSigningIn) {
        cachedAccessToken = null;
        signedOutListener?.();
      }
    });
  }

  return {
    auth: authInstance,
    signInWithPopup: authMod.signInWithPopup,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
  };
}

export const googleSignIn = async (
  onSignedOut?: () => void
): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  if (onSignedOut) {
    signedOutListener = onSignedOut;
  }
  try {
    isSigningIn = true;
    const { auth, signInWithPopup, GoogleAuthProvider } = await ensureAuth();
    const provider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => provider.addScope(scope));
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Sheets uchun kirish ruxsati olinmadi.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  cachedAccessToken = null;
  if (authInstance) {
    await authInstance.signOut();
  }
};
