import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import GraphView from './pages/GraphView';
import AccountDetail from './pages/AccountDetail';
import AlertsView from './pages/AlertsView';
import RingGraph from './pages/RingGraph';
import Landing from './pages/Landing';
import Login from './pages/Login';
import { api } from './api';
import { ToastContainer } from './components/Toast';

function App() {
  const [datasetId, setDatasetId] = useState('ds_001');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  // Auth state – persisted via sessionStorage for demo
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('aura_auth') === 'true'
  );
  const [operator, setOperator] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('aura_operator') || 'null'); } catch { return null; }
  });

  const handleLogin = (op) => {
    const info = op || { name: 'Operator', clearance: 'ALPHA-II', id: 'unknown' };
    sessionStorage.setItem('aura_auth', 'true');
    sessionStorage.setItem('aura_operator', JSON.stringify(info));
    setIsAuthenticated(true);
    setOperator(info);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aura_auth');
    sessionStorage.removeItem('aura_operator');
    setIsAuthenticated(false);
    setOperator(null);
  };

  const handleResetDataset = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Step 1: Generate dataset
      const genRes = await api.generateDataset({
        num_accounts: 200,
        num_transactions: 2500,
        fraud_intensity: 'medium',
        seed: 42
      });

      // Step 2: Analyze
      await api.analyzeDataset(genRes.dataset_id);

      setDatasetId(genRes.dataset_id);
    } catch (err) {
      console.error(err);
      setError('Dataset rebuild pipeline failed. Verify connectivity.');
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Protected console wrapper ──────────────────────────────────────── */
  const ConsoleLayout = ({ children }) => (
    <div className="min-h-screen bg-aura-bg flex flex-col font-sans selection:bg-aura-accent/30 selection:text-white">
      <Header 
        currentDataset={datasetId} 
        onResetDataset={handleResetDataset}
        isGenerating={isGenerating}
        onLogout={handleLogout}
        operator={operator}
      />

      {isGenerating && (
        <div className="bg-aura-accent/15 border-b border-aura-accent/30 py-2 text-center text-xs font-mono text-aura-accent animate-pulse">
          PIPELINE_RESET_IN_PROGRESS: Rebuilding database topology and anomalies...
        </div>
      )}

      {error && (
        <div className="bg-aura-critical/15 border-b border-aura-critical/30 py-2 text-center text-xs font-mono text-aura-critical">
          SYSTEM_ERROR: {error}
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-aura-border bg-aura-panel/50 py-4 text-center text-xs font-mono text-aura-textMuted">
        AURA Consolidated Ops Console &bull; Security Level: {operator?.clearance || 'Alpha-III'} &bull;
        {operator ? ` Operator: ${operator.name} ·` : ''} Seed: 42
      </footer>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ──────────────────────────────────────────── */}
        <Route path="/landing" element={<Landing />} />
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/" replace />
              : <Login onLogin={handleLogin} />
          }
        />

        {/* ── Root: redirect to landing if not authed ─────────────── */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? (
                <ConsoleLayout>
                  <Dashboard 
                    datasetId={datasetId} 
                    onDatasetGenerated={(id) => setDatasetId(id)} 
                  />
                </ConsoleLayout>
              )
              : <Landing />
          }
        />

        {/* ── Protected console routes ────────────────────────────── */}
        <Route
          path="/graph"
          element={
            isAuthenticated
              ? <ConsoleLayout><GraphView /></ConsoleLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/graph/:accountId"
          element={
            isAuthenticated
              ? <ConsoleLayout><GraphView /></ConsoleLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/ring/:alertId"
          element={
            isAuthenticated
              ? <ConsoleLayout><RingGraph /></ConsoleLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/account/:accountId"
          element={
            isAuthenticated
              ? <ConsoleLayout><AccountDetail /></ConsoleLayout>
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/alerts"
          element={
            isAuthenticated
              ? <ConsoleLayout><AlertsView datasetId={datasetId} /></ConsoleLayout>
              : <Navigate to="/login" replace />
          }
        />

        {/* ── Fallback ─────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
