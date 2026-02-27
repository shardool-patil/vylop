import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import CodeEditor from './components/CodeEditor';
import Auth from './components/Auth';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* --- NEW: Authentication Route --- */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/room/:roomId" element={<CodeEditor />} />
      </Routes>
    </Router>
  );
}

export default App;