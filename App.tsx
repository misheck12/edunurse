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
import OpsReferralsPage from './pages/ops/OpsReferralsPage';
import OpsAiPage from './pages/ops/OpsAiPage';
import OpsSyllabusPage from './pages/ops/OpsSyllabusPage';
import OpsSettingsPage from './pages/ops/OpsSettingsPage';
import OpsCommsPage from './pages/ops/OpsCommsPage';
import OpsMarketingPage from './pages/ops/OpsMarketingPage';
import { DocumentProvider } from './src/context/DocumentContext';
import { AuthProvider } from './src/context/AuthContext';
import { UsageProvider } from './src/context/UsageContext';
import { FeatureAccessProvider, FeatureGate } from './src/components/FeatureGate';
import RequireAdmin from './src/components/auth/RequireAdmin';
import RequireClient from './src/components/auth/RequireClient';
import RequireTermsAcceptance from './src/components/auth/RequireTermsAcceptance';
import PwaManager from './src/components/PwaManager';
import ComingSoon from './src/components/ComingSoon';
import ErrorBoundary from './src/components/ErrorBoundary';
import NotFound from './src/pages/NotFound';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';

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
        path="/ops/referrals"
        element={
          <RequireAdmin>
            <OpsReferralsPage />
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
        path="/ops/communications"
        element={
          <RequireAdmin>
            <OpsCommsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/ops/marketing"
        element={
          <RequireAdmin>
            <OpsMarketingPage />
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
          {/* Student Tools Routes — coming soon */}
          <Route path="/drug-calculator" element={<ComingSoon feature="Drug Calculator" />} />
          <Route path="/clinical-cases" element={<ComingSoon feature="Clinical Cases" />} />
          <Route path="/procedures" element={<ComingSoon feature="Procedure Checklists" />} />
          <Route path="/flashcards" element={<ComingSoon feature="Flashcards" />} />
          <Route path="/medical-terms" element={<ComingSoon feature="Medical Terminology" />} />
          <Route path="/resources" element={<ComingSoon feature="Resources" />} />
          <Route path="/logbook" element={<ComingSoon feature="Clinical Logbook" />} />
          <Route path="/exam-prep" element={
            <FeatureGate feature="nmc_exam_prep">
              <NMCExamPrep />
            </FeatureGate>
          } />
          <Route path="/osce" element={<ComingSoon feature="OSCE Practice" />} />
          <Route path="/career" element={<ComingSoon feature="Career Placement" />} />
          <Route path="*" element={<NotFound />} />
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
    <Route path="/terms" element={<TermsAndConditions />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/login" element={<Navigate to="/signin" replace />} />
    <Route path="*" element={<Navigate to="/signin" replace />} />
  </Routes>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const isOpsPath = location.pathname.startsWith("/ops");
  const clientAuthPaths = [
    "/signin",
    "/signup",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/terms",
    "/privacy",
  ];
  const isClientAuthPath = clientAuthPaths.includes(location.pathname);

  if (isOpsPath) {
    return <OpsShell />;
  }

  if (isClientAuthPath) {
    return <ClientAuthShell />;
  }

  return (
    <RequireClient>
      <RequireTermsAcceptance>
        <ClientShell />
      </RequireTermsAcceptance>
    </RequireClient>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <PwaManager />
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
