import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('App Navigation and Layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock API calls made by Header and Overview on mount
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              status: 'UP',
              version: '1.0.0',
              timestamp: '2026-10-18T00:00:00Z',
              components: {
                database: { status: 'UP' },
                ml_service: { status: 'UP', details: { models_loaded: 10 } },
              },
            }),
        } as any);
      }
      if (urlStr.includes('/api/predictions')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              items: [],
              page: 0,
              size: 5,
              total_elements: 0,
              total_pages: 0,
            }),
        } as any);
      }
      if (urlStr.includes('/api/models/performance')) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              goal: 'regression',
              dataset: 'UCI Student Performance - Mathematics',
              evaluation_strategy: 'Held-out test set',
              test_sample_count: 79,
              generated_at: '2026-10-18T00:00:00Z',
              models: [],
            }),
        } as any);
      }
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
              ],
            }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({}),
      } as any);
    });
  });

  it('renders application with sidebar and navigates across screens', async () => {
    render(<App />);

    // Check header and sidebar branding
    expect(screen.getAllByText(/Classroom Insight/i).length).toBeGreaterThan(0);

    // Initial screen is Overview
    expect(await screen.findByText(/Classroom Insight Trajectory Estimation/i)).toBeInTheDocument();

    // Navigate to New Prediction
    const predictLink = screen.getByRole('link', { name: /New Prediction/i });
    fireEvent.click(predictLink);
    expect(await screen.findByRole('heading', { name: 'New Prediction', level: 1 })).toBeInTheDocument();

    // Navigate to Prediction History
    const historyLink = screen.getByRole('link', { name: /Prediction History/i });
    fireEvent.click(historyLink);
    expect(await screen.findByRole('heading', { name: 'Prediction History', level: 1 })).toBeInTheDocument();

    // Navigate to Model Performance
    const perfLink = screen.getByRole('link', { name: /Model Performance/i });
    fireEvent.click(perfLink);
    expect(await screen.findByRole('heading', { name: 'Model Performance', level: 1 })).toBeInTheDocument();
  });
});
