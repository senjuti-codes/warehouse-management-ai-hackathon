"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SettingsState = {
  liveMonitoring: boolean;
  automaticDetection: boolean;
  refreshInterval: string;
  recommendations: boolean;
  confidenceThreshold: string;
  riskPrioritization: string;
  criticalNotifications: boolean;
  approvalNotifications: boolean;
  dailySummary: boolean;
  landingPage: string;
  compactView: boolean;
};

export const defaultSettings: SettingsState = {
  liveMonitoring: true,
  automaticDetection: true,
  refreshInterval: "5 minutes",
  recommendations: true,
  confidenceThreshold: "80% and above",
  riskPrioritization: "Business impact",
  criticalNotifications: true,
  approvalNotifications: true,
  dailySummary: false,
  landingPage: "Control Tower",
  compactView: false,
};

const storageKey = "nexus-warehouse-settings";
type SettingsContextValue = {
  settings: SettingsState;
  hydrated: boolean;
  saveSettings: (settings: SettingsState) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [settings, setSettings] = useState(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setSettings({ ...defaultSettings, ...JSON.parse(stored) });
    } catch {
      setSettings(defaultSettings);
    } finally {
      setHydrated(true);
    }
  }, []);

  const saveSettings = (nextSettings: SettingsState) => {
    setSettings(nextSettings);
    window.localStorage.setItem(storageKey, JSON.stringify(nextSettings));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    window.localStorage.setItem(storageKey, JSON.stringify(defaultSettings));
  };

  const value = useMemo(
    () => ({ settings, hydrated, saveSettings, resetSettings }),
    [settings, hydrated],
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context)
    throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
