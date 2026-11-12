# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (8 niveaux + L'atelier de l'horloger) avec gestion multi-profils (fratrie) et ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Verrouillage ergonomique :** Interface 100 % fixe (`100dvh`, `overflow: hidden`, `overscroll-behavior: none`), hauteur stabilisée de la zone de messages et de contrôles pour éviter tout déplacement vertical du cadran.

## 2. Progression Pédagogique (8 Niveaux — 24 Étoiles) & Architecture Visuelle
1. **Niveau 1 — Les 12 heures :** Petite aiguille orange seule sur le cercle `1..12` (format `3 h`, singulier respecté sur `1 heure`).
2. **Niveau 2 — Les 24 heures :** Petite aiguille orange seule + couronne intérieure orange `13..00` + pilule de période Jour/Nuit en haut (format `15 h`).
3. **Niveau 3 — Les minutes :** Grande aiguille bleue seule + piste extérieure bleue de 5 en 5 (`00, 05..55`, chiffres des heures estompés, format `25 min`).
4. **Niveau 4 — Les demi-heures :** Réunion des 2 aiguilles sur `:00` et `:30` + ligne médiane en pointillés.
5. **Niveau 5 — Les quarts d'heure :** Les 2 aiguilles sur `:15`, `:30`, `:45` + repères en croix (`0 = heure pile`, `15 = un quart d'heure`, `30 = demie heure`, `45 = trois quarts d'heure`).
6. **Niveau 6 — À la minute près :** Les 2 aiguilles sur les 60 graduations (`00..59`) avec repères bleus `00..55`.
7. **Niveau 7 — Le défi jour & nuit :** Toutes les minutes + cycle 24h avec la couronne intérieure orange `13..00`, les repères bleus `00..55` et la pilule de période.
8. **Niveau 8 — L'horloge des grands :** Seuls les repères cardinaux `12, 3, 6, 9` sont chiffrés sans bâtons intermédiaires ni couronne orange.

## 3. L'atelier de l'horloger (`src/game/WatchMechanism.ts` — Version V55)
- **Récompense finale débloquée après le Niveau 8 :**
  - Mouvement squelette plein cadre dans un Canvas carré `500×500` avec barillet contenu à l'intérieur des graduations (`< 114 px`).
  - **Ressort à `0 %` par défaut à l'ouverture** accompagné de la consigne : *« Tourne la molette pour remonter la montre et voir le mécanisme ! »*.
  - **Molette compacte à droite (`x = 138`) à débrayage automatique** et détente continue en `20 s`.
  - **Chaîne cinématique à 5 contacts verrouillés en vitesse réelle (`1000 ms`)**.
  - **3 boutons de zoom sur une seule ligne (`⚙️ Ressort`, `🟠 Heures`, `🔵 Minutes`)** avec affichage cumulatif en opacité maximale (`100 %`).

## 4. Didacticiel Animé Autonome (`src/game/TutorialOverlay.ts` — Version V55)
- **Démo interactive au lancement de chaque niveau (et bouton 💡 dans la barre supérieure) :**
  - Niveau 2 : rotation fluide continue sur 24h sans arrêt intermédiaire (*C'est la nuit*, *Le jour se lève*, *Repas de midi*, *Le goûter*, *Repas du soir*, *Minuit : on change de jour*) et pause de `3 secondes` à minuit.
  - Modale « Qui joue ? » au design coloré, affichage complet du prénom sans icône superflue et apparition des boutons d'édition au clic long (`500 ms`).
