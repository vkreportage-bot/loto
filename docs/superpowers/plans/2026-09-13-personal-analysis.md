# Outil personnel d’analyse LOTO

Objectif : une application locale en français, utilisable au clavier et sur mobile, qui explore les données FDJ validées sans mélanger les régimes.

Architecture : frontend TypeScript natif et CSS, compilé avec le TypeScript déjà installé ; serveur Node local limité aux assets de l’application et au jeu de données validé. Export statique autonome dans dist/app. Aucun compte ni service externe. Préférences de filtres stockées localement.

- [x] Calculs purs dans frontend/analytics.ts : filtrage du régime et du second tirage avant fenêtre temporelle, 49 fréquences y compris zéros, retards censurés, écarts à la probabilité théorique, paires, sommes, parité, historique. Tests sur jeux artificiels aux résultats connus dans tests/frontend.test.ts.
- [x] Livraison : frontend/model.ts, src/frontend-data.ts, scripts/frontend-build.ts et scripts/frontend-dev.ts. Données compactes construites à partir du JSON canonique et validées ; routes fixes, écoute sur 127.0.0.1, erreurs HTTP explicites. Commandes npm run dev et npm run build:frontend.
- [x] Interface : navigation Vue d’ensemble / Numéros / Paires / Historique ; filtres communs régime, tirage, période et dates ; graphiques interactifs, sélection d’un numéro, tableau détaillé, recherche AND de numéros, pagination et export CSV. États chargement, erreur, zéro résultat et préférences invalides.
- [x] Présentation : fond ivoire, encre bleu nuit, accent corail, sidebar compacte, typographie nette, boules de tirage, densité adaptée à l’analyse. Mise en page responsive et focus visibles.
- [x] Vérifier : npm run check, npm run build:frontend, tests HTTP du serveur et exploration réelle du navigateur des filtres, vues, export, stockage local et viewport mobile. Documenter commandes et limites statistiques dans README.md.

Les fréquences décrivent des tirages passés. Les écarts au taux théorique et les retards ne constituent ni une prédiction ni une probabilité accrue au prochain tirage. Un numéro absent de la fenêtre affiche un retard borné inférieur (≥ taille de fenêtre), jamais zéro. L’historique n’est filtré par les numéros saisis que dans la vue Historique ; les agrégats gardent leur échantillon commun.
