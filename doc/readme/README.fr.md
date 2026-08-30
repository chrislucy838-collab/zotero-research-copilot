<p align="center"><img src="../../addon/content/icons/icon-96.png" alt="Logo Zotero Research Copilot" width="88" /></p>
<h1 align="center">Zotero Research Copilot</h1>
<p align="center">Un espace de travail de recherche IA pour lire, discuter, rechercher et organiser des articles dans Zotero.</p>
<p align="center"><a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a></p>
<p align="center"><a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>Télécharger le dernier XPI</strong></a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a></p>

> **Version prise en charge :** Zotero 10.x.

## Fonctionnalités

- Discussion de recherche dans le panneau d'un élément de bibliothèque Zotero, le lecteur PDF et le lecteur EPUB.
- Contexte basé sur l'article courant, le texte sélectionné, d'autres articles, des images et des fichiers importés.
- Ajout de plusieurs articles avec `@` ou depuis une collection Zotero.
- Modification, nouvelle tentative, branche, épinglage, suppression, export et sauvegarde des conversations comme notes Zotero.
- Recherche de contexte borné tenant compte de la structure des documents PDF/EPUB.
- Onglet **Discover** pour rechercher OpenAlex, Semantic Scholar et Crossref, dédupliquer les résultats et importer les références après vérification.
- Collage, glisser-déposer, téléversement de fichiers et capture d'une zone du lecteur pour discuter de figures, tableaux ou formules.
- Traduction du texte sélectionné dans les lecteurs PDF/EPUB avec modèle, langues et actions configurables.
- Connexion à des modèles hébergés, locaux ou auto-hébergés via une API compatible OpenAI.
- Historique et mémoire conservés dans les données locales de Zotero, avec rendu Markdown, tableaux, images et LaTeX.

## Connexion à un modèle

Ouvrez **Tools → Add-ons → Zotero Research Copilot → Settings**. En mode API, renseignez API Base URL et Model ; API Key et Custom Headers sont facultatifs selon le service.

Exemples : `https://api.openai.com/v1` et `http://127.0.0.1:11434/v1`. Le service doit généralement fournir les formes d'API `/models` et `/chat/completions`.

## Installation

1. Téléchargez `Zotero-Research-Copilot-<version>.xpi` depuis [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases).
2. Dans Zotero, ouvrez **Tools → Add-ons → gear → Install Add-on From File…**.
3. Sélectionnez le XPI et redémarrez Zotero si nécessaire.
4. Configurez l'API dans les Settings de Zotero Research Copilot.

La version prise en charge est Zotero **10.0–10.x**. Un nouveau XPI peut être installé par-dessus l'ancien.

## Confidentialité et licence

Les requêtes sont envoyées directement de Zotero à l'endpoint configuré. Le plugin n'ajoute ni télémétrie ni proxy propriétaire. Les clés et en-têtes personnalisés sont configurés localement. Les données envoyées à un modèle tiers suivent la politique de ce service.

Le projet est distribué sous la licence [AGPL-3.0-or-later](../../LICENSE).
