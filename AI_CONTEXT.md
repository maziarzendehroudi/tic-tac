# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (12h, 24h et minutes) avec ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Note d'architecture :** Le module `src/game/WatchMechanism.ts` (Atelier de l'Horloger) est conservé en réserve dans le code source mais désactivé du jeu actif.

## 2. Architecture Pédagogique & Visuelle
- **Séparation concentrique sur le cadran (`src/game/Clock.ts`) :**
  - **Piste extérieure bleue (`r - 31`) :** Graduations 0..59 et repères des minutes (`00, 05..55`), alignés avec la pointe de la grande aiguille bleue.
  - **Cercle médian (`r - 72`) :** Heures `1` à `12`.
  - **Cercle intérieur (`r - 114`) :** Pastilles des heures 24h (`13` à `23` et `00`) aux niveaux 5 et 6, alignées avec la pointe de la petite aiguille dorée.
- **Ambiance dynamique Jour / Nuit (`index.html`, `src/style.css`, `src/game/Clock.ts`) :**
  - **Jour (`06h00 - 17h59`) :** Ciel bleu azur, Soleil rayonnant, nuages et médaillon solaire central.
  - **Nuit (`18h00 - 05h59`) :** Ciel nocturne profond, Croissant de lune, étoiles scintillantes et médaillon lunaire central.
