
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase'; // Added db
import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore'; // Added Firestore imports
import type { User as AppUser } from '@/lib/types'; // Renamed to avoid conflict
import { FullPageLoader } from '@/components/common/full-page-loader';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: AppUser | null; // Added userProfile
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null); // Added userProfile state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Keep loading true until profile is also fetched
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap: DocumentSnapshot<AppUser> = await getDoc(userDocRef) as DocumentSnapshot<AppUser>;
          if (userDocSnap.exists()) {
            setUserProfile({ id: userDocSnap.id, ...userDocSnap.data() } as AppUser);
          } else {
            console.warn(`No Firestore profile found for user UID: ${firebaseUser.uid}. Role-based access will be limited.`);
            setUserProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
     return <FullPageLoader />;
  }

  return <AuthContext.Provider value={{ user, userProfile, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

