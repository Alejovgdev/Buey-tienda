'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'ebm_consent_v1';
const CONSENT_VERSION = '1';
const EXPIRY_MONTHS = 24;

export interface ConsentCategories {
  funcional: boolean;
  analisis: boolean;
}

interface StoredConsent {
  version: string;
  date: string;
  decided: boolean;
  categories: ConsentCategories;
}

interface ConsentContextValue {
  consent: ConsentCategories;
  decided: boolean;
  isLoaded: boolean;
  isPanelOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  saveCategories: (cats: ConsentCategories) => void;
  openPanel: () => void;
  closePanel: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStorage(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredConsent;
    if (data.version !== CONSENT_VERSION) return null;
    const saved = new Date(data.date);
    const expiry = new Date(saved);
    expiry.setMonth(expiry.getMonth() + EXPIRY_MONTHS);
    if (new Date() > expiry) return null;
    return data;
  } catch {
    return null;
  }
}

function writeStorage(data: StoredConsent): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

const DEFAULT_CATEGORIES: ConsentCategories = { funcional: false, analisis: false };

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [decided, setDecided] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentCategories>(DEFAULT_CATEGORIES);

  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      setConsent(stored.categories);
      setDecided(stored.decided);
    }
    setIsLoaded(true);
  }, []);

  const persist = useCallback((categories: ConsentCategories, isDecided: boolean) => {
    writeStorage({
      version: CONSENT_VERSION,
      date: new Date().toISOString(),
      decided: isDecided,
      categories,
    });
    setConsent(categories);
    setDecided(isDecided);
  }, []);

  const acceptAll = useCallback(() => {
    persist({ funcional: true, analisis: true }, true);
    setIsPanelOpen(false);
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist({ funcional: false, analisis: false }, true);
    setIsPanelOpen(false);
  }, [persist]);

  const saveCategories = useCallback(
    (cats: ConsentCategories) => {
      persist(cats, true);
      setIsPanelOpen(false);
    },
    [persist]
  );

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  return (
    <ConsentContext.Provider
      value={{
        consent,
        decided,
        isLoaded,
        isPanelOpen,
        acceptAll,
        rejectAll,
        saveCategories,
        openPanel,
        closePanel,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}
