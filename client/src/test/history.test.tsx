import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HistoryScreen } from '../screens/HistoryScreen';

describe('History Screen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders history records and supports search filtering', async () => {
    const mockHistory = {
      items: [
        {
          prediction_id: 'pred-1111',
          goal: 'regression',
          mode: 'single',
          status: 'success',
          student_reference: 'ALICE-01',
          models_used: ['random_forest_regressor'],
          primary_result: '14.50 (random_forest_regressor)',
          has_recorded_outcome: false,
          created_at: '2026-10-18T00:00:00Z',
        },
      ],
      page: 0,
      size: 10,
      total_elements: 1,
      total_pages: 1,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify(mockHistory),
      } as any);
    });

    render(
      <BrowserRouter>
        <HistoryScreen />
      </BrowserRouter>
    );

    expect(await screen.findByText('ALICE-01')).toBeInTheDocument();
    expect(screen.getByText('14.50 (random_forest_regressor)')).toBeInTheDocument();

    // Type in search query
    const searchInput = screen.getByPlaceholderText(/Search by student reference or UUID/i);
    fireEvent.change(searchInput, { target: { value: 'ALICE' } });

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=ALICE'),
        expect.any(Object)
      );
    });
  });

  it('displays empty state when no records exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          items: [],
          page: 0,
          size: 10,
          total_elements: 0,
          total_pages: 0,
        }),
    } as any);

    render(
      <BrowserRouter>
        <HistoryScreen />
      </BrowserRouter>
    );

    expect(await screen.findByText(/No Prediction Records Found/i)).toBeInTheDocument();
  });
});
