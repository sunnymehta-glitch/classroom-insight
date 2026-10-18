import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  History,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      to: '/predict',
      label: 'New Prediction',
      icon: Sparkles,
    },
    {
      to: '/history',
      label: 'Prediction History',
      icon: History,
    },
    {
      to: '/performance',
      label: 'Model Performance',
      icon: BarChart3,
    },
  ];

  return (
    <aside
      className={`bg-sidebar text-white flex flex-col transition-all duration-200 z-30 flex-shrink-0 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <GraduationCap className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-semibold text-sm tracking-tight text-white truncate">
                Classroom Insight
              </span>
              <span className="text-[11px] text-white/60 truncate font-mono">
                ML Academic System
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : 'space-x-3'}`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={19} className="flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/10">
        {!collapsed ? (
          <div className="px-2 py-1 text-[11px] text-white/40">
            <div>v1.0.0 LTS Architecture</div>
            <div className="truncate">UCI Student Performance ML</div>
          </div>
        ) : (
          <div className="text-center text-[10px] text-white/40 font-mono">
            v1.0
          </div>
        )}
      </div>
    </aside>
  );
};
