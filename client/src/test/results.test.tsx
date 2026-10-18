import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsScreen } from '../screens/ResultsScreen';

describe('Results Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders regression prediction with model score and bounds', async () => {
    const mockPrediction = {
      prediction_id: 'test-uuid-1234',
      goal: 'regression',
      mode: 'single',
      status: 'success',
      student_reference: 'REF-99',
      features: {
        G1: 15,
        G2: 16,
        studytime: 3,
        failures: 0,
        absences: 1,
        schoolsup: 'no',
        famsup: 'yes',
        paid: 'yes',
      },
      results: [
        {
          model_id: 'random_forest_regressor',
          model_version: '1.0.0',
          status: 'success',
          predicted_grade: 15.75,
          predicted_class: null,
          error_message: null,
        },
      ],
      created_at: '2026-10-18T00:00:00Z',
      schema_version: '1.0.0',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockPrediction),
    } as any);

    render(
      <MemoryRouter initialEntries={['/results/test-uuid-1234']}>
        <Routes>
          <Route path="/results/:id" element={<ResultsScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('15.75')).toBeInTheDocument();
    expect(screen.getByText(/random_forest_regressor/i)).toBeInTheDocument();
    expect(screen.getByText(/REF-99/i)).toBeInTheDocument();
  });

  it('renders classification prediction with Pass status badge', async () => {
    const mockPrediction = {
      prediction_id: 'test-cls-1234',
      goal: 'classification',
      mode: 'single',
      status: 'success',
      student_reference: null,
      features: {
        G1: 12,
        G2: 12,
        studytime: 2,
        failures: 0,
        absences: 4,
        schoolsup: 'no',
        famsup: 'yes',
        paid: 'no',
      },
      results: [
        {
          model_id: 'logistic_regression',
          model_version: '1.0.0',
          status: 'success',
          predicted_grade: null,
          predicted_class: 'pass',
          error_message: null,
        },
      ],
      created_at: '2026-10-18T00:00:00Z',
      schema_version: '1.0.0',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockPrediction),
    } as any);

    render(
      <MemoryRouter initialEntries={['/results/test-cls-1234']}>
        <Routes>
          <Route path="/results/:id" element={<ResultsScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/PASS \(G3 ≥ 10\)/i)).toBeInTheDocument();
  });

  it('handles outcome recording and displays verified ground truth', async () => {
    const mockPrediction = {
      prediction_id: 'outcome-test-id',
      goal: 'regression',
      mode: 'single',
      status: 'success',
      student_reference: null,
      features: {
        G1: 10,
        G2: 11,
        studytime: 2,
        failures: 0,
        absences: 2,
        schoolsup: 'no',
        famsup: 'no',
        paid: 'no',
      },
      results: [
        {
          model_id: 'random_forest_regressor',
          model_version: '1.0.0',
          status: 'success',
          predicted_grade: 11.2,
          predicted_class: null,
          error_message: null,
        },
      ],
      created_at: '2026-10-18T00:00:00Z',
      schema_version: '1.0.0',
      verified_outcome: null,
    };

    const mockOutcomeRes = {
      outcome_id: 'out-1234',
      prediction_id: 'outcome-test-id',
      actual_g3: 12,
      actual_pass_status: 'pass',
      source: 'teacher_reported',
      verification_status: 'recorded',
      notes: 'Final exam',
      recorded_at: '2026-10-18T01:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockPrediction),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockOutcomeRes),
      } as any);

    render(
      <MemoryRouter initialEntries={['/results/outcome-test-id']}>
        <Routes>
          <Route path="/results/:id" element={<ResultsScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Record Actual G3')).toBeInTheDocument();

    // Click Record Actual G3 button
    fireEvent.click(screen.getByRole('button', { name: /Record Actual G3/i }));

    // Modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Actual Outcome/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Verified Actual Outcome Recorded/i)).toBeInTheDocument();
    });
  });
});
