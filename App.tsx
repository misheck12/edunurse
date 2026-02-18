import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import OpsLayout from './components/OpsLayout';
import Login from './pages/Login';
import ClientSignIn from './pages/ClientSignIn';
import ClientSignUp from './pages/ClientSignUp';
import Dashboard from './pages/Dashboard';
import CreateWizard from './pages/CreateWizard';
import Editor from './pages/Editor';
import Library from './pages/Library';
import Exports from './pages/Exports';
import Curriculum from './pages/Curriculum';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Help from './pages/Help';
import OpsDashboard from './pages/OpsDashboard';
import OpsOverviewPage from './pages/ops/OpsOverviewPage';
import OpsUsersPage from './pages/ops/OpsUsersPage';
import OpsConnectorsPage from './pages/ops/OpsConnectorsPage';
import OpsServicesPage from './pages/ops/OpsServicesPage';
import OpsSubscriptionsPage from './pages/ops/OpsSubscriptionsPage';
import OpsTransactionsPage from './pages/ops/OpsTransactionsPage';
import OpsAiPage from './pages/ops/OpsAiPage';
import OpsSyllabusPage from './pages/ops/OpsSyllabusPage';
import { DocumentProvider } from './src/context/DocumentContext';
import { AuthProvider } from './src/context/AuthContext';
import RequireAdmin from './src/components/auth/RequireAdmin';
import RequireClient from './src/components/auth/RequireClient';
import PwaManager from './src/components/PwaManager';

const OpsShell: React.FC = () => (
  <OpsLayout>
    <Routes>
      <Route path="/ops/login" element={<Login />} />
      <Route path="/ops" element={<Navigate to="/ops/overview" replace />} />
      <Route
        path="/ops/overview"
        element={
          <RequireAdmin>
            <OpsOverviewPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/legacy"
        element={
          <RequireAdmin>
            <OpsDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/users"
        element={
          <RequireAdmin>
            <OpsUsersPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/connectors"
        element={
          <RequireAdmin>
            <OpsConnectorsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/services"
        element={
          <RequireAdmin>
            <OpsServicesPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/syllabus"
        element={
          <RequireAdmin>
            <OpsSyllabusPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/subscriptions"
        element={
          <RequireAdmin>
            <OpsSubscriptionsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/transactions"
        element={
          <RequireAdmin>
            <OpsTransactionsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/ai"
        element={
          <RequireAdmin>
            <OpsAiPage />
          </RequireAdmin>
        }
      />
      <Route path="/ops/*" element={<Navigate to="/ops" replace />} />
    </Routes>
  </OpsLayout>
);

const ClientShell: React.FC = () => (
  <DocumentProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateWizard />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:documentId" element={<Editor />} />
        <Route path="/library" element={<Library />} />
        <Route path="/exports" element={<Exports />} />
        <Route path="/curriculum" element={<Curriculum />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  </DocumentProvider>
);

const ClientAuthShell: React.FC = () => (
  <Routes>
    <Route path="/signin" element={<ClientSignIn />} />
    <Route path="/signup" element={<ClientSignUp />} />
    <Route path="/login" element={<Navigate to="/signin" replace />} />
    <Route path="*" element={<Navigate to="/signin" replace />} />
  </Routes>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const isOpsPath = location.pathname.startsWith("/ops");
  const isClientAuthPath =
    location.pathname === "/signin" ||
    location.pathname === "/signup" ||
    location.pathname === "/login";

  if (isOpsPath) {
    return <OpsShell />;
  }

  if (isClientAuthPath) {
    return <ClientAuthShell />;
  }

  return (
    <RequireClient>
      <ClientShell />
    </RequireClient>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <PwaManager />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
