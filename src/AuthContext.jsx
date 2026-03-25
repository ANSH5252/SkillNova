import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('student'); // Can be 'superadmin', 'partner', or 'student'
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener automatically fires whenever a user logs in or logs out
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Check if the logged-in email exists in the 'admins' collection in Firestore
        try {
          const adminDocRef = doc(db, 'admins', user.email);
          const adminDocSnap = await getDoc(adminDocRef);
          
          if (adminDocSnap.exists()) {
            const data = adminDocSnap.data();
            setIsAdmin(true);
            setUserRole(data.role || 'partner'); // Default to partner if role is missing
            setTenantId(data.tenantId || null);  // Link them to their university/cohort
          } else {
            // Not in the admins collection -> Standard Student
            setIsAdmin(false);
            setUserRole('student');
            setTenantId(null);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          setUserRole('student');
          setTenantId(null);
        }
      } else {
        // Logged out state
        setIsAdmin(false);
        setUserRole('student');
        setTenantId(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    userRole,
    tenantId
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}