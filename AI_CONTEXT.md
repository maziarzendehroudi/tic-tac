# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (8 niveaux à 6 étoiles + Mode Quizz aléatoire + L'atelier de l'horloger) avec gestion multi-profils (fratrie) et ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Verrouillage ergonomique :** Interface 100 % fixe (`100dvh`, `overflow: hidden`, `overscroll-behavior: none`), hauteur stabilisée de la zone de messages et de contrôles pour éviter tout déplacement vertical du cadran.

## 2. Progression Pédagogique (8 Niveaux — 48 Étoiles : 6 par niveau) & Architecture Visuelle
1. **Niveau 1 — Les 12 heures :** Petite aiguille orange seule sur le cercle `1..12` (format `3 h`, singulier respecté sur `1 heure`).
2. **Niveau 2 — Les 24 heures :** Petite aiguille orange seule + couronne intérieure orange `13..00` + pilule de période Jour/Nuit en haut (format `15 h`).
3. **Niveau 3 — Les minutes :** Grande aiguille bleue seule + piste extérieure bleue de 5 en 5 (`00, 05..55`, chiffres des heures estompés, format `25 min`).
4. **Niveau 4 — Les demi-heures :** Réunion des 2 aiguilles sur `:00` et `:30` + ligne médiane en pointillés.
5. **Niveau 5 — Les quarts d'heure :** Les 2 aiguilles sur `:15`, `:30`, `:45` + repères en croix (`0 = heure pile`, `15 = un quart d'heure`, `30 = demie heure`, `45 = trois quarts d'heure`).
6. **Niveau 6 — À la minute près :** Les 2 aiguilles sur les 60 graduations (`00..59`) avec repères bleus `00..55`.
7. **Niveau 7 — Le défi jour & nuit :** Toutes les minutes + cycle 24h avec la couronne intérieure orange `13..00`, les repères bleus `00..55` et la pilule de période.
8. **Niveau 8 — L'horloge des grands :** Seuls les repères cardinaux `12, 3, 6, 9` sont chiffrés sans bâtons intermédiaires ni couronne orange.
- **Validation Étape 2 :** Le bouton `✓ Vérifier` disparaît dès qu'on appuie dessus (reste masqué pendant la confirmation d'une bonne réponse, et réapparaît dès que l'enfant déplace une aiguille après une erreur).
- **Barème des 6 étoiles par niveau :** `6` étoiles pour 0 erreur, puis `-1` étoile par erreur (minimum `1` étoile garantie), affichées sur les pilules d'accueil, l'écran de célébration et le total joueur (`/ 48`).

## 3. Mode Quizz — Tous Niveaux Mélangés & Points (Version V64)
- **Accès libre dès l'accueil :** Bouton dédié `🎲 Mode Quizz · Tous niveaux` ouvert en permanence.
- **Séries aléatoires de 10 questions :** Mélange les 8 niveaux (sans répétition consécutive du même niveau) et alterne aléatoirement Lecture (QCM) et Manipulation des aiguilles, sans didacticiel intermédiaire.
- **Système de points par profil :** `+10 pts` au 1er essai, `+5 pts` au 2e essai, `+2 pts` avec aide (score sur `100 pts` par Quizz), sauvegardés au fil de l'eau dans le profil actif (`quizPoints`, `quizBestScore`).

## 4. L'atelier de l'horloger (`src/game/WatchMechanism.ts` — Version V55)
- **Récompense finale débloquée après le Niveau 8 :**
  - Mouvement squelette plein cadre dans un Canvas carré `500×500` avec barillet contenu à l'intérieur des graduations (`< 114 px`).
  - **Ressort à `0 %` par défaut à l'ouverture** accompagné de la consigne : *« Tourne la molette pour remonter la montre et voir le mécanisme ! »*.
  - **Molette compacte à droite (`x = 138`) à débrayage automatique** et détente continue en `20 s`.
  - **Chaîne cinématique à 5 contacts verrouillés en vitesse réelle (`1000 ms`)**.
  - **3 boutons de zoom sur une seule ligne (`⚙️ Ressort`, `🟠 Heures`, `🔵 Minutes`)** avec affichage cumulatif en opacité maximale (`100 %`).
