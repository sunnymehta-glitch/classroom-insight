import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { HistoryResponse, OutcomeRequest } from '../types/api';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import {
  History,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  PlusCircle,
  X,
  RefreshCw,
} from 'lucide-react';

export const HistoryScreen: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(10);
  const [goalFilter, setGoalFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Outcome recording modal state
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [actualG3, setActualG3] = useState<number>(10);
  const [outcomeSource, setOutcomeSource] = useState<string>('teacher_reported');
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState<boolean>(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let fromIso: string | undefined = undefined;
      let toIso: string | undefined = undefined;

      if (fromDate) {
        try {
          fromIso = new Date(fromDate).toISOString();
        } catch {
          // ignore invalid date
        }
      }
      if (toDate) {
        try {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          toIso = end.toISOString();
        } catch {
          // ignore invalid date
        }
      }

      const res = await api.getHistory({
        page,
        size: pageSize,
        goal: goalFilter || undefined,
        q: searchQuery.trim() || undefined,
        from: fromIso,
        to: toIso,
      });
      setHistoryData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve prediction history.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, goalFilter, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchHistory();
  };

  const handleClearFilters = () => {
    setGoalFilter('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const handleRecordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPredictionId || submittingOutcome) return;

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
      await api.recordOutcome(selectedPredictionId, payload);
      // Update local item list to reflect recorded outcome
      if (historyData) {
        const updatedItems = historyData.items.map((item) =>
          item.prediction_id === selectedPredictionId
            ? { ...item, has_recorded_outcome: true }
            : item
        );
        setHistoryData({ ...historyData, items: updatedItems });
      }
      setSelectedPredictionId(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setOutcomeError('An actual outcome has already been recorded for this prediction.');
      } else {
        setOutcomeError(err.message || 'Failed to record actual outcome.');
      }
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const items = historyData?.items || [];
  const totalPages = historyData?.total_pages || 0;
  const totalElements = historyData?.total_elements || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <History size={14} aria-hidden="true" />
            <span>Audit & Persistence Log</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-main">Prediction History</h1>
          <p className="text-sm text-secondary mt-1">
            Review past inference records, track ground truth verification, and reopen historical student trajectories.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-main hover:bg-canvas transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-card space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Query */}
          <div className="md:col-span-2 relative">
            <Search size={16} className="absolute left-3.5 top-3 text-secondary" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student reference or UUID..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-canvas text-main placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Goal Filter */}
          <div>
            <select
              value={goalFilter}
              onChange={(e) => {
                setGoalFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-canvas text-main focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by goal"
            >
              <option value="">All Prediction Goals</option>
              <option value="regression">Regression (Grade Estimation)</option>
              <option value="classification">Classification (Pass / Fail Risk)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 bg-card hover:bg-canvas text-secondary border border-border text-xs font-medium rounded-xl transition-colors"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60 text-xs">
          <span className="text-secondary font-medium flex items-center">
            <Calendar size={13} className="mr-1.5" aria-hidden="true" />
            Date Range:
          </span>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-main text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Start date"
            />
            <span className="text-secondary">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-main text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="End date"
            />
          </div>
          {(goalFilter || searchQuery || fromDate || toDate) && (
            <span className="text-primary font-medium ml-auto">
              Active filters applied
            </span>
          )}
        </div>
      </div>

      {error && (
        <ErrorMessage
          title="History Query Failed"
          message={error}
          onRetry={fetchHistory}
        />
      )}

      {/* History Data Table Card */}
      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading historical predictions..." fullHeight />
        ) : items.length === 0 ? (
          <EmptyState
            title="No Prediction Records Found"
            description={
              goalFilter || searchQuery || fromDate || toDate
                ? 'No saved predictions match your filter criteria. Try adjusting or clearing search filters.'
                : 'No student predictions have been executed yet.'
            }
            actionText={
              goalFilter || searchQuery || fromDate || toDate
                ? 'Clear Filters'
                : 'Create First Prediction'
            }
            onAction={
              goalFilter || searchQuery || fromDate || toDate
                ? handleClearFilters
                : () => navigate('/predict')
            }
            className="m-6"
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" aria-label="Persistent prediction history">
                <thead>
                  <tr className="border-b border-border bg-canvas/60 text-xs text-secondary font-semibold uppercase tracking-wider">
                    <th scope="col" className="py-3.5 px-4">Created</th>
                    <th scope="col" className="py-3.5 px-4">Student Ref</th>
                    <th scope="col" className="py-3.5 px-4">Goal / Mode</th>
                    <th scope="col" className="py-3.5 px-4">Models Used</th>
                    <th scope="col" className="py-3.5 px-4">Primary Result</th>
                    <th scope="col" className="py-3.5 px-4">Actual Ground Truth</th>
                    <th scope="col" className="py-3.5 px-4">Status</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item) => (
                    <tr key={item.prediction_id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono text-secondary whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-main text-sm">
                        {item.student_reference || (
                          <span className="text-secondary italic font-normal text-xs">Unspecified</span>
                        )}
                        <div className="text-[10px] text-secondary font-mono truncate max-w-[120px]">
                          {item.prediction_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold capitalize text-main">
                          {item.goal}
                        </div>
                        <div className="text-[11px] text-secondary capitalize">
                          {item.mode} mode
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-secondary font-mono flex flex-wrap gap-1 max-w-[160px]">
                          {item.models_used.map((m) => (
                            <span key={m} className="bg-canvas px-1.5 py-0.5 rounded border border-border/60 text-[10px]">
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-main">
                        {item.primary_result}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.has_recorded_outcome ? (
                          <StatusBadge status="success" label="Recorded" size="sm" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPredictionId(item.prediction_id);
                              setOutcomeError(null);
                            }}
                            className="inline-flex items-center text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                          >
                            <PlusCircle size={13} className="mr-1" aria-hidden="true" />
                            Record Actual
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/results/${item.prediction_id}`)}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-semibold text-main hover:bg-canvas transition-colors shadow-sm"
                          title="Open saved results without re-inferencing"
                        >
                          <Eye size={13} className="mr-1 text-primary" aria-hidden="true" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-xs text-secondary">
                Showing <strong className="text-main">{items.length}</strong> of{' '}
                <strong className="text-main">{totalElements}</strong> total records
                {totalPages > 1 && (
                  <span>
                    {' '}· Page <strong className="text-main">{page + 1}</strong> of{' '}
                    <strong className="text-main">{totalPages}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(page - 1, 0))}
                  disabled={page === 0}
                  className={`p-2 rounded-lg border border-border text-secondary hover:text-main hover:bg-canvas transition-colors ${
                    page === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page + 1 >= totalPages}
                  className={`p-2 rounded-lg border border-border text-secondary hover:text-main hover:bg-canvas transition-colors ${
                    page + 1 >= totalPages ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Outcome Modal */}
      {selectedPredictionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-outcome-title"
        >
          <div className="bg-card rounded-2xl shadow-modal border border-border max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 id="history-outcome-title" className="text-base font-bold text-main">
                Record Verified Outcome
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPredictionId(null)}
                className="text-secondary hover:text-main p-1 rounded-lg"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-secondary">
              Record ground truth examination score for prediction <code className="font-mono text-main">{selectedPredictionId}</code>.
            </p>

            {outcomeError && (
              <ErrorMessage
                title="Could Not Record Outcome"
                message={outcomeError}
              />
            )}

            <form onSubmit={handleRecordOutcome} className="space-y-4">
              <div>
                <label htmlFor="history_actual_g3_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Actual Final Exam Grade (G3: 0–20)
                </label>
                <input
                  id="history_actual_g3_input"
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={actualG3}
                  onChange={(e) => setActualG3(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-card text-main font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label htmlFor="history_outcome_source_select" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Verification Source
                </label>
                <select
                  id="history_outcome_source_select"
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
                <label htmlFor="history_outcome_notes_input" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Audit Notes (Optional)
                </label>
                <textarea
                  id="history_outcome_notes_input"
                  rows={2}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Verified by academic department"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-main focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPredictionId(null)}
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
