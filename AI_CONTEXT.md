# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique (7 niveaux + Atelier de l'Horloger) avec gestion multi-profils (fratrie) et ambiance céleste dynamique Jour ☀️ / Nuit 🌙.
- **Verrouillage ergonomique :** Interface 100 % fixe (`100dvh`, `overflow: hidden`, `overscroll-behavior: none`), sans défilement ni rafraîchissement accidentel au glissement vertical.

## 2. Progression Pédagogique (7 Niveaux) & Architecture Visuelle
- **Séparation concentrique sur le cadran (`src/game/Clock.ts` & `src/game/Hands.ts`) :**
  - **Piste extérieure bleue :** Graduations `0..59` et repères des minutes (`00, 05..55`) aux niveaux 2 à 5, alignés avec la pointe de la grande aiguille bleue sans masquer les chiffres des heures.
  - **Cercle des heures (`1` à `12`) :** Affiché aux niveaux 1 à 6. Au Niveau 7 (*L'Horloge des Grands*), seuls les repères cardinaux `12, 3, 6, 9` sont chiffrés, complétés par 8 index bâtons horlogers.
  - **Couronne intérieure 24h (`13` à `23` et `00`) :** Affichée **uniquement au Niveau 5** (*Les 24 Heures*). Dès le Niveau 6 (*À la Minute près*), l'enfant calcule l'heure de l'après-midi/soir mentalement (`+12`) grâce à la pilule de période (`☀️ Matin`, `🌤️ Après-midi`, `🌆 Soir`, `🌙 Nuit`) placée au-dessus de la question.
- **Générateur de QCM (`src/game/QuestionManager.ts`) :**
  - Aux niveaux 2 à 7, les 3 choix combinent systématiquement la bonne réponse, 1 leurre sur l'heure (même minute) et 1 leurre sur la minute (même heure), avec élimination visuelle des choix déjà tentés (`.choice-tried`).

## 3. L'Atelier de l'Horloger (`src/game/WatchMechanism.ts` — Version V40)
- **Récompense finale débloquée après le Niveau 7 :**
  - Mouvement squelette plein cadre dans un Canvas carré `500×500` (ratio 1:1 sans déformation) avec début de bracelet en haut et en bas.
  - **Molette compacte à droite (`x = 138`) à débrayage automatique :** S'embraye contre le barillet lors du remontage au toucher, s'arrête en bout de course à `100 %`, et s'abaisse automatiquement au relâcher pour laisser le barillet se dérouler sans faire tourner la vis en sens inverse.
  - **Détente rapide et continue du ressort (`20 s`) :** Le ressort se détend en 20 secondes (`5 % / s`) sans aucun saut angulaire entre la fin du remontage et la reprise de la marche.
  - **Chaîne cinématique à 5 contacts verrouillés en vitesse réelle (`1000 ms`) :** Synchronisation mathématique sans glissement des dents du barillet jusqu'à la trotteuse des secondes, avec maintien du son `Tic-Tac` chaque seconde.
  - **4 boutons de zoom manuels (`⚙️ Ressort / Molette`, `🟠 Heures`, `🔵 Minutes`, `🔴 Secondes`) :** Isolent visuellement l'organe étudié en passant le reste du mouvement en gris transparent (`grayscale(100%)`, `globalAlpha = 0.20`).
