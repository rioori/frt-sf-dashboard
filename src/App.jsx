/**
 * FRT × Samsung Finance+ Store Performance Dashboard
 * With Supabase Realtime Sync
 * 
 * Features:
 * - Auto-fetch data from Supabase on load
 * - Manual refresh button
 * - Auto-refresh every 5 minutes (configurable)
 * - Loading states
 * - Error handling
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, TrendingDown, Minus, Store, Search, Zap, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xwgnwyqdojljjfglbytw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  MERCHANT_NAME: "FRT",
  MERCHANT_FULL_NAME: "FPT Retail",
  TABLE_NAME: "KVVN_SF_FRT_Store_Level",
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  THRESHOLDS: {
    approval: [60, 50],
    conversion: [40, 30],
    storePenetration: [70, 50]
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const formatCurrency = (value) => {
  if (!value) return '-';
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toLocaleString();
};

const formatTime = (date) => {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const TrendIcon = ({ current, previous, className = "" }) => {
  if (previous === undefined || previous === null || current === previous) 
    return <Minus className={`w-2.5 h-2.5 text-slate-500 ${className}`} />;
  if (current > previous) 
    return <TrendingUp className={`w-2.5 h-2.5 text-emerald-400 ${className}`} />;
  return <TrendingDown className={`w-2.5 h-2.5 text-rose-400 ${className}`} />;
};

const RateBadge = ({ value, thresholds = [60, 50] }) => {
  if (value === null || value === undefined) return <span className="text-slate-600">-</span>;
  const color = value >= thresholds[0] 
    ? 'bg-emerald-500/20 text-emerald-400' 
    : value >= thresholds[1] 
      ? 'bg-amber-500/20 text-amber-400' 
      : 'bg-rose-500/20 text-rose-400';
  return <span className={`px-1.5 py-0.5 rounded text-[10px] ${color}`}>{value.toFixed(0)}%</span>;
};

const MiniSparkline = ({ data, color = "#22d3ee" }) => {
  if (!data || data.length < 2) return <div className="w-10 h-5" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 40},${20 - ((v - min) / range) * 16}`).join(' ');
  
  return (
    <svg viewBox="0 0 40 20" className="w-10 h-5 flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

const SortIcon = ({ field, sortConfig }) => {
  if (sortConfig.key !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-slate-600" />;
  return sortConfig.direction === 'desc' 
    ? <ChevronDown className="w-2.5 h-2.5 text-cyan-400" />
    : <ChevronUp className="w-2.5 h-2.5 text-cyan-400" />;
};

// ============================================================================
// DATA FETCHING
// ============================================================================
async function fetchMonthlyData() {
  const { data, error } = await supabase
    .from(CONFIG.TABLE_NAME)
    .select('application_month, dealer_code, net_incoming, approved, trx_settled, gmv');
  
  if (error) throw error;
  
  // Group by month
  const monthlyMap = {};
  const storeMonthlyData = {};
  
  data.forEach(row => {
    const month = row.application_month.substring(0, 7); // YYYY-MM
    
    // Monthly aggregates
    if (!monthlyMap[month]) {
      monthlyMap[month] = {
        month,
        totalStores: new Set(),
        storesWithIncoming: new Set(),
        storesWithTrx: new Set(),
        incoming: 0,
        approved: 0,
        trx: 0,
        gmv: 0
      };
    }
    
    monthlyMap[month].totalStores.add(row.dealer_code);
    if (row.net_incoming > 0) monthlyMap[month].storesWithIncoming.add(row.dealer_code);
    if (row.trx_settled > 0) monthlyMap[month].storesWithTrx.add(row.dealer_code);
    monthlyMap[month].incoming += row.net_incoming || 0;
    monthlyMap[month].approved += row.approved || 0;
    monthlyMap[month].trx += row.trx_settled || 0;
    monthlyMap[month].gmv += parseFloat(row.gmv) || 0;
    
    // Store-level data
    if (!storeMonthlyData[row.dealer_code]) {
      storeMonthlyData[row.dealer_code] = {};
    }
    storeMonthlyData[row.dealer_code][month] = {
      incoming: row.net_incoming || 0,
      approved: row.approved || 0,
      trx: row.trx_settled || 0,
      gmv: parseFloat(row.gmv) || 0
    };
  });
  
  // Convert to arrays
  const monthlyData = Object.values(monthlyMap)
    .map(m => ({
      month: m.month,
      label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      quarter: `Q${Math.ceil((new Date(m.month + '-01').getMonth() + 1) / 3)}`,
      totalStores: m.totalStores.size,
      storesWithSF: m.totalStores.size,
      storesWithIncoming: m.storesWithIncoming.size,
      storesWithTrx: m.storesWithTrx.size,
      incoming: m.incoming,
      approved: m.approved,
      trx: m.trx,
      gmv: m.gmv
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  return { monthlyData, storeMonthlyData };
}

async function fetchStoreData() {
  const { data, error } = await supabase
    .from(CONFIG.TABLE_NAME)
    .select('dealer_code, submerchant')
    .order('dealer_code');
  
  if (error) throw error;
  
  // Get unique stores
  const storeMap = {};
  data.forEach(row => {
    if (!storeMap[row.dealer_code]) {
      storeMap[row.dealer_code] = {
        code: row.dealer_code,
        name: row.submerchant || row.dealer_code
      };
    }
  });
  
  return Object.values(storeMap);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function FRTDashboard() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [storeData, setStoreData] = useState([]);
  const [storeMonthlyData, setStoreMonthlyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'totalTrx', direction: 'desc' });

  // Fetch all data
  const fetchData = useCallback(async (showRefreshing = true) => {
    if (showRefreshing) setIsRefreshing(true);
    setError(null);
    
    try {
      const [{ monthlyData: monthly, storeMonthlyData: storeMonthly }, stores] = await Promise.all([
        fetchMonthlyData(),
        fetchStoreData()
      ]);
      
      // Merge store monthly data
      const enrichedStores = stores.map(store => ({
        ...store,
        data: storeMonthly[store.code] || {}
      }));
      
      setMonthlyData(monthly);
      setStoreData(enrichedStores);
      setStoreMonthlyData(storeMonthly);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData(false);
    
    const interval = setInterval(() => {
      fetchData(true);
    }, CONFIG.AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate derived data
  const months = useMemo(() => monthlyData.map(m => m.month), [monthlyData]);
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  const quarterlyData = useMemo(() => {
    return quarters.map(q => {
      const qMonths = monthlyData.filter(m => m.quarter === q);
      if (qMonths.length === 0) return null;
      const lastMonth = qMonths[qMonths.length - 1];
      return {
        quarter: q,
        incoming: qMonths.reduce((s, m) => s + m.incoming, 0),
        approved: qMonths.reduce((s, m) => s + m.approved, 0),
        trx: qMonths.reduce((s, m) => s + m.trx, 0),
        gmv: qMonths.reduce((s, m) => s + m.gmv, 0),
        totalStores: lastMonth.totalStores,
        storesWithSF: lastMonth.storesWithSF,
        storesWithIncoming: Math.round(qMonths.reduce((s, m) => s + m.storesWithIncoming, 0) / qMonths.length),
        storesWithTrx: Math.round(qMonths.reduce((s, m) => s + m.storesWithTrx, 0) / qMonths.length),
      };
    }).filter(Boolean);
  }, [monthlyData]);

  const processedStores = useMemo(() => {
    return storeData.map(store => {
      const totalIncoming = Object.values(store.data).reduce((sum, d) => sum + (d.incoming || 0), 0);
      const totalApproved = Object.values(store.data).reduce((sum, d) => sum + (d.approved || 0), 0);
      const totalTrx = Object.values(store.data).reduce((sum, d) => sum + (d.trx || 0), 0);
      const totalGMV = Object.values(store.data).reduce((sum, d) => sum + (d.gmv || 0), 0);
      
      const monthlyMetrics = {};
      months.forEach(m => {
        const d = store.data[m];
        if (d) {
          monthlyMetrics[`${m}_incoming`] = d.incoming || 0;
          monthlyMetrics[`${m}_trx`] = d.trx || 0;
          monthlyMetrics[`${m}_gmv`] = d.gmv || 0;
          monthlyMetrics[`${m}_appr`] = d.incoming ? (d.approved / d.incoming) * 100 : 0;
          monthlyMetrics[`${m}_conv`] = d.incoming ? (d.trx / d.incoming) * 100 : 0;
        } else {
          monthlyMetrics[`${m}_incoming`] = 0;
          monthlyMetrics[`${m}_trx`] = 0;
          monthlyMetrics[`${m}_gmv`] = 0;
          monthlyMetrics[`${m}_appr`] = 0;
          monthlyMetrics[`${m}_conv`] = 0;
        }
      });
      
      return {
        ...store,
        totalIncoming,
        totalApproved,
        totalTrx,
        totalGMV,
        avgConversion: totalIncoming ? (totalTrx / totalIncoming) * 100 : 0,
        avgApproval: totalIncoming ? (totalApproved / totalIncoming) * 100 : 0,
        ...monthlyMetrics,
      };
    });
  }, [storeData, months]);

  const filteredStores = useMemo(() => {
    let filtered = processedStores.filter(s => 
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] || 0;
        const bVal = b[sortConfig.key] || 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered;
  }, [processedStores, searchTerm, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const totals = useMemo(() => ({
    incoming: monthlyData.reduce((sum, m) => sum + m.incoming, 0),
    approved: monthlyData.reduce((sum, m) => sum + m.approved, 0),
    trx: monthlyData.reduce((sum, m) => sum + m.trx, 0),
    gmv: monthlyData.reduce((sum, m) => sum + m.gmv, 0),
  }), [monthlyData]);

  const latestMonth = monthlyData[monthlyData.length - 1];

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 max-w-md">
          <WifiOff className="w-8 h-8 text-rose-400 mx-auto mb-4" />
          <h2 className="text-rose-400 font-semibold mb-2">Connection Error</h2>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button 
            onClick={() => fetchData()}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white text-xs">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-[1900px] mx-auto p-4">
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  {CONFIG.MERCHANT_NAME} × Samsung Finance+
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5" /> Live
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Store Performance Dashboard • {CONFIG.MERCHANT_FULL_NAME}</p>
            </div>
            
            {/* Refresh Controls */}
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  Updated {formatTime(lastUpdated)}
                </div>
              )}
              <button
                onClick={() => fetchData()}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-slate-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        {/* ================================================================== */}
        {/* QUARTERLY OVERVIEW */}
        {/* ================================================================== */}
        <section className="mb-4">
          <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">📅 Quarterly Overview</h2>
          <div className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="text-left p-2 sticky left-0 bg-slate-800/90 backdrop-blur z-10 min-w-[140px] text-slate-400 font-medium">Metric</th>
                    <th className="p-2 text-center min-w-[90px] text-slate-500 font-medium bg-cyan-500/10">YTD Total</th>
                    {quarterlyData.map((q) => (
                      <th key={q.quarter} className="p-2 text-center min-w-[90px] text-slate-400 font-medium border-l border-white/5">
                        {q.quarter} 2025
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Store Metrics Section */}
                  <tr className="border-t border-white/5 bg-slate-800/30">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-400 font-medium" colSpan={2 + quarterlyData.length}>
                      <span className="text-[9px] uppercase tracking-wider">Store Metrics</span>
                    </td>
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{latestMonth?.totalStores || '-'}</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {q.totalStores}
                        <TrendIcon current={q.totalStores} previous={quarterlyData[idx-1]?.totalStores} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ SF+</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{latestMonth?.storesWithSF || '-'} <span className="text-slate-500 text-[9px]">(100%)</span></td>
                    {quarterlyData.map((q) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {q.storesWithSF} <span className="text-slate-500 text-[9px]">(100%)</span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ Incoming</td>
                    <td className="p-2 text-center text-slate-300 bg-cyan-500/5">-</td>
                    {quarterlyData.map((q) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {q.storesWithIncoming} <span className="text-slate-500 text-[9px]">({((q.storesWithIncoming/q.totalStores)*100).toFixed(0)}%)</span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ Trx</td>
                    <td className="p-2 text-center text-slate-300 bg-cyan-500/5">-</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {q.storesWithTrx}
                        <TrendIcon current={q.storesWithTrx} previous={quarterlyData[idx-1]?.storesWithTrx} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">% Stores w/ Trx</td>
                    <td className="p-2 text-center bg-cyan-500/5">-</td>
                    {quarterlyData.map(q => (
                      <td key={q.quarter} className="p-2 text-center border-l border-white/5">
                        <RateBadge value={(q.storesWithTrx / q.totalStores) * 100} thresholds={CONFIG.THRESHOLDS.storePenetration} />
                      </td>
                    ))}
                  </tr>

                  {/* Transaction Metrics Section */}
                  <tr className="border-t border-white/5 bg-slate-800/30">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-400 font-medium" colSpan={2 + quarterlyData.length}>
                      <span className="text-[9px] uppercase tracking-wider">Transaction Metrics</span>
                    </td>
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Incoming</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{totals.incoming.toLocaleString()}</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {q.incoming.toLocaleString()}
                        <TrendIcon current={q.incoming} previous={quarterlyData[idx-1]?.incoming} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5 bg-cyan-500/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-cyan-300 font-medium">Trx</td>
                    <td className="p-2 text-center font-bold text-white bg-cyan-500/10">{totals.trx.toLocaleString()}</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center font-semibold text-white border-l border-white/5">
                        {q.trx.toLocaleString()}
                        <TrendIcon current={q.trx} previous={quarterlyData[idx-1]?.trx} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">GMV</td>
                    <td className="p-2 text-center font-semibold text-cyan-300 bg-cyan-500/5">{formatCurrency(totals.gmv)}</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center text-cyan-300 border-l border-white/5">
                        {formatCurrency(q.gmv)}
                        <TrendIcon current={q.gmv} previous={quarterlyData[idx-1]?.gmv} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">AOV</td>
                    <td className="p-2 text-center font-semibold text-slate-300 bg-cyan-500/5">{formatCurrency(totals.gmv / totals.trx)}</td>
                    {quarterlyData.map((q, idx) => (
                      <td key={q.quarter} className="p-2 text-center text-slate-300 border-l border-white/5">
                        {formatCurrency(q.gmv / q.trx)}
                        <TrendIcon current={q.gmv / q.trx} previous={quarterlyData[idx-1] ? quarterlyData[idx-1].gmv / quarterlyData[idx-1].trx : null} className="inline ml-1" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Appr %</td>
                    <td className="p-2 text-center bg-cyan-500/5"><RateBadge value={(totals.approved / totals.incoming) * 100} thresholds={CONFIG.THRESHOLDS.approval} /></td>
                    {quarterlyData.map(q => (
                      <td key={q.quarter} className="p-2 text-center border-l border-white/5">
                        <RateBadge value={(q.approved / q.incoming) * 100} thresholds={CONFIG.THRESHOLDS.approval} />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Conv %</td>
                    <td className="p-2 text-center bg-cyan-500/5"><RateBadge value={(totals.trx / totals.incoming) * 100} thresholds={CONFIG.THRESHOLDS.conversion} /></td>
                    {quarterlyData.map(q => (
                      <td key={q.quarter} className="p-2 text-center border-l border-white/5">
                        <RateBadge value={(q.trx / q.incoming) * 100} thresholds={CONFIG.THRESHOLDS.conversion} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* MONTHLY METRICS */}
        {/* ================================================================== */}
        <section className="mb-4">
          <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">📊 Monthly Metrics</h2>
          <div className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="text-left p-2 sticky left-0 bg-slate-800/90 backdrop-blur z-10 min-w-[140px] text-slate-400 font-medium">Metric</th>
                    <th className="p-2 text-center min-w-[70px] text-slate-500 font-medium bg-cyan-500/10">Total</th>
                    {monthlyData.map(m => (
                      <th key={m.month} className="p-2 text-center min-w-[60px] text-slate-500 font-medium">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Store Metrics */}
                  <tr className="border-t border-white/5 bg-slate-800/30">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-400 font-medium" colSpan={2 + monthlyData.length}>
                      <span className="text-[9px] uppercase tracking-wider">Store Metrics</span>
                    </td>
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{latestMonth?.totalStores || '-'}</td>
                    {monthlyData.map((m, idx) => (
                      <td key={m.month} className="p-2 text-center text-slate-300">
                        {m.totalStores}
                        <TrendIcon current={m.totalStores} previous={monthlyData[idx-1]?.totalStores} className="inline ml-0.5" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ SF+</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{latestMonth?.storesWithSF || '-'}</td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center text-slate-300">{m.storesWithSF}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ Incoming</td>
                    <td className="p-2 text-center text-slate-300 bg-cyan-500/5">-</td>
                    {monthlyData.map((m, idx) => (
                      <td key={m.month} className="p-2 text-center text-slate-300">
                        {m.storesWithIncoming}
                        <TrendIcon current={m.storesWithIncoming} previous={monthlyData[idx-1]?.storesWithIncoming} className="inline ml-0.5" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300"># Stores w/ Trx</td>
                    <td className="p-2 text-center text-slate-300 bg-cyan-500/5">-</td>
                    {monthlyData.map((m, idx) => (
                      <td key={m.month} className="p-2 text-center text-slate-300">
                        {m.storesWithTrx}
                        <TrendIcon current={m.storesWithTrx} previous={monthlyData[idx-1]?.storesWithTrx} className="inline ml-0.5" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">% Stores w/ Trx</td>
                    <td className="p-2 text-center bg-cyan-500/5">-</td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center">
                        <RateBadge value={(m.storesWithTrx / m.totalStores) * 100} thresholds={CONFIG.THRESHOLDS.storePenetration} />
                      </td>
                    ))}
                  </tr>

                  {/* Transaction Metrics */}
                  <tr className="border-t border-white/5 bg-slate-800/30">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-400 font-medium" colSpan={2 + monthlyData.length}>
                      <span className="text-[9px] uppercase tracking-wider">Transaction Metrics</span>
                    </td>
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Incoming</td>
                    <td className="p-2 text-center font-semibold text-white bg-cyan-500/5">{totals.incoming.toLocaleString()}</td>
                    {monthlyData.map((m, idx) => (
                      <td key={m.month} className="p-2 text-center text-slate-300">
                        {m.incoming.toLocaleString()}
                        <TrendIcon current={m.incoming} previous={monthlyData[idx-1]?.incoming} className="inline ml-0.5" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5 bg-cyan-500/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-cyan-300 font-medium">Trx</td>
                    <td className="p-2 text-center font-bold text-white bg-cyan-500/10">{totals.trx.toLocaleString()}</td>
                    {monthlyData.map((m, idx) => (
                      <td key={m.month} className="p-2 text-center font-semibold text-white">
                        {m.trx.toLocaleString()}
                        <TrendIcon current={m.trx} previous={monthlyData[idx-1]?.trx} className="inline ml-0.5" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">GMV</td>
                    <td className="p-2 text-center font-semibold text-cyan-300 bg-cyan-500/5">{formatCurrency(totals.gmv)}</td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center text-cyan-300">{formatCurrency(m.gmv)}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">AOV</td>
                    <td className="p-2 text-center font-semibold text-slate-300 bg-cyan-500/5">{formatCurrency(totals.gmv / totals.trx)}</td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center text-slate-300">{formatCurrency(m.trx ? m.gmv / m.trx : 0)}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Appr %</td>
                    <td className="p-2 text-center bg-cyan-500/5"><RateBadge value={(totals.approved / totals.incoming) * 100} thresholds={CONFIG.THRESHOLDS.approval} /></td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center"><RateBadge value={(m.approved / m.incoming) * 100} thresholds={CONFIG.THRESHOLDS.approval} /></td>
                    ))}
                  </tr>
                  <tr className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 sticky left-0 bg-slate-900/90 backdrop-blur text-slate-300">Conv %</td>
                    <td className="p-2 text-center bg-cyan-500/5"><RateBadge value={(totals.trx / totals.incoming) * 100} thresholds={CONFIG.THRESHOLDS.conversion} /></td>
                    {monthlyData.map(m => (
                      <td key={m.month} className="p-2 text-center"><RateBadge value={(m.trx / m.incoming) * 100} thresholds={CONFIG.THRESHOLDS.conversion} /></td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* STORE PERFORMANCE */}
        {/* ================================================================== */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Store className="w-3 h-3" /> Store Performance
            </h2>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search store..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-48"
              />
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800/80">
                    <th className="p-2 sticky left-0 bg-slate-800/90 backdrop-blur z-20 min-w-[160px]" rowSpan={2}>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium">Store</span>
                        <button onClick={() => handleSort('totalTrx')} className="p-0.5 hover:bg-white/10 rounded">
                          <SortIcon field="totalTrx" sortConfig={sortConfig} />
                        </button>
                      </div>
                    </th>
                    <th className="p-2 text-center min-w-[50px] bg-cyan-500/20 border-l border-white/10" colSpan={5}>
                      <span className="text-cyan-300 font-bold text-[10px]">Total</span>
                    </th>
                    {monthlyData.map(m => (
                      <th key={m.month} className="p-1.5 text-center min-w-[50px] border-l border-white/5" colSpan={5}>
                        <span className="text-slate-300 font-medium text-[10px]">{m.label}</span>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-800/50 text-[9px] text-slate-500">
                    <th className="p-1 text-center bg-cyan-500/10 border-l border-white/10 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('totalIncoming')}>
                      <span className="flex items-center justify-center gap-0.5">Inc <SortIcon field="totalIncoming" sortConfig={sortConfig} /></span>
                    </th>
                    <th className="p-1 text-center bg-cyan-500/10 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('totalTrx')}>
                      <span className="flex items-center justify-center gap-0.5">Trx <SortIcon field="totalTrx" sortConfig={sortConfig} /></span>
                    </th>
                    <th className="p-1 text-center bg-cyan-500/10 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('totalGMV')}>
                      <span className="flex items-center justify-center gap-0.5">GMV <SortIcon field="totalGMV" sortConfig={sortConfig} /></span>
                    </th>
                    <th className="p-1 text-center bg-cyan-500/10 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('avgApproval')}>
                      <span className="flex items-center justify-center gap-0.5">Apr% <SortIcon field="avgApproval" sortConfig={sortConfig} /></span>
                    </th>
                    <th className="p-1 text-center bg-cyan-500/10 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('avgConversion')}>
                      <span className="flex items-center justify-center gap-0.5">Cnv% <SortIcon field="avgConversion" sortConfig={sortConfig} /></span>
                    </th>
                    {monthlyData.map(m => (
                      <React.Fragment key={m.month}>
                        <th className="p-1 text-center border-l border-white/5 cursor-pointer hover:text-cyan-400" onClick={() => handleSort(`${m.month}_incoming`)}>
                          <span className="flex items-center justify-center gap-0.5">Inc <SortIcon field={`${m.month}_incoming`} sortConfig={sortConfig} /></span>
                        </th>
                        <th className="p-1 text-center cursor-pointer hover:text-cyan-400" onClick={() => handleSort(`${m.month}_trx`)}>
                          <span className="flex items-center justify-center gap-0.5">Trx <SortIcon field={`${m.month}_trx`} sortConfig={sortConfig} /></span>
                        </th>
                        <th className="p-1 text-center cursor-pointer hover:text-cyan-400" onClick={() => handleSort(`${m.month}_gmv`)}>
                          <span className="flex items-center justify-center gap-0.5">GMV <SortIcon field={`${m.month}_gmv`} sortConfig={sortConfig} /></span>
                        </th>
                        <th className="p-1 text-center cursor-pointer hover:text-cyan-400" onClick={() => handleSort(`${m.month}_appr`)}>
                          <span className="flex items-center justify-center gap-0.5">Apr% <SortIcon field={`${m.month}_appr`} sortConfig={sortConfig} /></span>
                        </th>
                        <th className="p-1 text-center cursor-pointer hover:text-cyan-400" onClick={() => handleSort(`${m.month}_conv`)}>
                          <span className="flex items-center justify-center gap-0.5">Cnv% <SortIcon field={`${m.month}_conv`} sortConfig={sortConfig} /></span>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => {
                    const trxTrend = months.map(m => store.data[m]?.trx || 0);
                    
                    return (
                      <tr key={store.code} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-2 sticky left-0 bg-slate-900/95 backdrop-blur z-10">
                          <div className="flex items-center gap-2">
                            <MiniSparkline data={trxTrend} />
                            <div className="min-w-0">
                              <p className="font-medium text-white text-[11px]">{store.code}</p>
                              <p className="text-[9px] text-slate-500 truncate max-w-[100px]">{store.name}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-1.5 text-center bg-cyan-500/5 border-l border-white/10 text-slate-300">{store.totalIncoming}</td>
                        <td className="p-1.5 text-center bg-cyan-500/5 font-semibold text-white">{store.totalTrx}</td>
                        <td className="p-1.5 text-center bg-cyan-500/5 text-cyan-300 font-medium text-[10px]">{formatCurrency(store.totalGMV)}</td>
                        <td className="p-1.5 text-center bg-cyan-500/5"><RateBadge value={store.avgApproval} thresholds={CONFIG.THRESHOLDS.approval} /></td>
                        <td className="p-1.5 text-center bg-cyan-500/5"><RateBadge value={store.avgConversion} thresholds={CONFIG.THRESHOLDS.conversion} /></td>

                        {monthlyData.map((m, idx) => {
                          const d = store.data[m.month];
                          const prevD = store.data[months[idx-1]];
                          const apprRate = d && d.incoming ? (d.approved / d.incoming) * 100 : null;
                          const convRate = d && d.incoming ? (d.trx / d.incoming) * 100 : null;
                          
                          return (
                            <React.Fragment key={m.month}>
                              <td className="p-1 text-center border-l border-white/5 text-slate-400">
                                {d ? (
                                  <span className="inline-flex items-center justify-center gap-0.5">
                                    {d.incoming}
                                    <TrendIcon current={d.incoming} previous={prevD?.incoming} />
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="p-1 text-center font-semibold text-white">
                                {d ? (
                                  <span className="inline-flex items-center justify-center gap-0.5">
                                    {d.trx}
                                    <TrendIcon current={d.trx} previous={prevD?.trx} />
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="p-1 text-center text-cyan-300 text-[10px]">
                                {d?.gmv ? formatCurrency(d.gmv) : '-'}
                              </td>
                              <td className="p-1 text-center">
                                <RateBadge value={apprRate} thresholds={CONFIG.THRESHOLDS.approval} />
                              </td>
                              <td className="p-1 text-center">
                                <RateBadge value={convRate} thresholds={CONFIG.THRESHOLDS.conversion} />
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <p className="text-[9px] text-slate-600 mt-2 text-center">
            Showing {filteredStores.length} stores • Auto-refresh every 5 mins • Click column headers to sort
          </p>
        </section>
      </div>
    </div>
  );
}
