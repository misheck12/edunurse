import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateWizard from './pages/CreateWizard';
import Editor from './pages/Editor';
import Library from './pages/Library';
import Curriculum from './pages/Curriculum';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Help from './pages/Help';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateWizard />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/library" element={<Library />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;