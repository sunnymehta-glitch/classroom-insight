import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewScreen } from './screens/OverviewScreen';
import { NewPredictionScreen } from './screens/NewPredictionScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ModelPerformanceScreen } from './screens/ModelPerformanceScreen';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas">
        {/* Left Collapsible Sidebar */}
        <Sidebar />

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          {/* Top System Health and Context Header */}
          <Header />

          {/* Page Canvas */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-canvas">
            <Routes>
              <Route path="/" element={<OverviewScreen />} />
              <Route path="/predict" element={<NewPredictionScreen />} />
              <Route path="/results/:id" element={<ResultsScreen />} />
              <Route path="/history" element={<HistoryScreen />} />
              <Route path="/performance" element={<ModelPerformanceScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
