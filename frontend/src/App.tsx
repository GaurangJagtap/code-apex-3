import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { NewRun } from './pages/NewRun';
import { Exploration } from './pages/Exploration';
import { TestRuns } from './pages/TestRuns';
import { TestCases } from './pages/TestCases';
import { BugReports } from './pages/BugReports';
import { BugDetail } from './pages/BugDetail';
import { RegressionTests } from './pages/RegressionTests';
import { Benchmark } from './pages/Benchmark';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Marketing & Hero Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Operational QA Application Workspace */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
            <Route path="/new-run" element={<NewRun />} />
            <Route path="/explore" element={<Exploration />} />
            <Route path="/runs" element={<TestRuns />} />
            <Route path="/test-cases" element={<TestCases />} />
            <Route path="/baselines" element={<Navigate to="/test-cases" replace />} />
            <Route path="/bugs" element={<BugReports />} />
            <Route path="/bugs/:bugId" element={<BugDetail />} />
            <Route path="/regression" element={<RegressionTests />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Catch-all redirect to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

