# Changelog

Toutes les évolutions importantes du projet LOTO sont documentées ici.

Le projet suit [Semantic Versioning](https://semver.org/) :

- `MAJOR` : rupture de compatibilité du schéma ou de l'API ;
- `MINOR` : nouvelle fonctionnalité rétrocompatible ;
- `PATCH` : correction de bug, parser, validation ou documentation.

## [Unreleased]

### Corrigé après audit

- unicité historique fondée sur la date et l’identifiant, supprimant 942 faux doublons ;
- validation avant publication de tous les exports, rapports et statistiques, avec restauration après interruption ;
- détection des suppressions par rapport à la base précédente et des grandes lacunes temporelles ;
- rejet des valeurs numériques mal formées, conservation de la notation scientifique FDJ ;
- migration du champ JSON `payoutEur` vers `payout` dans la devise source (adaptation requise des consommateurs) ;
- tests d’intégration sur les cinq archives locales et tests de publication ;
- vérification TypeScript des tests et validation du jeu de données en CI ;
- mise à jour de `csv-parse` vers 7.0.2 pour corriger GHSA-8cw4-87c7-c6xx.

### Prévu pour 0.3.0

- moteur d'analyse statistique approfondie ;
- fréquences glissantes ;
- retards actuels et historiques ;
- paires et triplets ;
- répétitions entre tirages ;
- pair/impair, bas/haut, dizaines ;
- sommes, amplitudes et écarts ;
- tests statistiques ;
- simulations Monte-Carlo ;
- score d'intérêt statistique descriptif.

## [0.2.1] - 2026-09-09

### Sécurité / intégrité

- remplacement de `adm-zip` par une extraction ZIP bornée ;
- contrôle de provenance, Content-Type, signature ZIP et SHA-256 ;
- téléchargement atomique des archives ;
- déduplication stricte avec erreur sur conflit ;
- validation canonique renforcée ;
- tests de hardening ;
- CI avec `npm ci` et `npm audit`.

## [0.2.0] - 2026-09-08

### Ajouté

- import des cinq archives officielles FDJ ;
- historique complet de mai 1976 au 7 septembre 2026 ;
- normalisation de 7 663 tirages ;
- séparation ancien LOTO / LOTO moderne ;
- validation des tirages et plages de numéros ;
- export JSON et CSV ;
- statistiques descriptives de base ;
- tests unitaires du parseur ;
- workflow GitHub Actions de mise à jour.

### Données

- 4 858 tirages historiques ;
- 2 805 tirages modernes ;
- 0 erreur de validation ;
- 0 warning.
