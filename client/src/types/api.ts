/**
 * Classroom Insight - Public API Contract Types
 * Corresponds to Spring Boot DTOs and public API contract.
 */

export type GoalType = 'regression' | 'classification';
export type ModeType = 'single' | 'compare';
export type BinaryChoice = 'yes' | 'no';

export interface StudentFeatures {
  G1: number;
  G2: number;
  studytime: number;
  failures: number;
  absences: number;
  schoolsup: BinaryChoice;
  famsup: BinaryChoice;
  paid: BinaryChoice;
}

export interface ModelInfo {
  model_id: string;
  name: string;
  family: string;
  version: string;
  status: string;
  description: string;
  selected_primary_candidate?: boolean;
}

export interface ModelListResponse {
  goal: GoalType;
  models: ModelInfo[];
}

export interface RegressionTestMetrics {
  mae: number;
  rmse: number;
  r2: number;
}

export interface ClassificationTestMetrics {
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  fail_class_metrics?: {
    recall: number;
    precision: number;
    f1: number;
  };
  pass_class_metrics?: {
    recall: number;
    precision: number;
    f1: number;
  };
  confusion_matrix?: {
    class_labels: string[];
    axes: string;
    matrix: number[][];
  };
}

export interface ModelPerformanceItem {
  model_id: string;
  name: string;
  version: string;
  status: 'evaluated' | 'unevaluated';
  metrics: Record<string, any>;
  cv_metrics?: Record<string, any>;
}

export interface PerformanceResponse {
  goal: GoalType;
  dataset: string;
  evaluation_strategy: string;
  test_sample_count: number;
  generated_at: string;
  models: ModelPerformanceItem[];
}

export interface PredictionRequest {
  goal: GoalType;
  mode: ModeType;
  model_id?: string;
  model_ids?: string[];
  student_reference?: string;
  features: StudentFeatures;
}

export interface ModelPredictionResult {
  model_id: string;
  model_version: string;
  status: 'success' | 'failed';
  predicted_grade: number | null;
  predicted_class: 'pass' | 'fail' | null;
  error_message: string | null;
}

export interface OutcomeResponse {
  outcome_id: string;
  prediction_id: string;
  actual_g3: number;
  actual_pass_status: 'pass' | 'fail';
  source: string;
  verification_status: string;
  notes?: string | null;
  recorded_at: string;
}

export interface PredictionResponse {
  prediction_id: string;
  goal: GoalType;
  mode: ModeType;
  status: 'success' | 'partial_success' | 'failed';
  student_reference?: string | null;
  features: StudentFeatures;
  results: ModelPredictionResult[];
  created_at: string;
  schema_version: string;
  verified_outcome?: OutcomeResponse | null;
}

export interface HistoryItem {
  prediction_id: string;
  goal: GoalType;
  mode: ModeType;
  status: string;
  student_reference?: string | null;
  models_used: string[];
  primary_result: string;
  has_recorded_outcome: boolean;
  created_at: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
  page: number;
  size: number;
  total_elements: number;
  total_pages: number;
}

export interface OutcomeRequest {
  actual_g3: number;
  source?: string;
  verification_status?: string;
  notes?: string;
}

export interface ComponentHealth {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  details?: Record<string, any>;
}

export interface AppHealthResponse {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  version: string;
  timestamp: string;
  components: {
    database?: ComponentHealth;
    ml_service?: ComponentHealth;
    [key: string]: ComponentHealth | undefined;
  };
}

export interface ErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: ErrorDetail[];
  request_id?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  timestamp: string;
}
