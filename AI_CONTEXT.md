# AI_CONTEXT.md — Projet TIC-TAC (Mestis)
> **CONFIDENTIEL — Soumis au secret des affaires. Ne pas reproduire ou diffuser sans autorisation.**

## 1. Identité & Objectif du Projet
- **Nom du projet :** Tic-Tac
- **Éditeur :** SASU Mestis — *Numérique en action*
- **Nature :** Application web ludo-éducative (PWA) pour enfants dédiée à l'apprentissage progressif de la lecture de l'heure analogique et à la découverte du mécanisme d'une montre.
- **Dépôt GitHub :** `maziarzendehroudi/tic-tac`

## 2. Architecture Pédagogique & Technique
- **Stack :** TypeScript 6.0 strict (`tsc --noEmit`), Vite 8.2, Vitest, HTML5 Canvas 2D, Web Audio API natif.
- **Progression Pédagogique en 6 Niveaux (1 Niveau = 1 Savoir-faire + 1 Pièce Mécanique) :**
  1. **Niveau 1 (Heures pleines) ➔ `1. La Molette` :** Cadran `1..12` épuré.
  2. **Niveau 2 (Demi-heures) ➔ `2. Le Ressort` :** Repères bleus `:00` / `:30` et ligne médiane.
  3. **Niveau 3 (Quarts d'heure) ➔ `3. Aiguille des Heures` :** Repères bleus `:00, :15, :30, :45` et croix des quarts.
  4. **Niveau 4 (Précision 5 minutes) ➔ `4. Relais & Aiguille des Minutes` :** Couronne extérieure bleue de la table de 5 (`00, 05..55`) + 60 graduations.
  5. **Niveau 5 (Les 24 heures) ➔ `5. Relais & Aiguille des Secondes` :** Couronne extérieure orange `13..00` + badge Moment de la journée (`☀️ Matin`, `🌤️ Après-midi`, `🌆 Soir`, `🌙 Nuit`).
  6. **Niveau 6 (Maître Horloger - Minute près) ➔ `6. Le Balancier Tic-Tac` :** Cadran cardinal (`12, 3, 6, 9`) + 60 graduations de minutes + réglage fin `➖ / ➕`.
