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
  const [userRole, setUserRole] = useState('student'); 
  const [tenantId, setTenantId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [isFetchingRole, setIsFetchingRole] = useState(true); // --- NEW STATE ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsFetchingRole(true); // Tell the app we are checking roles
      
      if (user) {
        try {
          const adminDocRef = doc(db, 'admins', user.email);
          const adminDocSnap = await getDoc(adminDocRef);
          
          if (adminDocSnap.exists()) {
            const data = adminDocSnap.data();
            setIsAdmin(true);
            setUserRole(data.role || 'partner'); 
            setTenantId(data.tenantId || null);  
          } else {
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
        setIsAdmin(false);
        setUserRole('student');
        setTenantId(null);
      }
      
      setIsFetchingRole(false); // Done checking roles
      setLoading(false); // Done initial auth check
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    userRole,
    tenantId,
    isFetchingRole // --- EXPORT THE STATE ---
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}