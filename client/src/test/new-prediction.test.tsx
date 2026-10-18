import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NewPredictionScreen } from '../screens/NewPredictionScreen';

describe('New Prediction Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/models')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              goal: 'regression',
              models: [
                {
                  model_id: 'random_forest_regressor',
                  name: 'Random Forest Regressor',
                  family: 'Random Forest',
                  version: '1.0.0',
                  status: 'available',
                  description: 'Primary ensemble model',
                  selected_primary_candidate: true,
                },
                {
                  model_id: 'linear_regression',
                  name: 'Linear Regression',
                  family: 'Linear Regression',
                  version: '1.0.0',
                  status: 'available',
                  description: 'Baseline model',
                  selected_primary_candidate: false,
                },
              ],
            }),
        } as any);
      }
      if (urlStr.includes('/api/predictions')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              prediction_id: '8efb22a0-1234-5678-90ab-cdef12345678',
              goal: 'regression',
              mode: 'single',
              status: 'success',
              features: {
                G1: 10,
                G2: 10,
                studytime: 2,
                failures: 0,
                absences: 4,
                schoolsup: 'no',
                famsup: 'yes',
                paid: 'no',
              },
              results: [
                {
                  model_id: 'random_forest_regressor',
                  model_version: '1.0.0',
                  status: 'success',
                  predicted_grade: 10.5,
                  predicted_class: null,
                  error_message: null,
                },
              ],
              created_at: '2026-10-18T00:00:00Z',
              schema_version: '1.0.0',
            }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({}),
      } as any);
    });
  });

  it('renders form and rejects invalid input ranges before submission', async () => {
    render(
      <BrowserRouter>
        <NewPredictionScreen />
      </BrowserRouter>
    );

    // Wait for models to load
    expect(await screen.findByText('Random Forest Regressor')).toBeInTheDocument();

    // Set invalid G1 > 20
    const g1Input = screen.getByLabelText(/G1 — First Period Grade/i);
    fireEvent.change(g1Input, { target: { value: '25' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Run Prediction/i });
    fireEvent.click(submitBtn);

    // Validation error should be visible
    expect(await screen.findByText(/G1 must be an integer between 0 and 20/i)).toBeInTheDocument();
  });

  it('enforces at least 2 models selected when compare mode is chosen', async () => {
    render(
      <BrowserRouter>
        <NewPredictionScreen />
      </BrowserRouter>
    );

    expect(await screen.findByText('Random Forest Regressor')).toBeInTheDocument();

    // Switch to compare mode
    const compareRadio = screen.getByRole('radio', { name: /Compare Models/i });
    fireEvent.click(compareRadio);

    // Deselect all models
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if ((cb as HTMLInputElement).checked) {
        fireEvent.click(cb);
      }
    }

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Run Prediction/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Please select at least 2 models for comparative evaluation/i)).toBeInTheDocument();
  });

  it('submits valid prediction and calls POST /api/predictions', async () => {
    render(
      <BrowserRouter>
        <NewPredictionScreen />
      </BrowserRouter>
    );

    expect(await screen.findByText('Random Forest Regressor')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Run Prediction/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/predictions',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
