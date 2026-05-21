import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Workspace scopes requested by the Firebase popup:
// - calendar.events: create Calendar events from selected page content.
// - tasks: create Google Tasks from selected page content.
// - drive.readonly: list/import existing Google Docs and text files.
// - drive.file: explicitly create/manage Drive files and folders made by this app.
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({ prompt: 'consent' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let googleUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      googleUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      googleUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google sign-in completed, but Firebase did not return a Google access token. Try Link Workspace again and approve Drive access.');
    }

    cachedAccessToken = credential.accessToken;
    googleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    cachedAccessToken = null;
    const code = error?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in was cancelled before Drive access was approved.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('The browser blocked the Google sign-in popup. Allow popups for this app and try again.');
    }
    if (code === 'auth/cancelled-popup-request') {
      throw new Error('A newer Google sign-in popup replaced the previous request. Finish the latest popup and try again if needed.');
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getUser = (): User | null => googleUser;

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  googleUser = null;
};
