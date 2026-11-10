# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (8 niveaux + Atelier de l'Horloger) avec gestion multi-profils (fratrie) et ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Verrouillage ergonomique :** Interface 100 % fixe (`100dvh`, `overflow: hidden`, `overscroll-behavior: none`), empilement vertical sur une seule colonne sans défilement ni rafraîchissement accidentel.

## 2. Progression Pédagogique (8 Niveaux — 24 Étoiles) & Architecture Visuelle
1. **Niveau 1 — Les Heures (12h) :** Petite aiguille orange seule sur le cercle `1..12` (format `3 h`).
2. **Niveau 2 — Les 24 Heures :** Petite aiguille orange seule + couronne intérieure orange `13..00` + pilule de période Jour/Nuit (format `15 h`).
3. **Niveau 3 — Les Minutes :** Grande aiguille bleue seule + piste extérieure bleue de 5 en 5 (`00, 05..55`, chiffres des heures estompés, format `25 min`).
4. **Niveau 4 — Les Demi-Heures (12h) :** Réunion des 2 aiguilles sur `:00` et `:30` + ligne médiane en pointillés.
5. **Niveau 5 — Les Quarts d'Heure (12h) :** Les 2 aiguilles sur `:15`, `:30`, `:45` + repères en croix.
6. **Niveau 6 — À la Minute près (12h) :** Les 2 aiguilles sur les 60 graduations (`00..59`) en conservant les repères bleus `00..55` pour compter les unités depuis le multiple de 5 le plus proche.
7. **Niveau 7 — Le Défi Jour & Nuit (24h) :** Toutes les minutes + cycle 24h avec la couronne intérieure orange `13..00` et la pilule de période (sans les repères bleus des minutes).
8. **Niveau 8 — L'Horloge des Grands :** Seuls les repères cardinaux `12, 3, 6, 9` sont chiffrés, complétés par 8 index bâtons courts (calcul mental `+12` sans couronne orange).

## 3. L'Atelier de l'Horloger (`src/game/WatchMechanism.ts` — Version V41)
- **Récompense finale débloquée après le Niveau 8 :**
  - Mouvement squelette plein cadre dans un Canvas carré `500×500` (ratio 1:1 sans déformation) avec début de bracelet en haut et en bas.
  - **Molette compacte à droite (`x = 138`) à débrayage automatique :** S'embraye contre le barillet lors du remontage au toucher, s'arrête en bout de course à `100 %`, et s'abaisse automatiquement au relâcher.
  - **Détente rapide et continue du ressort (`20 s`) :** Le ressort se détend en 20 secondes (`5 % / s`) sans aucun saut angulaire entre la fin du remontage et la reprise de la marche.
  - **Chaîne cinématique à 5 contacts verrouillés en vitesse réelle (`1000 ms`) :** Synchronisation mathématique sans glissement des dents du barillet jusqu'à la trotteuse des secondes, avec maintien du son `Tic-Tac` chaque seconde.
  - **4 boutons de zoom manuels (`⚙️ Ressort / Molette`, `🟠 Heures`, `🔵 Minutes`, `🔴 Secondes`) :** Isolent visuellement l'organe étudié en passant le reste du mouvement en gris transparent (`grayscale(100%)`, `globalAlpha = 0.20`).
