import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';
import Card from './Card.jsx';
import * as api from '../api/index.js';

export default function ExchangeRates() {
  const { exchangeRates, refreshExchangeRates, t } = useApp();
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Calculate time until next hour (at :00 minutes)
    const calculateTimeUntilNextHour = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();
      // Time until next hour in milliseconds
      return (60 - minutes) * 60 * 1000 - seconds * 1000 - milliseconds;
    };

    // Refresh exchange rates on mount
    refreshExchangeRates();

    // Calculate initial delay until next hour
    const initialDelay = calculateTimeUntilNextHour();
    
    // Set timeout for first refresh at next hour
    const timeoutId = setTimeout(() => {
      refreshExchangeRates();
      
      // Then set interval to refresh every hour at :00
      intervalRef.current = setInterval(() => {
        refreshExchangeRates();
      }, 60 * 60 * 1000); // 1 hour
    }, initialDelay);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshExchangeRates]);

  const loadHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await api.getExchangeRateHistory();
      setHistoryData(data);
      setShowHistory(true);
    } catch (error) {
      // Failed to load history silently ignored
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      const raw = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' }).format(d);
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      return '';
    }
  };

  if (!exchangeRates || exchangeRates.length === 0) {
    return null;
  }

  // Filter to show only Oficial and Blue by default
  const mainRates = exchangeRates.filter(
    (rate) => rate.code === 'USD_OFICIAL' || rate.code === 'USD_BLUE'
  );

  if (mainRates.length === 0) {
    return null;
  }

  const formatMonth = (month) => {
    const months = [
      t('january'), t('february'), t('march'), t('april'), t('may'), t('june'),
      t('july'), t('august'), t('september'), t('october'), t('november'), t('december')
    ];
    return months[month - 1] || month;
  };

  return (
    <Card title={t('exchangeRates')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mainRates.map((rate) => (
          <div
            key={rate.code}
            className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">{rate.name}</h3>
              {rate.code === 'USD_BLUE' && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {t('blue')}
                </span>
              )}
              {rate.code === 'USD_OFICIAL' && (
                <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {t('official')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-xs text-[#616f89] dark:text-gray-400 mb-1">{t('buy')}</p>
                <p className="text-xl font-bold">
                  {rate.buy > 0 ? formatMoney(rate.buy, 'ARS', { sign: 'none' }) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#616f89] dark:text-gray-400 mb-1">{t('sell')}</p>
                <p className="text-xl font-bold">
                  {rate.sell > 0 ? formatMoney(rate.sell, 'ARS', { sign: 'none' }) : '-'}
                </p>
              </div>
            </div>
            {rate.lastUpdate && (
              <p className="text-xs text-[#616f89] dark:text-gray-400 mt-2">
                {t('lastUpdate')}: {formatDate(rate.lastUpdate)}
              </p>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={loadHistory}
          disabled={loadingHistory}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {loadingHistory ? t('loading') : showHistory ? t('hideHistory') : t('showHistory')}
        </button>
      </div>

      {showHistory && historyData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-3">{t('historicalData')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-2">{t('rate')}</th>
                  <th className="text-left p-2">{t('period')}</th>
                  <th className="text-left p-2">{t('buy')}</th>
                  <th className="text-left p-2">{t('sell')}</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{formatMonth(item.month)} {item.year}</td>
                    <td className="p-2">{formatMoney(item.buy, 'ARS', { sign: 'none' })}</td>
                    <td className="p-2">{formatMoney(item.sell, 'ARS', { sign: 'none' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

