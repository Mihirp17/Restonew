import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

type Language = 'en' | 'es' | 'ca';

interface Translations {
  [key: string]: string;
}

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, options?: { [key: string]: string | number } | string) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // Default to English, but check localStorage for saved preference
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('restaurant-language') as Language;
      return saved && ['en', 'es', 'ca'].includes(saved) ? saved : 'en';
    }
    return 'en';
  });

  // Load translations from local JSON files
  const { data: translations = {}, isLoading, error } = useQuery({
    queryKey: ['translations', lang],
    queryFn: async () => {
      try {
        const response = await import(`../locales/${lang}.json`);
        return response.default || response;
      } catch (error) {
        console.error(`Failed to load translations for ${lang}:`, error);
        // Fallback to empty object
        return {};
      }
    },
    staleTime: Infinity, // Cache indefinitely since these are static files
  });

  // Update localStorage when language changes
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('restaurant-language', newLang);
    }
  };

  // Translation function
  const t = (key: string, options?: { [key: string]: string | number } | string): string => {
    let text = translations[key];

    if (!text) {
      // If no translation, use fallback if it's a string, otherwise use the key
      return typeof options === 'string' ? options : key;
    }

    if (typeof options === 'object' && options !== null) {
      Object.keys(options).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String((options as any)[k]));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLang must be used within a LanguageProvider');
  }
  return context;
}
