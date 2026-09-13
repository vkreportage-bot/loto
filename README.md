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
6. prépare les statistiques et les rapports, puis publie tous les fichiers traités ensemble.

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


## Sécurité et intégrité

Depuis la v0.2.1, le pipeline :

- vérifie la provenance HTTPS FDJ des archives ;
- contrôle la signature et les limites structurelles des ZIP ;
- refuse les chemins ZIP dangereux et les archives anormalement volumineuses ;
- calcule un SHA-256 pour chaque archive ;
- remplace les fichiers locaux de façon atomique après validation ;
- compare strictement les doublons de frontière entre archives ;
- échoue si deux sources donnent des valeurs différentes pour le même tirage ;
- exécute des validations canoniques renforcées.

`loto-master.json` est le format canonique complet. Les exports CSV sont des vues analytiques simplifiées.


## Corrections d’intégrité après audit

La clé d’un tirage est `(date, drawId)` : certains numéros historiques sont réutilisés à des dates différentes.

**Migration du JSON :** `prizeTiers[].payoutEur` devient `prizeTiers[].payout`, également dans `secondDraw`. Le montant reste dans la devise source indiquée par `currency` (`frf` ou `eur`) ; aucune conversion monétaire n’est effectuée. Les consommateurs du JSON doivent adapter le nom du champ. `npm run normalize` reconstruit ce schéma depuis les archives.

Les conversions numériques refusent les valeurs partiellement lisibles. Les montants français avec espaces, virgule décimale ou notation scientifique restent acceptés.

La normalisation refuse de supprimer une clé présente dans la base précédente, y compris le dernier tirage. Sans base précédente, elle détecte les grandes lacunes entre tirages (plus de 31 jours pour l’historique, 7 jours pour le régime moderne). Ces seuils conservateurs ne garantissent pas l’exhaustivité du calendrier source. Une archive ancienne qui comporte déjà une petite lacune nécessite une vérification FDJ distincte.

`npm run normalize` prépare les sept fichiers dans `data/processed.next`, valide les tirages et calcule les statistiques avant publication. L’ancienne génération est conservée dans `data/processed.previous` pendant le remplacement du répertoire. Une erreur de préparation conserve la base publiée ; après une interruption entre les renommages, le prochain lancement restaure la génération précédente. Un verrou empêche deux normalisations simultanées. Il peut exister un bref intervalle où le répertoire est absent entre les renommages ; ce mécanisme ne constitue pas une transaction durable contre une panne matérielle. Les archives brutes sont importées séparément.

`npm run check` couvre TypeScript, les tests unitaires, les archives locales et la publication dans des répertoires temporaires. Aucun accès FDJ n’est nécessaire pour ces tests. La fraîcheur des archives locales reste un avertissement ; une mise à jour réseau s’effectue avec `npm run update`.
