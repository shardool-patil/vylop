import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import CodeEditor from './components/CodeEditor';
import Auth from './components/Auth';
import { Toaster } from 'react-hot-toast'; // Added Toaster for notifications
import './App.css';

function App() {
  return (
    <Router>
      {/* Toast Notification Provider */}
      <Toaster position="top-right" />
      
      <Routes>
        {/* Dashboard / Home Route */}
        <Route path="/" element={<Home />} />
        
        {/* Auth Route - Handles Login, Register, AND Google Redirects */}
        <Route path="/auth" element={<Auth />} />
        
        {/* Code Editor Room Route */}
        <Route path="/room/:roomId" element={<CodeEditor />} />
      </Routes>
    </Router>
  );
}

export default App;