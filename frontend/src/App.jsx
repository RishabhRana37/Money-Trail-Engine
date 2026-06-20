import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import GraphView from './pages/GraphView';
import AccountDetail from './pages/AccountDetail';
import AlertsView from './pages/AlertsView';
import { api } from './api';

function App() {
  const [datasetId, setDatasetId] = useState('ds_001');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-aura-bg flex flex-col font-sans selection:bg-aura-accent/30 selection:text-white">
        
        {/* Top Navbar */}
        <Header 
          currentDataset={datasetId} 
          onResetDataset={handleResetDataset}
          isGenerating={isGenerating}
        />

        {/* Global Pipeline Rebuilding Banner */}
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

        {/* Screen Workspace */}
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  datasetId={datasetId} 
                  onDatasetGenerated={(id) => setDatasetId(id)} 
                />
              } 
            />
            <Route 
              path="/graph" 
              element={<GraphView />} 
            />
            {/* Direct route to a ring alert or node */}
            <Route 
              path="/graph/:accountId" 
              element={<GraphView />} 
            />
            <Route 
              path="/ring/:alertId" 
              element={<GraphView />} 
            />
            <Route 
              path="/account/:accountId" 
              element={<AccountDetail />} 
            />
            <Route 
              path="/alerts" 
              element={<AlertsView datasetId={datasetId} />} 
            />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-aura-border bg-aura-panel/50 py-4 text-center text-xs font-mono text-aura-textMuted">
          AURA Consolidated Ops Console &bull; Security Level: Alpha-III &bull; Seed: 42
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
