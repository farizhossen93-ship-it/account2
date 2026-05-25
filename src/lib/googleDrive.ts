import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App for authentication
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request the drive.file scope which gives access to files created/opened by this specific app
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize Google OAuth listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Initiate Google login POPUP to fetch access token
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain secure Google OAuth access token from authorization gateway.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Auth Popup failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Fetch token check
export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Logout from Google profile
export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// ---------------- Google Drive REST API Backup Services ----------------

// 1. Upload dynamic vault JSON payload to Google Drive
export const uploadVaultToGoogleDrive = async (filename: string, vaultData: any) => {
  const token = cachedAccessToken;
  if (!token) throw new Error('Unauthenticated user. Please connect Google Drive first.');

  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const boundary = 'google_drive_vault_sync';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const body = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(vaultData) +
    close_delim;

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Google Drive Upload API rejection: ${errorText || resp.statusText}`);
  }

  return await resp.json();
};

// 2. Discover files matching our signature
export const listGoogleDriveVaultBackups = async () => {
  const token = cachedAccessToken;
  if (!token) return [];

  // Find json files starting with "vault_backup_" in Google Drive
  const query = encodeURIComponent("name contains 'vault_backup_' and mimeType = 'application/json' and trashed = false");
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime)&orderBy=createdTime+desc`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    console.error('Failed to list items from Google Drive API');
    return [];
  }

  const result = await resp.json();
  return result.files || [];
};

// 3. Download the actual content of a specific backup file
export const downloadVaultFromGoogleDrive = async (fileId: string) => {
  const token = cachedAccessToken;
  if (!token) throw new Error('Google Drive account is not connected.');

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Google Drive download request failed: ${resp.statusText}`);
  }

  return await resp.json();
};
