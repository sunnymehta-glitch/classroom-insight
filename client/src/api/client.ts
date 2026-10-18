import {
  AppHealthResponse,
  GoalType,
  HistoryResponse,
  ModelListResponse,
  OutcomeRequest,
  OutcomeResponse,
  PerformanceResponse,
  PredictionRequest,
  PredictionResponse,
  ApiErrorResponse,
} from '../types/api';

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details: Array<{ field?: string; issue: string }>;
  public requestId?: string;

  constructor(message: string, status: number, code: string = 'API_ERROR', details: Array<{ field?: string; issue: string }> = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

async function request<T>(path: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders: HeadersInit = {
    'Accept': 'application/json',
  };

  if (options.body && typeof options.body === 'string') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Read response text to handle both JSON and potential non-JSON errors gracefully
    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      // Parse standardized error response if available
      if (data && typeof data === 'object' && 'error' in data) {
        const errPayload = data as ApiErrorResponse;
        throw new ApiError(
          errPayload.error.message || `Request failed with status ${response.status}`,
          response.status,
          errPayload.error.code || 'UNKNOWN_ERROR',
          errPayload.error.details || [],
          errPayload.error.request_id
        );
      }

      const message = typeof data === 'string' ? data : (data?.message || `HTTP ${response.status} ${response.statusText}`);
      throw new ApiError(message, response.status);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408, 'TIMEOUT');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err.message || 'Unable to connect to the Classroom Insight backend service.',
      0,
      'NETWORK_ERROR'
    );
  }
}

export const api = {
  /**
   * Health check
   */
  async getHealth(): Promise<AppHealthResponse> {
    return request<AppHealthResponse>('/api/health');
  },

  /**
   * List compatible models for a given goal
   */
  async listModels(goal: GoalType): Promise<ModelListResponse> {
    return request<ModelListResponse>(`/api/models?goal=${encodeURIComponent(goal)}`);
  },

  /**
   * Fetch actual offline evaluation performance metrics
   */
  async getPerformance(goal: GoalType): Promise<PerformanceResponse> {
    return request<PerformanceResponse>(`/api/models/performance?goal=${encodeURIComponent(goal)}`);
  },

  /**
   * Submit student features for inference and persistence
   */
  async createPrediction(payload: PredictionRequest): Promise<PredictionResponse> {
    return request<PredictionResponse>('/api/predictions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch paginated prediction history with optional filtering
   */
  async getHistory(params: {
    page?: number;
    size?: number;
    goal?: string;
    q?: string;
    from?: string;
    to?: string;
  } = {}): Promise<HistoryResponse> {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', params.page.toString());
    if (params.size !== undefined) query.set('size', params.size.toString());
    if (params.goal) query.set('goal', params.goal);
    if (params.q) query.set('q', params.q);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

    const queryString = query.toString();
    const endpoint = queryString ? `/api/predictions?${queryString}` : '/api/predictions';
    return request<HistoryResponse>(endpoint);
  },

  /**
   * Fetch single prediction record by ID
   */
  async getPredictionById(id: string): Promise<PredictionResponse> {
    return request<PredictionResponse>(`/api/predictions/${encodeURIComponent(id)}`);
  },

  /**
   * Record verified actual outcome for an existing prediction
   */
  async recordOutcome(predictionId: string, payload: OutcomeRequest): Promise<OutcomeResponse> {
    return request<OutcomeResponse>(`/api/predictions/${encodeURIComponent(predictionId)}/outcome`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
