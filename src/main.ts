import './style.css';
import { GameEngine } from './game/GameEngine';

const canvas = document.getElementById('clockCanvas') as HTMLCanvasElement;
if (canvas) {
  new GameEngine(canvas);
}

// Enregistrement du Service Worker pour la PWA (mode hors-ligne & installation)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Erreur d enregistrement du Service Worker :', err);
    });
  });
}