
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDpNW26GrgBY0e7A7eRxFTik1TlhmhTmXE",
  authDomain: "workflow3-9c945.firebaseapp.com",
  projectId: "workflow3-9c945",
  storageBucket: "workflow3-9c945.firebasestorage.app",
  messagingSenderId: "891257281547",
  appId: "1:891257281547:web:bdaa7facf26a7adf1fbb0e",
  measurementId: "G-1YZSDG759P"
};

// Define which keys are absolutely critical for basic Firebase initialization and auth
const CRITICAL_CONFIG_KEYS: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket', // Added storageBucket as critical for this feature
];

const missingCriticalKeys = CRITICAL_CONFIG_KEYS.filter(
  key => !firebaseConfig[key]
);

if (missingCriticalKeys.length > 0) {
  const missingEnvVars = missingCriticalKeys
    .map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
    .join(', ');
  const errorMessage =
    `CRITICAL FIREBASE CONFIG ERROR: The following environment variables are missing or undefined: ${missingEnvVars}. ` +
    `Please ensure they are correctly set in your .env.local file and that you have restarted your development server. ` +
    `Firebase cannot be initialized.`;
  console.error(errorMessage);
  // Throwing an error here will stop the application and make the config issue very clear.
  throw new Error(errorMessage);
}

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export { db, auth, storage };

