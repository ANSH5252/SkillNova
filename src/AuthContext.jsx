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
  const [isFetchingRole, setIsFetchingRole] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsFetchingRole(true); 
      
      if (user) {
        try {
          // 1. Check if they are an Admin/Partner
          const adminDocRef = doc(db, 'admins', user.email);
          const adminDocSnap = await getDoc(adminDocRef);
          
          if (adminDocSnap.exists()) {
            const data = adminDocSnap.data();
            setIsAdmin(true);
            setUserRole(data.role || 'partner'); 
            setTenantId(data.tenantId || null);  
          } else {
            // 2. Not an Admin. Are they a pre-registered Premium Student?
            const studentDocRef = doc(db, 'allowed_students', user.email);
            const studentDocSnap = await getDoc(studentDocRef);

            if (studentDocSnap.exists()) {
              // University pre-registered them!
              const studentData = studentDocSnap.data();
              setIsAdmin(false);
              setUserRole('student');
              setTenantId(studentData.tenantId); // Auto-assign to cohort
            } else {
              // Standard Free Tier Student
              setIsAdmin(false);
              setUserRole('student');
              setTenantId('public'); 
            }
          }
        } catch (error) {
          console.error("Error checking auth status:", error);
          setIsAdmin(false);
          setUserRole('student');
          setTenantId('public');
        }
      } else {
        setIsAdmin(false);
        setUserRole('student');
        setTenantId(null);
      }
      
      setIsFetchingRole(false); 
      setLoading(false); 
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    userRole,
    tenantId,
    isFetchingRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}