import './style.css';
import { GameEngine } from './game/GameEngine';

const canvas = document.getElementById('clockCanvas') as HTMLCanvasElement;
if (canvas) {
  new GameEngine(canvas);
}

// Enregistrement du Service Worker pour la PWA
// Nettoyage radical des anciens Service Workers bloquants et enregistrement du nouveau
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister(); // Force le nettoyage du cache persistant
      }
    }).then(() => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(err => {
        console.log('Erreur SW:', err);
      });
    });
  });
}

// Logique du popup d'installation PWA
let deferredPrompt: any = null;
const installModal = document.getElementById('pwa-install-modal');
const installBtn = document.getElementById('pwa-install-btn');
const closeInstallBtn = document.getElementById('pwa-close-btn');
const installText = document.getElementById('install-text');

const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !(window as any).MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
const hasDismissed = localStorage.getItem('pwa_install_dismissed');

if (!isStandalone && !hasDismissed) {
  if (isIOS) {
    // Instructions spécifiques pour iOS (Safari)
    if (installText) {
      installText.innerHTML = `Pour installer Tic-Tac sur ton iPad ou iPhone, appuie sur le bouton <strong>Partager</strong> <span style="font-size:1.2rem;">⎋</span> puis choisis <strong>"Sur l'écran d'accueil"</strong> <span style="font-size:1.2rem;">➕</span>.`;
    }
    if (installBtn) {
      installBtn.style.display = 'none'; // Pas de prompt natif sur iOS
    }
    // Afficher après 2 secondes pour ne pas brusquer l'ouverture
    setTimeout(() => {
      installModal?.classList.remove('hidden');
    }, 2000);
  } else {
    // Pour Android / Chrome / Edge (capture du beforeinstallprompt)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => {
        installModal?.classList.remove('hidden');
      }, 2000);
    });
  }
}

installBtn?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('Application installée avec succès');
    }
    deferredPrompt = null;
    installModal?.classList.add('hidden');
  }
});

closeInstallBtn?.addEventListener('click', () => {
  installModal?.classList.add('hidden');
  localStorage.setItem('pwa_install_dismissed', 'true');
});