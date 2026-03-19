import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { currentUser, isAdmin } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // Kick them to login, but save the URL they were trying to access in 'state'
    return <Navigate to="/login" state={{ intendedPath: location.pathname }} replace />;
  }

  // If the route requires an admin, but the user isn't one, kick them to the student dashboard
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/student" replace />;
  }

  return children;
}