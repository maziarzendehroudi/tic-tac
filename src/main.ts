import './style.css';
import { GameEngine } from './game/GameEngine';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

const canvas = document.getElementById('clockCanvas') as HTMLCanvasElement | null;
if (canvas) {
  new GameEngine(canvas);
}

// Enregistrement propre du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Silencieux en production (Zéro console.log)
    });
  });
}

// Logique du popup d'installation PWA
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installModal = document.getElementById('pwa-install-modal');
const installBtn = document.getElementById('pwa-install-btn');
const closeInstallBtn = document.getElementById('pwa-close-btn');
const installText = document.getElementById('install-text');

const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as NavigatorStandalone).standalone);
const hasDismissed = localStorage.getItem('pwa_install_dismissed');

if (!isStandalone && !hasDismissed) {
  if (isIOS) {
    if (installText) {
      installText.innerHTML = `Pour installer Tic-Tac sur ton iPad ou iPhone, appuie sur le bouton <strong>Partager</strong> <span style="font-size:1.2rem;">⎋</span> puis choisis <strong>"Sur l'écran d'accueil"</strong> <span style="font-size:1.2rem;">➕</span>.`;
    }
    if (installBtn) {
      installBtn.style.display = 'none';
    }
    setTimeout(() => {
      installModal?.classList.remove('hidden');
    }, 2000);
  } else {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setTimeout(() => {
        installModal?.classList.remove('hidden');
      }, 2000);
    });
  }
}

installBtn?.addEventListener('click', async () => {
  if (deferredPrompt) {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installModal?.classList.add('hidden');
  }
});

closeInstallBtn?.addEventListener('click', () => {
  installModal?.classList.add('hidden');
  localStorage.setItem('pwa_install_dismissed', 'true');
});
