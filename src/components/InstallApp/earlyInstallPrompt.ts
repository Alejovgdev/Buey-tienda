// No viene en los tipos del DOM: solo existe en navegadores Chromium
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __ebmInstallPrompt?: BeforeInstallPromptEvent | null;
    __ebmAppInstalled?: boolean;
  }
}

// Va en línea en el <head> del layout, antes de React: si Chrome lanza
// `beforeinstallprompt` o `appinstalled` antes de que se monte InstallAppPrompt,
// lo deja apuntado en window para que el componente lo recoja al montarse
export const EARLY_INSTALL_PROMPT_SCRIPT = `(function () {
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__ebmInstallPrompt = e;
  });
  window.addEventListener('appinstalled', function () {
    window.__ebmInstallPrompt = null;
    window.__ebmAppInstalled = true;
  });
})();`;
