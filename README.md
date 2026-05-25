# Zyvora Suite

Application React/Vite de gestion interne.

## Connexions de test
- Admin : info@actilampe.ch / 1234
- Employé : mendes.hugo@actilampe.ch / 1234

Au premier login, un changement de mot de passe est demandé.

## Installation
1. Installer Node.js
2. Ouvrir le dossier dans un terminal
3. Lancer : `npm install`
4. Lancer : `npm run dev`
5. Ouvrir le lien affiché, souvent http://localhost:5173

## Ce qui est inclus
- Saisie des heures par chantier/projet
- Rapports semaine/mois/année avec export CSV
- Validation admin des heures
- Vacances / congés
- Calendrier des absences
- Notes de frais
- Photos des tickets / quittances
- Suivi kilomètres
- Heures supplémentaires
- Jours fériés automatiques Suisse 2026
- Fiches de salaire PDF téléchargeables par employé
- Ajout / désactivation d'employés côté admin
- Employé arrive directement sur “Heures de la semaine”
- Dashboard uniquement côté admin

## Important
Les données sont stockées dans le navigateur avec localStorage. Pour une vraie utilisation en entreprise avec plusieurs employés sur plusieurs téléphones/PC, il faudra connecter une vraie base de données et un vrai serveur d'authentification.
