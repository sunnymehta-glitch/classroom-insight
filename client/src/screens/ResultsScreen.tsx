import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { PredictionResponse, OutcomeRequest, OutcomeResponse } from '../types/api';
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
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  ClipboardCheck,
  X,
} from 'lucide-react';

export const ResultsScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [prediction, setPrediction] = useState<PredictionResponse | null>(
    (location.state as any)?.prediction || null
  );
  const [loading, setLoading] = useState<boolean>(!prediction);
  const [error, setError] = useState<string | null>(null);

  // Outcome recording modal state
  const [showOutcomeModal, setShowOutcomeModal] = useState<boolean>(false);
  const [actualG3, setActualG3] = useState<number>(10);
  const [outcomeSource, setOutcomeSource] = useState<string>('teacher_reported');
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState<boolean>(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (prediction && prediction.prediction_id === id) {
      setLoading(false);
      return;
    }

    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getPredictionById(id);
        setPrediction(data);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve saved prediction record.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrediction();
  }, [id]);

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submittingOutcome) return;

    if (actualG3 === undefined || actualG3 < 0 || actualG3 > 20) {
      setOutcomeError('Actual grade G3 must be an integer between 0 and 20.');
      return;
    }

    setSubmittingOutcome(true);
    setOutcomeError(null);

    const payload: OutcomeRequest = {
      actual_g3: Number(actualG3),
      source: outcomeSource.trim() || 'teacher_reported',
      verification_status: 'recorded',
      notes: outcomeNotes.trim() || undefined,
    };

    try {
      const outcomeRes: OutcomeResponse = await api.recordOutcome(id, payload);
      // Update local state with the verified outcome
      if (prediction) {
        setPrediction({
          ...prediction,
          verified_outcome: outcomeRes,
        });
      }
      setShowOutcomeModal(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setOutcomeError('An outcome has already been recorded for this prediction.');
      } else {
        setOutcomeError(err.message || 'Failed to record actual outcome.');
      }
    } finally {
      setSubmittingOutcome(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading prediction results..." fullHeight />;
  }

  if (error || !prediction) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <ErrorMessage
          title="Could Not Load Prediction Results"
          message={error || 'Prediction record not found.'}
          onRetry={() => {
            if (id) {
              setLoading(true);
              api.getPredictionById(id).then(setPrediction).catch((e) => setError(e.message)).finally(() => setLoading(false));
            }
          }}
        />
        <div className="pt-2">
          <Link
            to="/history"
            className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary-hover"
          >
            <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" />
            Back to Prediction History
          </Link>
        </div>
      </div>
    );
  }

  const isRegression = prediction.goal === 'regression';
  const successfulResults = prediction.results.filter((r) => r.status === 'success');

  // Chart data for regression comparison
  const chartData = successfulResults.map((r) => ({
    model: r.model_id.replace(/_/g, ' '),
    grade: r.predicted_grade !== null ? Number(r.predicted_grade.toFixed(2)) : 0,
    version: r.model_version,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center space-x-2 text-xs text-secondary font-mono">
            <span>ID: {prediction.prediction_id}</span>
            <span>·</span>
            <span className="flex items-center">
              <Calendar size={13} className="mr-1" aria-hidden="true" />
              {new Date(prediction.created_at).toLocaleString()}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-main mt-1">
            Prediction Results
            {prediction.student_reference && (
              <span className="text-secondary font-normal text-lg ml-2">
                ({prediction.student_reference})
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/predict')}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-main hover:bg-canvas transition-colors shadow-sm"
          >
            <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
            New Prediction
          </button>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-main hover:bg-canvas transition-colors shadow-sm"
          >
            <History size={14} className="mr-1.5" aria-hidden="true" />
            View History
          </button>
        </div>
      </div>

      {/* Outcome Status / Recording Banner */}
      {prediction.verified_outcome ? (
        <div className="rounded-2xl border border-success/30 bg-success-light/40 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CheckCircle2 size={22} className="text-success mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-bold text-success uppercase tracking-wider">
                  Verified Actual Outcome Recorded
                </h2>
                <div className="text-sm text-main mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Actual G3: <strong className="font-mono text-base">{prediction.verified_outcome.actual_g3} / 20</strong>
                  </span>
                  <span>
                    Result:{' '}
                    <strong className={prediction.verified_outcome.actual_pass_status === 'pass' ? 'text-success' : 'text-danger'}>
                      {prediction.verified_outcome.actual_pass_status.toUpperCase()}
                    </strong>
                  </span>
                  <span className="text-xs text-secondary">
                    Source: {prediction.verified_outcome.source}
                  </span>
                  <span className="text-xs text-secondary font-mono">
                    Recorded: {new Date(prediction.verified_outcome.recorded_at).toLocaleDateString()}
                  </span>
                </div>
                {prediction.verified_outcome.notes && (
                  <p className="text-xs text-secondary mt-1 italic">
                    Notes: {prediction.verified_outcome.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ClipboardCheck size={20} className="text-primary" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-main">Record Actual Student Grade</div>
              <div className="text-xs text-secondary">
                Track ground truth G3 score once final examination results are available.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowOutcomeModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Record Actual G3
          </button>
        </div>
      )}

      {/* Partial Success or Failure Alert */}
      {prediction.status === 'partial_success' && (
        <div className="rounded-xl border border-warning/40 bg-warning-light p-4 text-sm text-main flex items-start space-x-3">
          <AlertTriangle size={18} className="text-warning mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold text-warning">Partial Inference Execution</span>
            <p className="text-xs text-secondary mt-0.5">
              Some requested models encountered execution errors, but valid predictions were successfully computed by the remaining algorithms. See individual failure notices below.
            </p>
          </div>
        </div>
      )}

      {prediction.status === 'failed' && (
        <div className="rounded-xl border border-danger/40 bg-danger-light p-4 text-sm text-main flex items-start space-x-3">
          <AlertTriangle size={18} className="text-danger mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold text-danger">All Models Failed</span>
            <p className="text-xs text-secondary mt-0.5">
              No models were able to produce valid inference output.
            </p>
          </div>
        </div>
      )}

      {/* Main Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Model Results Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-main">
                  {isRegression ? 'Predicted Final Grade (G3)' : 'Predicted Academic Trajectory Risk'}
                </h2>
                <p className="text-xs text-secondary">
                  Mode: <strong className="capitalize">{prediction.mode}</strong> · Goal:{' '}
                  <strong className="capitalize">{prediction.goal}</strong>
                </p>
              </div>
              <StatusBadge
                status={prediction.status === 'success' ? 'success' : prediction.status === 'partial_success' ? 'warning' : 'danger'}
                label={prediction.status}
                size="sm"
              />
            </div>

            {/* Individual Model Result Cards */}
            <div className="space-y-3">
              {prediction.results.map((r, idx) => {
                const isSuccess = r.status === 'success';
                return (
                  <div
                    key={`${r.model_id}-${idx}`}
                    className={`p-4 rounded-xl border transition-colors ${
                      isSuccess
                        ? 'border-border bg-card'
                        : 'border-danger/30 bg-danger-light/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-main font-mono">
                          {r.model_id}
                        </span>
                        <span className="text-xs text-secondary font-mono">
                          v{r.model_version}
                        </span>
                      </div>
                      <StatusBadge
                        status={isSuccess ? 'success' : 'danger'}
                        label={isSuccess ? 'Computed' : 'Failed'}
                        size="sm"
                        icon={false}
                      />
                    </div>

                    {isSuccess ? (
                      <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-border/60">
                        {isRegression ? (
                          <div>
                            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">
                              Estimated Grade
                            </span>
                            <div className="flex items-baseline space-x-2 mt-0.5">
                              <span className="text-3xl font-bold font-mono text-primary">
                                {r.predicted_grade !== null ? r.predicted_grade.toFixed(2) : 'N/A'}
                              </span>
                              <span className="text-xs text-secondary font-mono">/ 20</span>
                            </div>
                            <span className="text-[11px] text-secondary mt-1 block">
                              Scale bounded [0.0, 20.0]. Not verified actual grade.
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs text-secondary font-medium uppercase tracking-wider block">
                              Trajectory Risk Classification
                            </span>
                            <div className="mt-1 flex items-center space-x-2">
                              <StatusBadge
                                status={r.predicted_class === 'pass' ? 'success' : 'danger'}
                                label={r.predicted_class === 'pass' ? 'PASS (G3 ≥ 10)' : 'FAIL RISK (G3 < 10)'}
                                size="md"
                              />
                            </div>
                            <span className="text-[11px] text-secondary mt-1 block">
                              Binary screening based on Portuguese benchmark convention.
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-danger">
                        <strong>Model Error:</strong> {r.error_message || 'Inference computation failed.'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Regression Model Comparison Chart (when mode is compare and regression) */}
            {isRegression && prediction.mode === 'compare' && successfulResults.length > 1 && (
              <div className="pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
                  Comparative Grade Projections
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E3F0" vertical={false} />
                      <XAxis
                        dataKey="model"
                        stroke="#625C78"
                        fontSize={11}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        stroke="#625C78"
                        domain={[0, 20]}
                        fontSize={11}
                        ticks={[0, 5, 10, 15, 20]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E7E3F0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${val} / 20`, 'Estimated G3']}
                      />
                      <ReferenceLine
                        y={10}
                        stroke="#92520A"
                        strokeDasharray="4 4"
                        label={{ value: 'Passing Cutoff (10)', fill: '#92520A', fontSize: 10, position: 'top' }}
                      />
                      <Bar dataKey="grade" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={entry.grade >= 10 ? '#6855F5' : '#C5221F'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[11px] text-secondary text-center mt-2">
                  Dashed line indicates minimum passing threshold (10.0 / 20.0).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Input Features Summary */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-main uppercase tracking-wider">
              Input Features Used
            </h2>
            <div className="divide-y divide-border/60 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-secondary">G1 (Term 1 Grade)</span>
                <span className="font-mono font-semibold text-main">{prediction.features.G1} / 20</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">G2 (Term 2 Grade)</span>
                <span className="font-mono font-semibold text-main">{prediction.features.G2} / 20</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Study Time</span>
                <span className="font-semibold text-main">Category {prediction.features.studytime}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Past Failures</span>
                <span className="font-semibold text-main">{prediction.features.failures}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Absences</span>
                <span className="font-mono font-semibold text-main">{prediction.features.absences}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Extra School Support</span>
                <span className="font-semibold text-main uppercase">{prediction.features.schoolsup}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Family Support</span>
                <span className="font-semibold text-main uppercase">{prediction.features.famsup}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-secondary">Extra Paid Classes</span>
                <span className="font-semibold text-main uppercase">{prediction.features.paid}</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-secondary leading-relaxed border-t border-border">
              Predictions are statistical trajectories based on these 8 features and should be reviewed alongside classroom observations.
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Recording Modal */}
      {showOutcomeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-modal-title"
        >
          <div className="bg-card rounded-2xl shadow-modal border border-border max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 id="outcome-modal-title" className="text-base font-bold text-main">
                Record Actual Student Outcome
              </h3>
              <button
                type="button"
                onClick={() => setShowOutcomeModal(false)}
                className="text-secondary hover:text-main p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {outcomeError && (
              <ErrorMessage
                title="Could Not Record Outcome"
                message={outcomeError}
              />
            )}

            <form onSubmit={handleRecordOutcome} className="space-y-4">
              <div>
                <label htmlFor="actual_g3_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Actual Final Exam Grade (G3: 0–20)
                </label>
                <input
                  id="actual_g3_input"
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={actualG3}
                  onChange={(e) => setActualG3(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-card text-main font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="text-xs text-secondary mt-1">
                  Official final grade received. Values ≥ 10 automatically derive Pass status.
                </p>
              </div>

              <div>
                <label htmlFor="outcome_source_select" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Verification Source
                </label>
                <select
                  id="outcome_source_select"
                  value={outcomeSource}
                  onChange={(e) => setOutcomeSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-main focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="teacher_reported">Teacher Reported</option>
                  <option value="official_transcript">Official Transcript</option>
                  <option value="school_registry">School Registry Examination Record</option>
                </select>
              </div>

              <div>
                <label htmlFor="outcome_notes_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Audit Notes (Optional)
                </label>
                <textarea
                  id="outcome_notes_input"
                  rows={2}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. End of term official board result"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOutcomeModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-secondary hover:text-main"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutcome}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {submittingOutcome ? 'Saving...' : 'Save Actual Outcome'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
