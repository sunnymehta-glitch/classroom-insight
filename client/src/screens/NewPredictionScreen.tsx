import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import {
  GoalType,
  ModeType,
  ModelInfo,
  PredictionRequest,
  StudentFeatures,
  BinaryChoice,
} from '../types/api';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  Sparkles,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';

export const NewPredictionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Goal & Mode state
  const initialGoal = (searchParams.get('goal') === 'classification' ? 'classification' : 'regression') as GoalType;
  const [goal, setGoal] = useState<GoalType>(initialGoal);
  const [mode, setMode] = useState<ModeType>('single');

  // Model selection state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);

  // Student inputs
  const [studentRef, setStudentRef] = useState<string>('');
  const [features, setFeatures] = useState<StudentFeatures>({
    G1: 10,
    G2: 10,
    studytime: 2,
    failures: 0,
    absences: 4,
    schoolsup: 'no',
    famsup: 'yes',
    paid: 'no',
  });

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch models for the active goal
  useEffect(() => {
    let isCancelled = false;
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const res = await api.listModels(goal);
        if (!isCancelled) {
          setModels(res.models || []);
          // Pick default primary model if available
          const primary = res.models.find((m) => m.selected_primary_candidate) || res.models[0];
          if (primary) {
            setSelectedModelId(primary.model_id);
            // Default comparison picks first two available models
            const topTwo = res.models.slice(0, 2).map((m) => m.model_id);
            setSelectedModelIds(topTwo);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setSubmitError(`Failed to load compatible ${goal} models: ${err.message}`);
        }
      } finally {
        if (!isCancelled) {
          setLoadingModels(false);
        }
      }
    };

    fetchModels();
    return () => {
      isCancelled = true;
    };
  }, [goal]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate Student Reference
    if (studentRef.trim()) {
      const refRegex = /^[A-Za-z0-9_-]{1,32}$/;
      if (!refRegex.test(studentRef.trim())) {
        errors.studentRef = 'Student reference must be 1-32 alphanumeric characters, dashes, or underscores.';
      }
    }

    // Validate G1 (0 to 20)
    if (features.G1 === undefined || features.G1 === null || isNaN(features.G1)) {
      errors.G1 = 'First period grade (G1) is required.';
    } else if (features.G1 < 0 || features.G1 > 20 || !Number.isInteger(Number(features.G1))) {
      errors.G1 = 'G1 must be an integer between 0 and 20.';
    }

    // Validate G2 (0 to 20)
    if (features.G2 === undefined || features.G2 === null || isNaN(features.G2)) {
      errors.G2 = 'Second period grade (G2) is required.';
    } else if (features.G2 < 0 || features.G2 > 20 || !Number.isInteger(Number(features.G2))) {
      errors.G2 = 'G2 must be an integer between 0 and 20.';
    }

    // Validate studytime (1 to 4)
    if (![1, 2, 3, 4].includes(Number(features.studytime))) {
      errors.studytime = 'Study time must be an integer in 1, 2, 3, or 4.';
    }

    // Validate failures (0 to 3)
    if (![0, 1, 2, 3].includes(Number(features.failures))) {
      errors.failures = 'Past class failures must be an integer between 0 and 3.';
    }

    // Validate absences (0 to 93)
    if (features.absences === undefined || features.absences === null || isNaN(features.absences)) {
      errors.absences = 'Number of absences is required.';
    } else if (features.absences < 0 || features.absences > 93 || !Number.isInteger(Number(features.absences))) {
      errors.absences = 'Absences must be an integer between 0 and 93.';
    }

    // Validate model selection
    if (mode === 'single' && !selectedModelId) {
      errors.models = 'Please select a model for inference.';
    } else if (mode === 'compare') {
      if (selectedModelIds.length < 2) {
        errors.models = 'Please select at least 2 models for comparative evaluation.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError(null);
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const payload: PredictionRequest = {
      goal,
      mode,
      features: {
        G1: Number(features.G1),
        G2: Number(features.G2),
        studytime: Number(features.studytime),
        failures: Number(features.failures),
        absences: Number(features.absences),
        schoolsup: features.schoolsup,
        famsup: features.famsup,
        paid: features.paid,
      },
      ...(studentRef.trim() ? { student_reference: studentRef.trim() } : {}),
      ...(mode === 'single' ? { model_id: selectedModelId } : { model_ids: selectedModelIds }),
    };

    try {
      const response = await api.createPrediction(payload);
      // Navigate to results screen with newly created prediction
      navigate(`/results/${response.prediction_id}`, { state: { prediction: response } });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setSubmitError(`${err.message} (${err.code})`);
      } else {
        setSubmitError(err.message || 'Prediction failed. Please verify inputs and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxToggle = (modelId: string) => {
    if (selectedModelIds.includes(modelId)) {
      setSelectedModelIds(selectedModelIds.filter((id) => id !== modelId));
    } else {
      setSelectedModelIds([...selectedModelIds, modelId]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          <Sparkles size={14} aria-hidden="true" />
          <span>Inference Setup</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-main">New Prediction</h1>
        <p className="text-sm text-secondary mt-1">
          Configure inference goals, choose candidate models, and provide verified student features to compute academic trajectory estimations.
        </p>
      </div>

      {submitError && (
        <ErrorMessage
          title="Prediction Execution Error"
          message={submitError}
          onRetry={() => setSubmitError(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* 1. Goal & Mode Configuration Card */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-6">
          <h2 className="text-base font-semibold text-main">1. Prediction Goal & Mode</h2>

          {/* Goal Switch */}
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Select Prediction Goal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Prediction Goal">
              <button
                type="button"
                onClick={() => setGoal('regression')}
                className={`p-4 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                  goal === 'regression'
                    ? 'border-primary bg-primary-light/40 text-main ring-2 ring-primary/20'
                    : 'border-border bg-card hover:bg-canvas text-secondary'
                }`}
                role="radio"
                aria-checked={goal === 'regression'}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${goal === 'regression' ? 'bg-primary text-white' : 'bg-canvas text-secondary'}`}>
                  <TrendingUp size={20} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-main">Regression (Grade Estimation)</div>
                  <div className="text-xs text-secondary mt-0.5 leading-relaxed">
                    Estimates continuous final mathematics grade <code className="font-mono text-xs font-semibold text-main">G3</code> on a standard 0–20 scale.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setGoal('classification')}
                className={`p-4 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                  goal === 'classification'
                    ? 'border-primary bg-primary-light/40 text-main ring-2 ring-primary/20'
                    : 'border-border bg-card hover:bg-canvas text-secondary'
                }`}
                role="radio"
                aria-checked={goal === 'classification'}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${goal === 'classification' ? 'bg-warning text-white' : 'bg-canvas text-secondary'}`}>
                  <ShieldAlert size={20} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-main">Classification (Pass / Fail Risk)</div>
                  <div className="text-xs text-secondary mt-0.5 leading-relaxed">
                    Screens academic failure risk based on the Portuguese passing threshold (<code className="font-mono text-xs font-semibold text-main">G3 ≥ 10</code>).
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Mode Switch: Single vs Compare */}
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
              Evaluation Mode
            </label>
            <div className="flex rounded-xl bg-canvas p-1 border border-border max-w-sm" role="radiogroup" aria-label="Evaluation Mode">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'single'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-secondary hover:text-main'
                }`}
                role="radio"
                aria-checked={mode === 'single'}
              >
                Single Model
              </button>
              <button
                type="button"
                onClick={() => setMode('compare')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'compare'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-secondary hover:text-main'
                }`}
                role="radio"
                aria-checked={mode === 'compare'}
              >
                Compare Models
              </button>
            </div>
          </div>

          {/* Dynamic Model Selection from GET /api/models */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                Compatible {goal === 'regression' ? 'Regression' : 'Classification'} Models
              </label>
              {mode === 'compare' && (
                <span className="text-xs text-secondary">
                  {selectedModelIds.length} models selected (min 2)
                </span>
              )}
            </div>

            {loadingModels ? (
              <LoadingSpinner label="Loading compatible models from ML registry..." size="sm" />
            ) : models.length === 0 ? (
              <div className="rounded-xl bg-canvas p-4 text-xs text-secondary border border-border">
                No compatible models found for goal &apos;{goal}&apos;. Ensure ML service is active.
              </div>
            ) : mode === 'single' ? (
              <div className="space-y-2">
                {models.map((m) => (
                  <label
                    key={m.model_id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      selectedModelId === m.model_id
                        ? 'border-primary bg-primary-light/30'
                        : 'border-border bg-card hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="single_model"
                        value={m.model_id}
                        checked={selectedModelId === m.model_id}
                        onChange={() => setSelectedModelId(m.model_id)}
                        className="text-primary focus:ring-primary h-4 w-4"
                      />
                      <div>
                        <div className="text-sm font-semibold text-main flex items-center space-x-2">
                          <span>{m.name}</span>
                          {m.selected_primary_candidate && (
                            <StatusBadge status="success" label="Primary Candidate" size="sm" icon={false} />
                          )}
                        </div>
                        <div className="text-xs text-secondary mt-0.5">{m.description}</div>
                      </div>
                    </div>
                    <div className="text-xs text-secondary font-mono text-right hidden sm:block">
                      v{m.version}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {models.map((m) => {
                  const isChecked = selectedModelIds.includes(m.model_id);
                  return (
                    <label
                      key={m.model_id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-primary bg-primary-light/30'
                          : 'border-border bg-card hover:bg-canvas'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          value={m.model_id}
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(m.model_id)}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <div>
                          <div className="text-sm font-semibold text-main flex items-center space-x-2">
                            <span>{m.name}</span>
                            {m.selected_primary_candidate && (
                              <StatusBadge status="success" label="Primary Candidate" size="sm" icon={false} />
                            )}
                          </div>
                          <div className="text-xs text-secondary mt-0.5">{m.description}</div>
                        </div>
                      </div>
                      <div className="text-xs text-secondary font-mono text-right hidden sm:block">
                        v{m.version}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {fieldErrors.models && (
              <p className="mt-2 text-xs text-danger flex items-center">
                <AlertTriangle size={13} className="mr-1" aria-hidden="true" />
                {fieldErrors.models}
              </p>
            )}
          </div>
        </div>

        {/* 2. Student Features Input Form Card */}
        <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-main">2. Student Features</h2>
              <p className="text-xs text-secondary">
                Provide the 8 canonical predictive features defined in the feature schema.
              </p>
            </div>
            <span className="text-xs text-secondary italic">All fields required except Reference</span>
          </div>

          {/* Student Reference (Optional) */}
          <div>
            <label htmlFor="student_ref" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
              Student Reference / Identifier (Optional)
            </label>
            <input
              id="student_ref"
              type="text"
              value={studentRef}
              onChange={(e) => setStudentRef(e.target.value)}
              placeholder="e.g. STU-2026-042"
              maxLength={32}
              className={`w-full max-w-sm px-3.5 py-2 text-sm rounded-xl border bg-card text-main placeholder-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary ${
                fieldErrors.studentRef ? 'border-danger' : 'border-border'
              }`}
            />
            <p className="text-xs text-secondary mt-1">
              Optional local identifier (1–32 alphanumeric, dash, or underscore characters).
            </p>
            {fieldErrors.studentRef && (
              <p className="text-xs text-danger mt-1">{fieldErrors.studentRef}</p>
            )}
          </div>

          {/* Period Grades: G1 & G2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div>
              <label htmlFor="g1_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                G1 — First Period Grade (0–20)
              </label>
              <input
                id="g1_input"
                type="number"
                min={0}
                max={20}
                step={1}
                value={features.G1}
                onChange={(e) => setFeatures({ ...features, G1: parseInt(e.target.value, 10) })}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-card text-main font-mono focus:outline-none focus:ring-2 focus:ring-primary ${
                  fieldErrors.G1 ? 'border-danger' : 'border-border'
                }`}
                required
              />
              <p className="text-xs text-secondary mt-1">First term assessment score (scale: 0–20).</p>
              {fieldErrors.G1 && <p className="text-xs text-danger mt-1">{fieldErrors.G1}</p>}
            </div>

            <div>
              <label htmlFor="g2_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                G2 — Second Period Grade (0–20)
              </label>
              <input
                id="g2_input"
                type="number"
                min={0}
                max={20}
                step={1}
                value={features.G2}
                onChange={(e) => setFeatures({ ...features, G2: parseInt(e.target.value, 10) })}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-card text-main font-mono focus:outline-none focus:ring-2 focus:ring-primary ${
                  fieldErrors.G2 ? 'border-danger' : 'border-border'
                }`}
                required
              />
              <p className="text-xs text-secondary mt-1">Second term assessment score (scale: 0–20).</p>
              {fieldErrors.G2 && <p className="text-xs text-danger mt-1">{fieldErrors.G2}</p>}
            </div>
          </div>

          {/* Academic Behavior: Studytime, Failures, Absences */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
            <div>
              <label htmlFor="studytime_select" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Study Time (Weekly)
              </label>
              <select
                id="studytime_select"
                value={features.studytime}
                onChange={(e) => setFeatures({ ...features, studytime: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={1}>1: &lt; 2 hours</option>
                <option value={2}>2: 2 to 5 hours</option>
                <option value={3}>3: 5 to 10 hours</option>
                <option value={4}>4: &gt; 10 hours</option>
              </select>
              <p className="text-xs text-secondary mt-1">Dedicated weekly study hours category.</p>
              {fieldErrors.studytime && <p className="text-xs text-danger mt-1">{fieldErrors.studytime}</p>}
            </div>

            <div>
              <label htmlFor="failures_select" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Past Failures (0–3)
              </label>
              <select
                id="failures_select"
                value={features.failures}
                onChange={(e) => setFeatures({ ...features, failures: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={0}>0 failures</option>
                <option value={1}>1 failure</option>
                <option value={2}>2 failures</option>
                <option value={3}>3 failures</option>
              </select>
              <p className="text-xs text-secondary mt-1">Number of past class failures (0–3).</p>
              {fieldErrors.failures && <p className="text-xs text-danger mt-1">{fieldErrors.failures}</p>}
            </div>

            <div>
              <label htmlFor="absences_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Absences (0–93)
              </label>
              <input
                id="absences_input"
                type="number"
                min={0}
                max={93}
                step={1}
                value={features.absences}
                onChange={(e) => setFeatures({ ...features, absences: parseInt(e.target.value, 10) })}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-card text-main font-mono focus:outline-none focus:ring-2 focus:ring-primary ${
                  fieldErrors.absences ? 'border-danger' : 'border-border'
                }`}
                required
              />
              <p className="text-xs text-secondary mt-1">Total school session absences.</p>
              {fieldErrors.absences && <p className="text-xs text-danger mt-1">{fieldErrors.absences}</p>}
            </div>
          </div>

          {/* Binary Educational & Family Support: schoolsup, famsup, paid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Extra School Support
              </label>
              <div className="flex space-x-2 mt-1">
                {(['yes', 'no'] as BinaryChoice[]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFeatures({ ...features, schoolsup: val })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      features.schoolsup === val
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-secondary border-border hover:bg-canvas'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary mt-1">Special educational support from school.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Family Educational Support
              </label>
              <div className="flex space-x-2 mt-1">
                {(['yes', 'no'] as BinaryChoice[]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFeatures({ ...features, famsup: val })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      features.famsup === val
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-secondary border-border hover:bg-canvas'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary mt-1">Family educational tutoring / support.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                Extra Paid Classes
              </label>
              <div className="flex space-x-2 mt-1">
                {(['yes', 'no'] as BinaryChoice[]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFeatures({ ...features, paid: val })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                      features.paid === val
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-card text-secondary border-border hover:bg-canvas'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary mt-1">Paid math tutoring outside school.</p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-secondary flex items-center">
            <HelpCircle size={14} className="mr-1.5 flex-shrink-0" aria-hidden="true" />
            <span>Target grade G3 is predicted by the ML model and strictly excluded from inputs.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              submitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" label="" />
                <span>Computing Inference...</span>
              </>
            ) : (
              <>
                <span>Run Prediction</span>
                <ArrowRight size={16} className="ml-2" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
