import './style.css';
import { GameEngine } from './game/GameEngine';

const canvas = document.getElementById('clockCanvas') as HTMLCanvasElement;
if (canvas) {
  new GameEngine(canvas);
}