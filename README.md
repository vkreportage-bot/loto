# LOTO Data

Historique, normalisation et analyse des tirages du LOTO français.

## Objectif

Ce dépôt centralise :

- les données historiques brutes ;
- les données normalisées ;
- les scripts d'import et de mise à jour ;
- les contrôles de cohérence ;
- les statistiques ;
- l'automatisation des mises à jour après les tirages FDJ.

## Périodes de jeu

Les données sont conservées séparément selon les règles du LOTO :

- **1976 → 2008** : ancien format, 6 numéros + complémentaire ;
- **depuis octobre 2008** : format moderne, 5 numéros + numéro Chance.

## Structure

```text
loto-data/
├── data/
│   ├── raw/
│   └── processed/
├── scripts/
├── src/
└── .github/workflows/
```

## Installation

```bash
npm install
```

## Scripts

```bash
npm run import
npm run normalize
npm run validate
npm run update
```

## Données

Le fichier normalisé principal sera généré dans :

```text
data/processed/loto-master.csv
```

## Automatisation

Le workflow GitHub Actions pourra être exécuté automatiquement après les jours de tirage et manuellement depuis GitHub.
