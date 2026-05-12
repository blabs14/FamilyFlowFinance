import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { initI18n, changeLanguage } from '../lib/i18n';

interface LocaleContextType {
  language: string;
  currency: string;
  timezone: string;
  formatCurrency: (value: number) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatNumber: (value: number) => string;
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

// Hook separado para resolver problemas de Fast Refresh
const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale deve ser usado dentro de LocaleProvider');
  }
  return context;
};

export { useLocale };

interface LocaleProviderProps {
  children: ReactNode;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const { data: prefs, isLoading } = useUserPreferences();
  const language = prefs?.language ?? 'pt-PT';
  const currency = prefs?.currency ?? 'EUR';
  const timezone = prefs?.timezone ?? 'Europe/Lisbon';

  // Inicializar i18n quando o idioma mudar
  useEffect(() => {
    initI18n(language);
    changeLanguage(language);
  }, [language]);

  // Funções de formatação
  const formatCurrency = (value: number): string => {
    // Sempre manter formatos europeus mesmo para en-US
    const locale = language === 'en-US' ? 'pt-PT' : language;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Sempre formato europeu (DD/MM/YYYY)
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateObj);
  };

  const formatTime = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Sempre formato 24h
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj);
  };

  const formatNumber = (value: number): string => {
    // Sempre separadores europeus
    return new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const contextValue: LocaleContextType = {
    language,
    currency,
    timezone,
    formatCurrency,
    formatDate,
    formatTime,
    formatNumber,
    isLoading,
  };

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
};