import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelPerformanceScreen } from '../screens/ModelPerformanceScreen';

describe('Model Performance Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders genuine offline regression evaluation metrics', async () => {
    const mockRegressionPerf = {
      goal: 'regression',
      dataset: 'UCI Student Performance - Mathematics (student-mat.csv)',
      evaluation_strategy: 'Held-out test set (80/20 split), CV (5-fold) on train set',
      test_sample_count: 79,
      generated_at: '2026-10-18T00:00:00Z',
      models: [
        {
          model_id: 'random_forest_regressor',
          name: 'Random Forest Regressor',
          version: '1.0.0',
          status: 'evaluated',
          metrics: {
            mae: 1.1154,
            rmse: 1.7787,
            r2: 0.8425,
          },
          cv_metrics: {
            cv_mae_mean: 0.969,
            cv_mae_std: 0.1276,
            cv_rmse_mean: 1.574,
            cv_rmse_std: 0.2413,
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockRegressionPerf),
    } as any);

    render(<ModelPerformanceScreen />);

    expect(await screen.findByText(/79 students \(20% split\)/i)).toBeInTheDocument();
    expect(screen.getByText('1.115')).toBeInTheDocument(); // MAE
    expect(screen.getByText('1.779')).toBeInTheDocument(); // RMSE
    expect(screen.getByText('0.843')).toBeInTheDocument(); // R2
    expect(screen.getByText('Random Forest Regressor')).toBeInTheDocument();
  });

  it('switches to classification and displays accuracy, F1, and confusion matrix', async () => {
    const mockClsPerf = {
      goal: 'classification',
      dataset: 'UCI Student Performance - Mathematics',
      evaluation_strategy: 'Held-out test set (80/20 stratified split)',
      test_sample_count: 79,
      generated_at: '2026-10-18T00:00:00Z',
      models: [
        {
          model_id: 'logistic_regression',
          name: 'Logistic Regression',
          version: '1.0.0',
          status: 'evaluated',
          metrics: {
            accuracy: 0.9114,
            precision_macro: 0.8988,
            recall_macro: 0.9028,
            f1_macro: 0.9007,
            fail_class_metrics: {
              recall: 0.8846,
              precision: 0.8519,
              f1: 0.8679,
            },
            confusion_matrix: {
              class_labels: ['fail', 'pass'],
              axes: 'rows=actual, columns=predicted',
              matrix: [
                [23, 3],
                [4, 49],
              ],
            },
          },
          cv_metrics: {},
        },
      ],
    };

    // First call is regression (on mount), second call is classification (on button click)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            goal: 'regression',
            dataset: 'UCI Student Performance',
            evaluation_strategy: 'Test',
            test_sample_count: 79,
            generated_at: '2026-10-18T00:00:00Z',
            models: [],
          }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockClsPerf),
      } as any);

    render(<ModelPerformanceScreen />);

    // Click classification toggle
    const clsToggle = screen.getByRole('radio', { name: /Classification/i });
    fireEvent.click(clsToggle);

    expect(await screen.findByText('91.1%')).toBeInTheDocument(); // Accuracy
    expect(screen.getByText('0.901')).toBeInTheDocument(); // Macro F1
    expect(screen.getByText('88.5%')).toBeInTheDocument(); // Fail class recall

    // Confusion matrix elements
    expect(screen.getByText('True Fail (TN)')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('49')).toBeInTheDocument();
  });

  it('displays actionable error state when performance API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Evaluation report currently unavailable',
          },
        }),
    } as any);

    render(<ModelPerformanceScreen />);

    expect(await screen.findByText(/Performance Data Unavailable/i)).toBeInTheDocument();
  });
});
