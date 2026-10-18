import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { GoalType, PerformanceResponse } from '../types/api';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Database,
  Layers,
  Info,
  Calendar,
  CheckCircle,
} from 'lucide-react';

export const ModelPerformanceScreen: React.FC = () => {
  const [goal, setGoal] = useState<GoalType>('regression');
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async (selectedGoal: GoalType) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPerformance(selectedGoal);
      setPerformance(data);
    } catch (err: any) {
      setError(err.message || `Failed to fetch performance report for ${selectedGoal}`);
      setPerformance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance(goal);
  }, [goal]);

  const isRegression = goal === 'regression';
  const models = performance?.models || [];

  // Chart data preparation without inventing metrics
  const regressionChartData = models
    .filter((m) => m.metrics && m.metrics.mae !== undefined && m.metrics.rmse !== undefined)
    .map((m) => ({
      name: m.name.replace(' Regressor', '').replace(' Regression', ''),
      MAE: Number(m.metrics.mae),
      RMSE: Number(m.metrics.rmse),
    }));

  const classificationChartData = models
    .filter((m) => m.metrics && m.metrics.accuracy !== undefined && m.metrics.f1_macro !== undefined)
    .map((m) => ({
      name: m.name.replace(' Classifier', '').replace(' (SVC)', ''),
      Accuracy: Number((m.metrics.accuracy * 100).toFixed(1)),
      MacroF1: Number((m.metrics.f1_macro * 100).toFixed(1)),
    }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <BarChart3 size={14} aria-hidden="true" />
            <span>Offline Verification & Metrics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-main">Model Performance</h1>
          <p className="text-sm text-secondary mt-1">
            Genuine offline evaluation metrics generated from canonical test set and cross-validation pipelines.
          </p>
        </div>

        {/* Goal Toggle */}
        <div className="flex rounded-xl bg-canvas p-1 border border-border self-start sm:self-auto" role="radiogroup" aria-label="Goal selector">
          <button
            type="button"
            onClick={() => setGoal('regression')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              goal === 'regression'
                ? 'bg-card text-primary shadow-sm'
                : 'text-secondary hover:text-main'
            }`}
            role="radio"
            aria-checked={goal === 'regression'}
          >
            <TrendingUp size={14} className="mr-1.5" aria-hidden="true" />
            Regression
          </button>
          <button
            type="button"
            onClick={() => setGoal('classification')}
            className={`flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              goal === 'classification'
                ? 'bg-card text-primary shadow-sm'
                : 'text-secondary hover:text-main'
            }`}
            role="radio"
            aria-checked={goal === 'classification'}
          >
            <ShieldAlert size={14} className="mr-1.5" aria-hidden="true" />
            Classification
          </button>
        </div>
      </div>

      {/* Dataset & Evaluation Metadata Banner */}
      {performance && (
        <div className="rounded-2xl bg-card border border-border p-5 shadow-card grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              <Database size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Evaluation Dataset</div>
              <div className="text-xs font-bold text-main mt-0.5 truncate max-w-[200px]" title={performance.dataset}>
                {performance.dataset}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              <Layers size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Evaluation Strategy</div>
              <div className="text-xs font-bold text-main mt-0.5 truncate max-w-[200px]" title={performance.evaluation_strategy}>
                {performance.evaluation_strategy}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              <CheckCircle size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Test Sample Count</div>
              <div className="text-xs font-bold font-mono text-main mt-0.5">
                {performance.test_sample_count} students (20% split)
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              <Calendar size={18} aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs text-secondary font-medium">Report Generated</div>
              <div className="text-xs font-mono text-secondary mt-0.5 truncate">
                {performance.generated_at ? new Date(performance.generated_at).toLocaleDateString() : 'Phase 1 Run'}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <ErrorMessage
          title="Performance Data Unavailable"
          message={error}
          onRetry={() => fetchPerformance(goal)}
        />
      )}

      {loading ? (
        <LoadingSpinner label={`Loading ${goal} evaluation benchmarks...`} fullHeight />
      ) : performance && models.length > 0 ? (
        <div className="space-y-6">
          {/* Comparison Bar Chart */}
          <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-main">
                  {isRegression ? 'Model Error Comparison (Test Set)' : 'Classification Accuracy & F1 Comparison'}
                </h2>
                <p className="text-xs text-secondary">
                  {isRegression
                    ? 'Lower MAE and RMSE indicate superior predictive accuracy on held-out students.'
                    : 'Higher accuracy and macro F1 indicate superior balance across pass and fail classes.'}
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {isRegression ? (
                  <BarChart
                    data={regressionChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E3F0" vertical={false} />
                    <XAxis dataKey="name" stroke="#625C78" fontSize={11} />
                    <YAxis stroke="#625C78" fontSize={11} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E7E3F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="MAE" fill="#6855F5" radius={[4, 4, 0, 0]} name="Test MAE (lower is better)" />
                    <Bar dataKey="RMSE" fill="#92520A" radius={[4, 4, 0, 0]} name="Test RMSE (lower is better)" />
                  </BarChart>
                ) : (
                  <BarChart
                    data={classificationChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E3F0" vertical={false} />
                    <XAxis dataKey="name" stroke="#625C78" fontSize={11} />
                    <YAxis stroke="#625C78" fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E7E3F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val}%`]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Accuracy" fill="#087F70" radius={[4, 4, 0, 0]} name="Test Accuracy (%)" />
                    <Bar dataKey="MacroF1" fill="#6855F5" radius={[4, 4, 0, 0]} name="Test Macro F1 (%)" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full Metrics Table */}
          <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-base font-semibold text-main">
                {isRegression ? 'Fitted Regression Algorithm Metrics' : 'Fitted Classification Algorithm Metrics'}
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                Exact test set evaluations on {performance.test_sample_count} students alongside 5-fold cross-validation results.
              </p>
            </div>

            <div className="overflow-x-auto">
              {isRegression ? (
                <table className="w-full text-left text-sm" aria-label="Regression model performance table">
                  <thead>
                    <tr className="border-b border-border bg-canvas/60 text-xs text-secondary font-semibold uppercase tracking-wider">
                      <th scope="col" className="py-3 px-4">Model Name</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Test MAE</th>
                      <th scope="col" className="py-3 px-4">Test RMSE</th>
                      <th scope="col" className="py-3 px-4">Test R²</th>
                      <th scope="col" className="py-3 px-4">CV MAE (Mean ± Std)</th>
                      <th scope="col" className="py-3 px-4">CV RMSE (Mean ± Std)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {models.map((m) => {
                      const t = m.metrics || {};
                      const cv = m.cv_metrics || {};
                      return (
                        <tr key={m.model_id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-main text-sm">{m.name}</div>
                            <div className="text-[11px] font-mono text-secondary">{m.model_id} (v{m.version})</div>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge
                              status={m.status === 'evaluated' ? 'success' : 'neutral'}
                              label={m.status}
                              size="sm"
                              icon={false}
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-main">
                            {t.mae !== undefined ? Number(t.mae).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-main">
                            {t.rmse !== undefined ? Number(t.rmse).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-secondary">
                            {t.r2 !== undefined ? Number(t.r2).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-secondary">
                            {cv.cv_mae_mean !== undefined
                              ? `${Number(cv.cv_mae_mean).toFixed(3)} ± ${Number(cv.cv_mae_std || 0).toFixed(3)}`
                              : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-secondary">
                            {cv.cv_rmse_mean !== undefined
                              ? `${Number(cv.cv_rmse_mean).toFixed(3)} ± ${Number(cv.cv_rmse_std || 0).toFixed(3)}`
                              : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-sm" aria-label="Classification model performance table">
                  <thead>
                    <tr className="border-b border-border bg-canvas/60 text-xs text-secondary font-semibold uppercase tracking-wider">
                      <th scope="col" className="py-3 px-4">Model Name</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Accuracy</th>
                      <th scope="col" className="py-3 px-4">Macro Precision</th>
                      <th scope="col" className="py-3 px-4">Macro Recall</th>
                      <th scope="col" className="py-3 px-4">Macro F1</th>
                      <th scope="col" className="py-3 px-4">Fail Class Recall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {models.map((m) => {
                      const t = m.metrics || {};
                      const failRecall = t.fail_class_metrics?.recall;
                      return (
                        <tr key={m.model_id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-main text-sm">{m.name}</div>
                            <div className="text-[11px] font-mono text-secondary">{m.model_id} (v{m.version})</div>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge
                              status={m.status === 'evaluated' ? 'success' : 'neutral'}
                              label={m.status}
                              size="sm"
                              icon={false}
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-main">
                            {t.accuracy !== undefined ? `${(Number(t.accuracy) * 100).toFixed(1)}%` : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-secondary">
                            {t.precision_macro !== undefined ? Number(t.precision_macro).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-secondary">
                            {t.recall_macro !== undefined ? Number(t.recall_macro).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-main">
                            {t.f1_macro !== undefined ? Number(t.f1_macro).toFixed(3) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-warning">
                            {failRecall !== undefined ? `${(Number(failRecall) * 100).toFixed(1)}%` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Classification Confusion Matrices (Only for classification models) */}
          {!isRegression && (
            <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
              <h2 className="text-base font-semibold text-main flex items-center">
                <ShieldAlert size={18} className="text-warning mr-2" aria-hidden="true" />
                Test Set Confusion Matrices
              </h2>
              <p className="text-xs text-secondary">
                Rows represent ground truth test labels; columns represent predicted classes. Evaluated on {performance.test_sample_count} students.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {models.map((m) => {
                  const cm = m.metrics?.confusion_matrix;
                  if (!cm || !cm.matrix) return null;
                  const [rowFail, rowPass] = cm.matrix;
                  const [tn, fp] = rowFail;
                  const [fn, tp] = rowPass;

                  return (
                    <div key={m.model_id} className="p-4 rounded-xl border border-border bg-canvas/40 space-y-2">
                      <div className="font-semibold text-xs text-main truncate" title={m.name}>
                        {m.name}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-center text-xs font-mono">
                        <div className="bg-card p-2 rounded-lg border border-border">
                          <span className="text-[10px] text-secondary block font-sans">True Fail (TN)</span>
                          <span className="text-sm font-bold text-success">{tn}</span>
                        </div>
                        <div className="bg-card p-2 rounded-lg border border-border">
                          <span className="text-[10px] text-secondary block font-sans">False Pass (FP)</span>
                          <span className="text-sm font-bold text-danger">{fp}</span>
                        </div>
                        <div className="bg-card p-2 rounded-lg border border-border">
                          <span className="text-[10px] text-secondary block font-sans">False Fail (FN)</span>
                          <span className="text-sm font-bold text-danger">{fn}</span>
                        </div>
                        <div className="bg-card p-2 rounded-lg border border-border">
                          <span className="text-[10px] text-secondary block font-sans">True Pass (TP)</span>
                          <span className="text-sm font-bold text-success">{tp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Academic Evaluation Methodology & Baseline Disclosure */}
          <div className="rounded-xl border border-border bg-canvas p-4 text-xs text-secondary flex items-start space-x-2.5">
            <Info size={16} className="text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="leading-relaxed space-y-1.5">
              <div>
                <strong className="text-main font-semibold">Evaluation Methodology Notice:</strong> Offline metrics are evaluated strictly on the frozen 20% held-out test split (79 samples) and 5-fold cross-validation on the 80% training split (316 samples). Individual student predictions represent runtime inference estimations and are not confused with offline evaluation reports.
              </div>
              <div>
                <strong className="text-main font-semibold">Benchmark Baseline Disclosure:</strong> The non-parametric heuristic baseline (G3 = G2) achieves a test MAE of 1.1013 (CV MAE 0.9279), which is slightly lower in mean absolute error than the selected Random Forest Regressor (test MAE 1.1154). However, Random Forest delivers substantially superior quadratic error control, achieving a lower test RMSE (1.7787 vs 2.0531, a 13.4% reduction in RMSE / 24.9% reduction in MSE) and higher variance explained (R² 0.8425 vs 0.7901), effectively penalizing large prediction errors.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-8 text-center">
          <p className="text-sm text-secondary">
            No evaluation performance information is currently available.
          </p>
        </div>
      )}
    </div>
  );
};
