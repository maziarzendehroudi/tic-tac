# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (8 niveaux + Atelier de l'Horloger) avec gestion multi-profils (fratrie) et ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Verrouillage ergonomique :** Interface 100 % fixe (`100dvh`, `overflow: hidden`, `overscroll-behavior: none`), hauteur stabilisée de la zone de messages et de contrôles pour éviter tout déplacement vertical du cadran.

## 2. Progression Pédagogique (8 Niveaux — 24 Étoiles) & Architecture Visuelle
1. **Niveau 1 — Les Heures (12h) :** Petite aiguille orange seule sur le cercle `1..12` (format `3 h`, singulier respecté sur `1 heure`).
2. **Niveau 2 — Les 24 Heures :** Petite aiguille orange seule + couronne intérieure orange `13..00` + pilule de période Jour/Nuit en haut (format `15 h`).
3. **Niveau 3 — Les Minutes :** Grande aiguille bleue seule + piste extérieure bleue de 5 en 5 (`00, 05..55`, chiffres des heures estompés, format `25 min`).
4. **Niveau 4 — Les Demi-Heures (12h) :** Réunion des 2 aiguilles sur `:00` et `:30` + ligne médiane en pointillés.
5. **Niveau 5 — Les Quarts d'Heure (12h) :** Les 2 aiguilles sur `:15`, `:30`, `:45` + repères en croix (`15 = un quart d'heure`, `45 = trois quarts d'heure`).
6. **Niveau 6 — À la Minute près (12h) :** Les 2 aiguilles sur les 60 graduations (`00..59`) avec repères bleus `00..55`.
7. **Niveau 7 — Le Défi Jour & Nuit (24h) :** Toutes les minutes + cycle 24h avec la couronne intérieure orange `13..00`, les repères bleus `00..55` et la pilule de période.
8. **Niveau 8 — L'Horloge des Grands :** Seuls les repères cardinaux `12, 3, 6, 9` sont chiffrés sans bâtons intermédiaires ni couronne orange.

## 3. L'Atelier de l'Horloger (`src/game/WatchMechanism.ts` — Version V50)
- **Récompense finale débloquée après le Niveau 8 :**
  - Mouvement squelette plein cadre dans un Canvas carré `500×500` avec barillet contenu à l'intérieur des graduations (`< 114 px`).
  - **Molette compacte à droite (`x = 138`) à débrayage automatique** et détente continue en `20 s`.
  - **Chaîne cinématique à 5 contacts verrouillés en vitesse réelle (`1000 ms`)**.
  - **3 boutons de zoom sur une seule ligne (`⚙️ Ressort`, `🟠 Heures`, `🔵 Minutes`)** avec affichage cumulatif en opacité maximale (`100 %`).

## 4. Didacticiel Animé Autonome (`src/game/TutorialOverlay.ts` — Version V50)
- **Démo interactive au lancement de chaque niveau (et bouton 💡 dans la barre supérieure) :**
  - Explications en typographie directe sur le fond du ciel, avec pilule dynamique dédiée au Niveau 2 (`le matin : 3h` sur ciel de nuit / `l'après-midi : 15h` sur ciel de jour).
  - Passage automatique à la question ou à l'étape suivante après `3 secondes` lors d'une bonne réponse.
