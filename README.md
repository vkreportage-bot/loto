# LOTO Data France

Base historique reproductible des tirages du **LOTO français**, construite à partir des archives publiques de la FDJ.

> Ce projet fait de l'analyse descriptive de tirages passés. Un tirage de loterie reste aléatoire et indépendant : les fréquences, retards et combinaisons historiques ne permettent pas de prédire un prochain résultat.

## Source officielle

FDJ — historique LOTO :

https://www.fdj.fr/jeux-de-tirage/loto/historique

La FDJ met à disposition cinq archives ZIP couvrant l'historique depuis **mai 1976**. Les fichiers contiennent notamment les numéros tirés, les numéros Chance ou complémentaires, les gagnants par rang et divers champs de gains.

## Règles conservées séparément

Le projet ne mélange pas artificiellement les deux principaux régimes :

- **ancien LOTO** : 6 numéros (1–49) + boule complémentaire ;
- **LOTO moderne** : 5 numéros (1–49) + numéro Chance (1–10).

Les fichiers FDJ ont également connu plusieurs variantes de schéma (Joker/Joker+, second tirage, codes gagnants). Le normaliseur détecte les colonnes disponibles et conserve les éléments utiles dans un modèle canonique.

## Installation

```bash
npm install
```

## Import initial complet

```bash
npm run pipeline
```

Cette commande :

1. télécharge les cinq archives officielles FDJ ;
2. extrait et lit les CSV ;
3. normalise toutes les périodes ;
4. supprime les doublons de jonction entre archives ;
5. valide les plages et la cohérence des tirages ;
6. génère les statistiques descriptives.

## Mise à jour après un nouveau tirage

```bash
npm run update
```

La mise à jour ne retélécharge que l'archive courante (novembre 2019 → aujourd'hui), puis régénère et valide la base complète.

## Fichiers générés

```text
data/
├── raw/
│   ├── archives/
│   │   ├── 1976-05-to-2008-10.zip
│   │   ├── 2008-10-to-2017-03.zip
│   │   ├── 2017-03-to-2019-02.zip
│   │   ├── 2019-02-to-2019-11.zip
│   │   └── 2019-present.zip
│   └── archive-manifest.json
└── processed/
    ├── loto-master.json
    ├── loto-master.csv
    ├── loto-historic.csv
    ├── loto-modern.csv
    ├── normalization-report.json
    ├── validation-report.json
    └── stats-summary.json
```

## Modèle canonique

Chaque tirage contient notamment :

- identifiant et numéro de tirage ;
- date et jour ;
- règles applicables ;
- numéros principaux dans l'ordre FDJ + version triée ;
- complémentaire ou Chance ;
- éventuel second tirage ;
- gagnants/gains par rang lorsqu'ils existent ;
- codes gagnants lorsqu'ils existent ;
- archive et fichier CSV d'origine.

## Commandes

```bash
npm run import      # télécharger toutes les archives
npm run normalize   # reconstruire la base canonique
npm run validate    # contrôler la cohérence
npm run stats       # régénérer les statistiques
npm run update      # actualiser le dernier bloc puis tout régénérer
npm run test        # tests unitaires du parseur
npm run check       # TypeScript + tests
```

## GitHub Actions

`.github/workflows/update-loto.yml` lance une mise à jour après les jours de tirage LOTO (lundi, mercredi, samedi), puis commit automatiquement les données modifiées si la validation et les tests passent.
