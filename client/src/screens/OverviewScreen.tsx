import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  AppHealthResponse,
  HistoryItem,
  ModelInfo,
  PerformanceResponse,
} from '../types/api';
import { DisclosureBanner } from '../components/DisclosureBanner';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  Sparkles,
  History,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Database,
  Cpu,
  Award,
  Layers,
} from 'lucide-react';

export const OverviewScreen: React.FC = () => {
  const navigate = useNavigate();

  const [health, setHealth] = useState<AppHealthResponse | null>(null);
  const [recentPredictions, setRecentPredictions] = useState<HistoryItem[]>([]);
  const [regModels, setRegModels] = useState<ModelInfo[]>([]);
  const [clsModels, setClsModels] = useState<ModelInfo[]>([]);
  const [regressionPerf, setRegressionPerf] = useState<PerformanceResponse | null>(null);
  const [classificationPerf, setClassificationPerf] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        healthRes,
        historyRes,
        regModelsRes,
        clsModelsRes,
        regPerfRes,
        clsPerfRes,
      ] = await Promise.allSettled([
        api.getHealth(),
        api.getHistory({ page: 0, size: 5 }),
        api.listModels('regression'),
        api.listModels('classification'),
        api.getPerformance('regression'),
        api.getPerformance('classification'),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }
      if (historyRes.status === 'fulfilled') {
        setRecentPredictions(historyRes.value.items || []);
      }
      if (regModelsRes.status === 'fulfilled') {
        setRegModels(regModelsRes.value.models || []);
      }
      if (clsModelsRes.status === 'fulfilled') {
        setClsModels(clsModelsRes.value.models || []);
      }
      if (regPerfRes.status === 'fulfilled') {
        setRegressionPerf(regPerfRes.value);
      }
      if (clsPerfRes.status === 'fulfilled') {
        setClassificationPerf(clsPerfRes.value);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Dynamically resolve primary regression candidate and its canonical test metrics
  const primaryRegCandidate = regModels.find((m) => m.selected_primary_candidate);
  const primaryRegPerf = primaryRegCandidate
    ? regressionPerf?.models?.find((m) => m.model_id === primaryRegCandidate.model_id)
    : null;

  // Dynamically resolve primary classification candidate and its canonical test metrics
  const primaryClsCandidate = clsModels.find((m) => m.selected_primary_candidate);
  const primaryClsPerf = primaryClsCandidate
    ? classificationPerf?.models?.find((m) => m.model_id === primaryClsCandidate.model_id)
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Hero Area */}
      <div className="rounded-2xl bg-hero text-white p-6 md:p-8 shadow-card relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles size={13} className="text-primary-light" aria-hidden="true" />
            <span>Academic Performance ML Architecture</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            Classroom Insight Trajectory Estimation
          </h1>
          <p className="text-white/80 text-sm md:text-base leading-relaxed">
            Welcome to the Classroom Insight platform. Predict student mathematics trajectories, evaluate risk of academic difficulty, compare machine learning algorithms, and track verified outcomes with complete audit trails.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate('/predict')}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-hero"
            >
              <Sparkles size={16} className="mr-2" aria-hidden="true" />
              New Prediction
            </button>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <History size={16} className="mr-2" aria-hidden="true" />
              View History
            </button>
            <button
              type="button"
              onClick={() => navigate('/performance')}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/90 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <Layers size={16} className="mr-2" aria-hidden="true" />
              Model Performance
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Award size={260} aria-hidden="true" />
        </div>
      </div>

      {/* Dataset Provenance Disclosure */}
      <DisclosureBanner />

      {error && (
        <ErrorMessage
          title="Data Loading Warning"
          message={error}
          onRetry={loadData}
        />
      )}

      {/* Capabilities and Verified Model Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Regression Capability Card */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                <TrendingUp size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-main">Final Grade Estimation (G3)</h2>
                <p className="text-xs text-secondary">Regression Task · Continuous Scale [0, 20]</p>
              </div>
            </div>
            <StatusBadge status="info" label="Regression" size="sm" icon={false} />
          </div>

          <p className="text-sm text-secondary leading-relaxed mb-4">
            Estimates continuous final exam performance <code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-main font-mono">G3</code> based on period grades (<code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-main font-mono">G1</code>, <code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-main font-mono">G2</code>), study habits, past failures, and support systems.
          </p>

          {primaryRegCandidate && primaryRegPerf?.metrics?.mae !== undefined ? (
            <div className="rounded-xl bg-canvas p-4 border border-border/60">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Primary Model Highlight: {primaryRegCandidate.name}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Test MAE</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {Number(primaryRegPerf.metrics.mae).toFixed(4)}
                  </div>
                </div>
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Test RMSE</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {Number(primaryRegPerf.metrics.rmse).toFixed(4)}
                  </div>
                </div>
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Test R²</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {Number(primaryRegPerf.metrics.r2).toFixed(4)}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-secondary mt-2 text-right">
                Held-out test set ({regressionPerf?.test_sample_count ?? 79} students) · Canonical 8-feature pipeline
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-canvas p-3 text-xs text-secondary border border-border/60">
              {loading
                ? 'Loading evaluation metrics...'
                : 'Primary model evaluation metrics currently unavailable.'}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
            <span className="text-xs text-secondary">
              {regModels.length > 0
                ? `${regModels.length} fitted regression models available`
                : 'Fitted regression models'}
            </span>
            <Link
              to="/predict?goal=regression"
              className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center"
            >
              Start Regression <ArrowRight size={13} className="ml-1" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Classification Capability Card */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-warning-light flex items-center justify-center text-warning">
                <ShieldAlert size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-main">Academic Pass/Fail Screening</h2>
                <p className="text-xs text-secondary">Classification Task · Pass threshold G3 ≥ 10</p>
              </div>
            </div>
            <StatusBadge status="warning" label="Classification" size="sm" icon={false} />
          </div>

          <p className="text-sm text-secondary leading-relaxed mb-4">
            Identifies students at risk of academic failure (<code className="text-xs bg-canvas px-1.5 py-0.5 rounded text-main font-mono">G3 &lt; 10</code>) early in the term to trigger targeted academic intervention and tutoring support.
          </p>

          {primaryClsCandidate && primaryClsPerf?.metrics?.accuracy !== undefined ? (
            <div className="rounded-xl bg-canvas p-4 border border-border/60">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Primary Model Highlight: {primaryClsCandidate.name}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Test Accuracy</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {(Number(primaryClsPerf.metrics.accuracy) * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Test Macro F1</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {Number(primaryClsPerf.metrics.f1_macro).toFixed(4)}
                  </div>
                </div>
                <div className="bg-card p-2 rounded-lg border border-border/40">
                  <div className="text-xs text-secondary">Fail Recall</div>
                  <div className="text-base font-bold text-main mt-0.5 font-mono">
                    {primaryClsPerf.metrics.fail_class_metrics?.recall !== undefined
                      ? (Number(primaryClsPerf.metrics.fail_class_metrics.recall) * 100).toFixed(2) + '%'
                      : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-secondary mt-2 text-right">
                Held-out test set ({classificationPerf?.test_sample_count ?? 79} students) · Selected via CV Macro F1
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-canvas p-3 text-xs text-secondary border border-border/60">
              {loading
                ? 'Loading evaluation metrics...'
                : 'Primary model evaluation metrics currently unavailable.'}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
            <span className="text-xs text-secondary">
              {clsModels.length > 0
                ? `${clsModels.length} fitted classification models available`
                : 'Fitted classification models'}
            </span>
            <Link
              to="/predict?goal=classification"
              className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center"
            >
              Start Screening <ArrowRight size={13} className="ml-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* System Infrastructure Status Summary */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-card">
        <h2 className="text-base font-semibold text-main mb-4 flex items-center">
          <Cpu size={18} className="text-primary mr-2" aria-hidden="true" />
          System Health & Environment
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-canvas border border-border/60 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-primary">
              <Cpu size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">FastAPI ML Service</div>
              <div className="text-sm font-semibold text-main mt-0.5 flex items-center">
                {health?.components?.ml_service?.status === 'UP' ? (
                  <StatusBadge status="success" label="Connected (UP)" size="sm" />
                ) : (
                  <StatusBadge status="danger" label="Unavailable" size="sm" />
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-border/60 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-primary">
              <Database size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Spring Boot & H2 Database</div>
              <div className="text-sm font-semibold text-main mt-0.5 flex items-center">
                {health?.components?.database?.status === 'UP' ? (
                  <StatusBadge status="success" label="File-Backed H2 (UP)" size="sm" />
                ) : (
                  <StatusBadge status="danger" label="Offline" size="sm" />
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-border/60 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center text-primary">
              <Award size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Runtime Compatibility</div>
              <div className="text-sm font-semibold text-main mt-0.5">
                Java 25 LTS · Spring Boot 3.5.16
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Predictions (Sourced from persisted backend database) */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-main">Recent Predictions</h2>
            <p className="text-xs text-secondary">Persisted records from Spring Boot backend</p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center"
          >
            Full History <ArrowRight size={13} className="ml-1" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading recent predictions..." />
        ) : recentPredictions.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-canvas border border-dashed border-border">
            <History size={32} className="mx-auto text-secondary/50 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-main">No predictions recorded yet</p>
            <p className="text-xs text-secondary mt-1">
              Run your first student prediction to begin building persistent history records.
            </p>
            <button
              type="button"
              onClick={() => navigate('/predict')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Create Prediction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Recent predictions table">
              <thead>
                <tr className="border-b border-border text-xs text-secondary font-medium">
                  <th scope="col" className="pb-3 px-3">Date</th>
                  <th scope="col" className="pb-3 px-3">Student Ref</th>
                  <th scope="col" className="pb-3 px-3">Goal</th>
                  <th scope="col" className="pb-3 px-3">Mode</th>
                  <th scope="col" className="pb-3 px-3">Primary Result</th>
                  <th scope="col" className="pb-3 px-3">Status</th>
                  <th scope="col" className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentPredictions.map((item) => (
                  <tr key={item.prediction_id} className="hover:bg-canvas/60 transition-colors">
                    <td className="py-3 px-3 text-xs text-secondary font-mono">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-sm font-medium text-main">
                      {item.student_reference || <span className="text-secondary italic">None</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs font-medium capitalize text-main">
                        {item.goal}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs text-secondary capitalize">
                        {item.mode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm font-medium text-main">
                      {item.primary_result}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge
                        status={
                          item.status === 'success'
                            ? 'success'
                            : item.status === 'partial_success'
                            ? 'warning'
                            : 'danger'
                        }
                        label={item.status}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/results/${item.prediction_id}`)}
                        className="text-xs font-semibold text-primary hover:text-primary-hover"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
