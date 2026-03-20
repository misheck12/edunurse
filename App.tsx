import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import OpsLayout from './components/OpsLayout';
import Login from './pages/Login';
import ClientSignIn from './pages/ClientSignIn';
import ClientSignUp from './pages/ClientSignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import CreateWizard from './pages/CreateWizard';
import Editor from './pages/Editor';
import Library from './pages/Library';
import Exports from './pages/Exports';
import Curriculum from './pages/Curriculum';
import AssignmentSupport from './pages/AssignmentSupport';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Help from './pages/Help';
// New Student Tools
import DrugCalculator from './pages/DrugCalculator';
import ClinicalCases from './pages/ClinicalCases';
import ProcedureChecklists from './pages/ProcedureChecklists';
import Flashcards from './pages/Flashcards';
import MedicalTerms from './pages/MedicalTerms';
import Resources from './pages/Resources';
import ClinicalLogbook from './pages/ClinicalLogbook';
import NMCExamPrep from './pages/NMCExamPrep';
import OSCEPractice from './pages/OSCEPractice';
import CareerPlacement from './pages/CareerPlacement';
import UserProfile from './pages/UserProfile';
import OpsDashboard from './pages/OpsDashboard';
import OpsOverviewPage from './pages/ops/OpsOverviewPage';
import OpsUsersPage from './pages/ops/OpsUsersPage';
import OpsConnectorsPage from './pages/ops/OpsConnectorsPage';
import OpsServicesPage from './pages/ops/OpsServicesPage';
import OpsSubscriptionsPage from './pages/ops/OpsSubscriptionsPage';
import OpsPlansPage from './pages/ops/OpsPlansPage';
import OpsTransactionsPage from './pages/ops/OpsTransactionsPage';
import OpsAiPage from './pages/ops/OpsAiPage';
import OpsSyllabusPage from './pages/ops/OpsSyllabusPage';
import OpsSettingsPage from './pages/ops/OpsSettingsPage';
import { DocumentProvider } from './src/context/DocumentContext';
import { AuthProvider } from './src/context/AuthContext';
import { UsageProvider } from './src/context/UsageContext';
import { FeatureAccessProvider, FeatureGate } from './src/components/FeatureGate';
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
        path="/ops/plans"
        element={
          <RequireAdmin>
            <OpsPlansPage />
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
      <Route
        path="/ops/settings"
        element={
          <RequireAdmin>
            <OpsSettingsPage />
          </RequireAdmin>
        }
      />
      <Route path="/ops/*" element={<Navigate to="/ops" replace />} />
    </Routes>
  </OpsLayout>
);

const ClientShell: React.FC = () => (
  <DocumentProvider>
    <UsageProvider>
      <FeatureAccessProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateWizard />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/editor/:documentId" element={<Editor />} />
            <Route path="/library" element={<Library />} />
            <Route path="/exports" element={<Exports />} />
            <Route path="/curriculum" element={
              <FeatureGate feature="curriculum_ai">
                <Curriculum />
              </FeatureGate>
            } />
            <Route path="/assignment-support" element={
              <FeatureGate feature="assignments">
                <AssignmentSupport />
              </FeatureGate>
            } />
            <Route path="/templates" element={
              <FeatureGate feature="templates">
                <Templates />
              </FeatureGate>
            } />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/help" element={<Help />} />
          {/* Student Tools Routes */}
          <Route path="/drug-calculator" element={<DrugCalculator />} />
          <Route path="/clinical-cases" element={
            <FeatureGate feature="clinical_cases">
              <ClinicalCases />
            </FeatureGate>
          } />
          <Route path="/procedures" element={
            <FeatureGate feature="procedures">
              <ProcedureChecklists />
            </FeatureGate>
          } />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/medical-terms" element={
            <FeatureGate feature="medical_terms">
              <MedicalTerms />
            </FeatureGate>
          } />
          <Route path="/resources" element={<Resources />} />
          <Route path="/logbook" element={
            <FeatureGate feature="clinical_logbook">
              <ClinicalLogbook />
            </FeatureGate>
          } />
          <Route path="/exam-prep" element={
            <FeatureGate feature="nmc_exam_prep">
              <NMCExamPrep />
            </FeatureGate>
          } />
          <Route path="/osce" element={
            <FeatureGate feature="osce_practice">
              <OSCEPractice />
            </FeatureGate>
          } />
          <Route path="/career" element={
            <FeatureGate feature="career">
              <CareerPlacement />
            </FeatureGate>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </FeatureAccessProvider>
  </UsageProvider>
</DocumentProvider>
);

const ClientAuthShell: React.FC = () => (
  <Routes>
    <Route path="/signin" element={<ClientSignIn />} />
    <Route path="/signup" element={<ClientSignUp />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
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
