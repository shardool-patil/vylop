import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import CodeEditor from './components/CodeEditor';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { Toaster } from 'react-hot-toast';
import './App.css';

// 🔐 Protected Route Component
const ProtectedRoute = ({ children }) => {
  const username = localStorage.getItem("username");

  if (!username) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          {/* Protected Home Route */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />

          {/* Protected Dashboard Route */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          {/* Auth Route */}
          <Route path="/auth" element={<Auth />} />

          {/* Protected Code Editor Route */}
          <Route 
            path="/room/:roomId" 
            element={
              <ProtectedRoute>
                <CodeEditor />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </>
  );
}

export default App;