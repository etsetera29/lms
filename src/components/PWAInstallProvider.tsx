'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

type DevicePlatform = 'ios' | 'android' | 'desktop';
type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
};

type PWAInstallContextValue = {
  platform: DevicePlatform;
  isSafari: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  install: () => Promise<InstallOutcome>;
};

const PWAInstallContext = createContext<PWAInstallContextValue>({
  platform: 'desktop',
  isSafari: false,
  isInstalled: false,
  canInstall: false,
  install: async () => 'unavailable',
});

export function PWAInstallProvider({children}: {children: React.ReactNode}) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [isSafari, setIsSafari] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Listen from app startup: the browser may fire beforeinstallprompt before the Mobile app tab is opened.
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
    setPlatform(ios ? 'ios' : /Android/i.test(userAgent) ? 'android' : 'desktop');
    setIsSafari(/Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|OPiOS/i.test(userAgent));

    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () => {
      const iosStandalone = (navigator as Navigator & {standalone?: boolean}).standalone === true;
      setIsInstalled(displayMode.matches || iosStandalone);
    };
    updateInstalled();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    displayMode.addEventListener?.('change', updateInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayMode.removeEventListener?.('change', updateInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!promptEvent || isInstalled) return 'unavailable';
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null); // The deferred prompt can only be consumed once.
      return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      setPromptEvent(null);
      return 'unavailable';
    }
  }, [promptEvent, isInstalled]);

  const value = useMemo(() => ({
    platform, isSafari, isInstalled, canInstall: Boolean(promptEvent) && !isInstalled, install,
  }), [platform, isSafari, isInstalled, promptEvent, install]);

  return <PWAInstallContext.Provider value={value}>{children}</PWAInstallContext.Provider>;
}

export const usePWAInstall = () => useContext(PWAInstallContext);
