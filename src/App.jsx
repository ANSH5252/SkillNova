import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';

// View Components
import LandingPage from './LandingPage';
import AdminDashboard from './AdminDashboard';
import PartnerDashboard from './PartnerDashboard';
import EmployerDashboard from './EmployerDashboard'; 
import StudentDashboard from './StudentDashboard';
import PartnerApply from './PartnerApply';
import Login from './Login';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/apply" element={<PartnerApply />} />
          
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/partner" element={
            <ProtectedRoute requireAdmin={true}>
              <PartnerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/employer" element={
            <ProtectedRoute requireAdmin={true}>
              <EmployerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/student" element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;