# Versionnage du projet

Le projet utilise Semantic Versioning :

```text
MAJOR.MINOR.PATCH
```

Exemple :

```text
0.3.2
```

## Règles

### PATCH

Incrémenter le troisième nombre :

```text
0.2.0 -> 0.2.1
```

Pour :

- correction d'un parser FDJ ;
- correction de date ;
- correction d'un calcul statistique ;
- amélioration des tests ;
- correction de documentation ;
- correction d'un workflow sans nouvelle fonctionnalité.

### MINOR

Incrémenter le deuxième nombre :

```text
0.2.1 -> 0.3.0
```

Pour :

- nouveau module d'analyse ;
- nouvel export de données ;
- nouvelle statistique ;
- nouvelle commande CLI ;
- nouvelle automatisation.

### MAJOR

Incrémenter le premier nombre :

```text
1.4.2 -> 2.0.0
```

Pour :

- rupture du schéma canonique ;
- changement incompatible de format d'export ;
- changement incompatible d'une API publique.

## Roadmap

```text
v0.1.0  Initialisation du dépôt
v0.2.0  Pipeline historique FDJ complet
v0.3.0  Moteur d'analyse statistique approfondie
v0.4.0  Rapports et visualisations
v0.5.0  API / moteur de requêtes
v0.6.0  Dashboard web
v1.0.0  Schéma et pipeline publics stabilisés
```

## Processus de release

1. Le pipeline doit passer :

```bash
npm run pipeline
```

