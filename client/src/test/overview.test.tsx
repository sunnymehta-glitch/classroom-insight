import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OverviewScreen } from '../screens/OverviewScreen';

describe('Overview Screen Data-Driven Model Highlights', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const canonicalRegModels = [
    {
      model_id: 'linear_regression',
      name: 'Linear Regression',
      family: 'Linear Regression',
      version: '1.0.0',
      status: 'available',
      description: 'Ordinary least squares linear regression baseline',
      selected_primary_candidate: false,
    },
    {
      model_id: 'random_forest_regressor',
      name: 'Random Forest Regressor',
      family: 'Random Forest',
      version: '1.0.0',
      status: 'available',
      description: 'Ensemble of randomized decision trees',
      selected_primary_candidate: true,
    },
  ];

  const canonicalClsModels = [
    {
      model_id: 'logistic_regression',
      name: 'Logistic Regression',
      family: 'Logistic Regression',
      version: '1.0.0',
      status: 'available',
      description: 'L2-regularized logistic regression baseline',
      selected_primary_candidate: false,
    },
    {
      model_id: 'random_forest_classifier',
      name: 'Random Forest Classifier',
      family: 'Random Forest',
      version: '1.0.0',
      status: 'available',
      description: 'Random forest ensemble for robust pass/fail classification',
      selected_primary_candidate: true,
    },
  ];

  const canonicalRegPerformance = {
    goal: 'regression',
    dataset: 'UCI Student Performance - Mathematics (student-mat.csv)',
    evaluation_strategy: 'Held-out test set (80/20 split), CV (5-fold) on train set',
    test_sample_count: 79,
    generated_at: '2026-10-18T00:00:00Z',
    models: [
      {
        model_id: 'linear_regression',
        name: 'Linear Regression',
        version: '1.0.0',
        status: 'evaluated',
        metrics: {
          mae: 1.3129,
          rmse: 2.0382,
          r2: 0.7931,
        },
      },
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
      },
      {
        model_id: 'ablated_random_forest_regressor',
        name: 'Ablated Random Forest (5 features)',
        version: '1.0.0',
        status: 'evaluated',
        metrics: {
          mae: 1.0737,
          rmse: 1.7073,
          r2: 0.8549,
        },
      },
    ],
  };

  const canonicalClsPerformance = {
    goal: 'classification',
    dataset: 'UCI Student Performance - Mathematics (student-mat.csv)',
    evaluation_strategy: 'Held-out test set (80/20 stratified split), CV (5-fold) on train set',
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
        },
      },
      {
        model_id: 'random_forest_classifier',
        name: 'Random Forest Classifier',
        version: '1.0.0',
        status: 'evaluated',
        metrics: {
          accuracy: 0.8734,
          precision_macro: 0.8537,
          recall_macro: 0.8861,
          f1_macro: 0.8638,
          fail_class_metrics: {
            recall: 0.9231,
            precision: 0.75,
            f1: 0.8276,
          },
        },
      },
    ],
  };

  it('obtains primary regression candidate from API metadata and shows canonical test metrics rather than ablation metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/models?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'regression', models: canonicalRegModels }),
        } as any);
      }
      if (urlStr.includes('/api/models?goal=classification')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'classification', models: canonicalClsModels }),
        } as any);
      }
      if (urlStr.includes('/api/models/performance?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify(canonicalRegPerformance),
        } as any);
      }
      if (urlStr.includes('/api/models/performance?goal=classification')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify(canonicalClsPerformance),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ items: [] }),
      } as any);
    });

    render(
      <BrowserRouter>
        <OverviewScreen />
      </BrowserRouter>
    );

    // Primary regression highlight should show Random Forest Regressor
    expect(await screen.findByText('Primary Model Highlight: Random Forest Regressor')).toBeInTheDocument();

    // Canonical 8-feature test metrics must be displayed: MAE 1.1154, RMSE 1.7787, R² 0.8425
    expect(screen.getByText('1.1154')).toBeInTheDocument();
    expect(screen.getByText('1.7787')).toBeInTheDocument();
    expect(screen.getByText('0.8425')).toBeInTheDocument();

    // Ablation metrics must NOT be displayed
    expect(screen.queryByText('1.0737')).not.toBeInTheDocument();
    expect(screen.queryByText('1.074')).not.toBeInTheDocument();
    expect(screen.queryByText('1.7073')).not.toBeInTheDocument();
    expect(screen.queryByText('1.707')).not.toBeInTheDocument();
  });

  it('obtains primary classification candidate from API metadata and shows selected classifier test metrics', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/models?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'regression', models: canonicalRegModels }),
        } as any);
      }
      if (urlStr.includes('/api/models?goal=classification')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'classification', models: canonicalClsModels }),
        } as any);
      }
      if (urlStr.includes('/api/models/performance?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify(canonicalRegPerformance),
        } as any);
      }
      if (urlStr.includes('/api/models/performance?goal=classification')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify(canonicalClsPerformance),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ items: [] }),
      } as any);
    });

    render(
      <BrowserRouter>
        <OverviewScreen />
      </BrowserRouter>
    );

    // Primary classification highlight must be Random Forest Classifier (selected_primary_candidate: true)
    expect(await screen.findByText('Primary Model Highlight: Random Forest Classifier')).toBeInTheDocument();

    // Test metrics for Random Forest Classifier: Accuracy 87.34%, Macro F1 0.8638, Fail Recall 92.31%
    expect(screen.getByText('87.34%')).toBeInTheDocument();
    expect(screen.getByText('0.8638')).toBeInTheDocument();
    expect(screen.getByText('92.31%')).toBeInTheDocument();

    // Logistic Regression's higher test accuracy (91.14%) must NOT override the primary selection rule
    expect(screen.queryByText('91.14%')).not.toBeInTheDocument();
    expect(screen.queryByText('91.1%')).not.toBeInTheDocument();
  });

  it('dynamically adapts when API returns a different primary candidate without hardcoded override', async () => {
    // Simulate API designating Decision Tree as primary candidate instead
    const dynamicRegModels = [
      {
        model_id: 'decision_tree_regressor',
        name: 'Decision Tree Regressor',
        family: 'Decision Tree',
        version: '1.0.0',
        status: 'available',
        description: 'Pruned decision tree',
        selected_primary_candidate: true,
      },
      {
        model_id: 'random_forest_regressor',
        name: 'Random Forest Regressor',
        family: 'Random Forest',
        version: '1.0.0',
        status: 'available',
        description: 'Random forest',
        selected_primary_candidate: false,
      },
    ];

    const dynamicRegPerf = {
      goal: 'regression',
      dataset: 'UCI Student Performance',
      evaluation_strategy: 'Held-out test set',
      test_sample_count: 79,
      generated_at: '2026-10-18T00:00:00Z',
      models: [
        {
          model_id: 'decision_tree_regressor',
          name: 'Decision Tree Regressor',
          version: '1.0.0',
          status: 'evaluated',
          metrics: {
            mae: 1.1302,
            rmse: 1.8757,
            r2: 0.8248,
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/models?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'regression', models: dynamicRegModels }),
        } as any);
      }
      if (urlStr.includes('/api/models/performance?goal=regression')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify(dynamicRegPerf),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ goal: 'classification', models: [] }),
      } as any);
    });

    render(
      <BrowserRouter>
        <OverviewScreen />
      </BrowserRouter>
    );

    // Should dynamically reflect Decision Tree Regressor as designated primary model
    expect(await screen.findByText('Primary Model Highlight: Decision Tree Regressor')).toBeInTheDocument();
    expect(screen.getByText('1.1302')).toBeInTheDocument();
    expect(screen.getByText('1.8757')).toBeInTheDocument();
    expect(screen.getByText('0.8248')).toBeInTheDocument();
  });

  it('displays clear unavailable state when performance data is missing without fabricating numbers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/models')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ goal: 'regression', models: [] }),
        } as any);
      }
      if (urlStr.includes('/api/models/performance')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ error: { message: 'Performance service down' } }),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ items: [] }),
      } as any);
    });

    render(
      <BrowserRouter>
        <OverviewScreen />
      </BrowserRouter>
    );

    // Must show graceful unavailable message
    const unavailableMessages = await screen.findAllByText(/Primary model evaluation metrics currently unavailable/i);
    expect(unavailableMessages.length).toBeGreaterThan(0);

    // Must not show any fake zero or placeholder values
    expect(screen.queryByText('0.0000')).not.toBeInTheDocument();
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument();
  });
});
