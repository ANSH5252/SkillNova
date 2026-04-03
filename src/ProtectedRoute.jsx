import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { currentUser, isAdmin, isFetchingRole } = useAuth(); // Bring in the new state
  const location = useLocation();

  // --- THE FIX: MAKE THE BOUNCER WAIT ---
  if (isFetchingRole) {
    return (
      <div className="min-h-screen bg-[#04060d] flex items-center justify-center">
         <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    // Kick them to login, but save the URL they were trying to access
    return <Navigate to="/login" state={{ intendedPath: location.pathname }} replace />;
  }

  // If the route requires an admin, but the user isn't one, kick them to the student dashboard
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/student" replace />;
  }

  return children;
}