import './style.css'
import { GameEngine } from './game/GameEngine'

// Récupération du Canvas principal
const canvas = document.getElementById('clockCanvas') as HTMLCanvasElement;

// Lancement du Moteur de Jeu Interactif
new GameEngine(canvas);