import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, resolveApiUrl } from '../api/client';
import { PredictionRequest } from '../types/api';

describe('Typed API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (import.meta.env as any).VITE_API_BASE_URL = '';
  });

  describe('resolveApiUrl', () => {
    afterEach(() => {
      (import.meta.env as any).VITE_API_BASE_URL = '';
    });

    it('returns original path when VITE_API_BASE_URL is empty or undefined', () => {
      (import.meta.env as any).VITE_API_BASE_URL = '';
      expect(resolveApiUrl('/api/health')).toBe('/api/health');
      expect(resolveApiUrl('/api/predictions')).toBe('/api/predictions');
    });

    it('correctly prepends base URL ending in /api', () => {
      (import.meta.env as any).VITE_API_BASE_URL = 'https://classroom-insight.onrender.com/api';
      expect(resolveApiUrl('/api/health')).toBe('https://classroom-insight.onrender.com/api/health');
      expect(resolveApiUrl('/api/predictions?goal=regression')).toBe('https://classroom-insight.onrender.com/api/predictions?goal=regression');
    });

    it('handles trailing slash on base URL ending in /api/', () => {
      (import.meta.env as any).VITE_API_BASE_URL = 'https://classroom-insight.onrender.com/api/';
      expect(resolveApiUrl('/api/health')).toBe('https://classroom-insight.onrender.com/api/health');
    });

    it('handles base URL without /api suffix', () => {
      (import.meta.env as any).VITE_API_BASE_URL = 'https://classroom-insight.onrender.com';
      expect(resolveApiUrl('/api/health')).toBe('https://classroom-insight.onrender.com/api/health');
    });
  });

  it('fetches system health from Spring Boot /api/health', async () => {
    const mockHealth = {
      status: 'UP',
      version: '1.0.0',
      timestamp: '2026-10-18T00:00:00Z',
      components: {
        database: { status: 'UP' },
        ml_service: { status: 'UP' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockHealth),
    } as any);

    const res = await api.getHealth();
    expect(res.status).toBe('UP');
    expect(res.components.database?.status).toBe('UP');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
  });

  it('serializes correct query parameters for model list and performance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ goal: 'regression', models: [] }),
    } as any);

    await api.listModels('regression');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/models?goal=regression', expect.any(Object));

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ goal: 'classification', models: [] }),
    } as any);

    await api.getPerformance('classification');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/models/performance?goal=classification', expect.any(Object));
  });

  it('submits prediction request with exact JSON shape to /api/predictions', async () => {
    const requestPayload: PredictionRequest = {
      goal: 'regression',
      mode: 'single',
      model_id: 'random_forest_regressor',
      student_reference: 'TEST-001',
      features: {
        G1: 12,
        G2: 14,
        studytime: 3,
        failures: 0,
        absences: 2,
        schoolsup: 'no',
        famsup: 'yes',
        paid: 'no',
      },
    };

    const mockResponse = {
      prediction_id: '8efb22a0-0000-0000-0000-000000000001',
      goal: 'regression',
      mode: 'single',
      status: 'success',
      student_reference: 'TEST-001',
      features: requestPayload.features,
      results: [
        {
          model_id: 'random_forest_regressor',
          model_version: '1.0.0',
          status: 'success',
          predicted_grade: 13.85,
          predicted_class: null,
          error_message: null,
        },
      ],
      created_at: '2026-10-18T00:00:00Z',
      schema_version: '1.0.0',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const result = await api.createPrediction(requestPayload);
    expect(result.prediction_id).toBe('8efb22a0-0000-0000-0000-000000000001');
    expect(result.results[0].predicted_grade).toBe(13.85);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/predictions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestPayload),
      })
    );
  });

  it('parses structured ApiError when backend returns error envelope', async () => {
    const errorEnvelope = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'G1 must be between 0 and 20',
        details: [{ field: 'G1', issue: 'must be between 0 and 20' }],
        request_id: 'req-42',
      },
      timestamp: '2026-10-18T00:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify(errorEnvelope),
    } as any);

    await expect(api.createPrediction({} as any)).rejects.toThrowError(ApiError);
  });
});
