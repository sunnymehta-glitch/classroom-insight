import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AppHealthResponse } from '../types/api';
import { StatusBadge } from './StatusBadge';
import { Activity, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const [health, setHealth] = useState<AppHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Health check failed');
      setHealth({
        status: 'DOWN',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'DOWN' },
          ml_service: { status: 'DOWN' },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Periodically re-check health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (loading && !health) {
      return <StatusBadge status="neutral" label="Checking health..." size="sm" />;
    }
    if (error && (!health || health.status === 'DOWN')) {
      return (
        <StatusBadge
          status="danger"
          label="Backend Offline"
          size="sm"
        />
      );
    }
    if (health?.status === 'UP') {
      const mlModels = health.components?.ml_service?.details?.models_loaded;
      const countText = mlModels !== undefined ? ` (${mlModels} models ready)` : '';
      return (
        <StatusBadge
          status="success"
          label={`System Healthy${countText}`}
          size="sm"
        />
      );
    }
    if (health?.status === 'DEGRADED') {
      return (
        <StatusBadge
          status="warning"
          label="Degraded (ML offline, History accessible)"
          size="sm"
        />
      );
    }
    return <StatusBadge status="danger" label="System Offline" size="sm" />;
  };

  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between z-20">
      <div className="flex items-center space-x-3">
        <div className="flex items-center text-sm font-semibold text-main">
          <Activity size={18} className="text-primary mr-2" aria-hidden="true" />
          <span>Classroom Insight</span>
          <span className="mx-2 text-border">/</span>
          <span className="text-secondary font-normal text-xs md:text-sm">Academic Trajectory ML Service</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center">
          {getStatusBadge()}
        </div>
        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="p-1.5 rounded-lg text-secondary hover:text-main hover:bg-canvas transition-colors border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-primary"
          title="Refresh system health status"
          aria-label="Refresh system health status"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
