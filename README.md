# ✨ React Slime Simulation ✨

[![NPM Version](https://img.shields.io/npm/v/react-slime-simulation?style=flat-square)](https://www.npmjs.com/package/react-slime-simulation)
[![License](https://img.shields.io/github/license/LightInn/react-slime-simulation?style=flat-square)](https://github.com/LightInn/react-slime-simulation/blob/main/LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-View%20Repo-blue?style=flat-square&logo=github)](https://github.com/LightInn/react-slime-simulation)
Un composant React hautement personnalisable pour simuler le comportement fascinant des organismes unicellulaires (comme le *Physarum polycephalum* ou "slime mold") directement dans votre navigateur à l'aide de Canvas. Créez des visualisations organiques et interactives !

---

**➡️ Insérez votre superbe GIF de démo ici ! ⬅️**

*(Remplacez le commentaire ci-dessous par votre balise d'image une fois que vous avez le GIF)*

---

## 🚀 Fonctionnalités Clés

* **Simulation sur Canvas :** Rendu performant utilisant `requestAnimationFrame`.
* **Hautement Configurable :** Ajustez des dizaines de paramètres pour influencer le comportement et l'apparence.
* **Forme de Départ Personnalisée :** Utilisez votre propre SVG pour définir la zone initiale des agents.
* **Comportement Aléatoire par Défaut :** Obtenez des simulations uniques à chaque fois, sans effort.
* **Interaction au Pinceau :** Influencez la simulation en temps réel avec la souris.
* **Intégration Facile :** Composant React simple à ajouter à vos projets.
* **Léger :** Pas de dépendances externes lourdes (React est une `peerDependency`).

## 📦 Installation

```bash
npm install react-slime-simulation
# ou
yarn add react-slime-simulation
```

## 💻 Utilisation de Base

Importez le composant et ajoutez-le à votre application. Par défaut, il utilisera des paramètres aléatoires et le SVG intégré.

```jsx
import React from 'react';
import SlimeSimulation from 'react-slime-simulation';
import './App.css'; // Assurez-vous que le conteneur peut prendre de l'espace

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SlimeSimulation />
    </div>
  );
}

export default App;
```

## ⚙️ API & Props

Le comportement de la simulation peut être finement ajusté via les props.

| Prop                | Type    | Défaut                           | Description                                                                                                                               |
| :------------------ | :------ | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `useRandomDefaults` | boolean | `true`                           | Si `true`, ignore les autres props de paramètres et génère des valeurs aléatoires à chaque montage (comportement par défaut de l'original). Si `false`, utilise les valeurs des props fournies. |
| `svgShape`          | string  | SVG intégré (voir code source) | Une chaîne contenant le markup SVG complet (<svg>...</svg>) pour définir la zone de départ. Si invalide, les agents apparaissent aléatoirement. |
| `initialAgents`     | number  | Aléatoire (`600`-`1100`)        | Nombre d'agents dans la simulation. Impacte fortement les performances.                                                                   |
| `sensorOffset`      | number  | Aléatoire (`5`-`29`)            | Distance à laquelle les agents "sentent" les traces devant eux.                                                                             |
| `agentSpeed`        | number  | Aléatoire (`0.8`-`1.9`)         | Vitesse de déplacement des agents par frame.                                                                                             |
| `trailStrength`     | number  | Aléatoire (`0.5`-`2.9`)         | Quantité de "trace" laissée par un agent à chaque pas.                                                                                   |
| `evaporationRate`   | number  | Aléatoire (`0.005`-`0.044`)     | Vitesse à laquelle les traces s'évaporent à chaque frame.                                                                                |
| `edgeAvoidance`     | number  | Aléatoire (`0.0`-`0.9`)         | Force avec laquelle les agents essaient d'éviter les bords de la zone de simulation.                                                        |
| `escapeThreshold`   | number  | Aléatoire (`0.5`-`1.0`)         | Seuil de densité de trace qui déclenche le comportement d'"évasion" d'un agent.                                                              |
| `baseHue`           | number  | Aléatoire (`0`-`359`)           | Teinte HSL de base pour la couleur des traces.                                                                                            |
| `hueRange`          | number  | Aléatoire (`30`-`89`)           | Plage de variation de la teinte autour de `baseHue`, basée sur l'intensité de la trace.                                                    |
| `lightnessRange`    | number  | Aléatoire (`20`-`49`)           | Plage de variation de la luminosité (L dans HSL) autour de 50%, basée sur l'intensité de la trace.                                         |
| `brushSize`         | number  | `4`                              | Rayon (en pixels de simulation) de la zone d'influence de la souris.                                                                       |
| `brushStrength`     | number  | `1.5`                            | Intensité avec laquelle la souris dépose des traces.                                                                                      |
| `pixelScale`        | number  | `6`                              | Facteur d'échelle. La simulation tourne à `windowWidth / pixelScale` pixels de large. Diminuer augmente la résolution mais réduit les performances. |
| `edgeThreshold`     | number  | `3`                              | Distance (en pixels de simulation) aux bords déclenchant la logique `edgeAvoidance`.                                                         |
| `reshuffleCount`    | number  | `10`                             | Nombre de fois où les agents sont repositionnés initialement pour l'effet visuel de "mélange".                                             |
| `startDelay`        | number  | `500`                            | Délai en millisecondes avant le démarrage de la boucle d'animation principale après l'initialisation.                                         |

**Note Importante sur `useRandomDefaults`:** Lorsque `useRandomDefaults` est `true` (par défaut), les valeurs que vous passez pour `initialAgents`, `sensorOffset`, `agentSpeed`, etc., seront **ignorées**. Mettez `useRandomDefaults` à `false` pour utiliser vos propres valeurs personnalisées.

## 🎨 Personnalisation Avancée

### Utiliser des Paramètres Spécifiques

```jsx
import SlimeSimulation from 'react-slime-simulation';

function MyCustomSimulation() {
  const settings = {
    useRandomDefaults: false, // Très important !
    initialAgents: 450,
    agentSpeed: 1.1,
    evaporationRate: 0.025,
    pixelScale: 7,
    baseHue: 180, // Cyan
    hueRange: 15,
    trailStrength: 1.8,
  };

  return <SlimeSimulation {...settings} />;
}
```

### Utiliser un SVG Personnalisé

Définissez votre forme SVG comme une chaîne de caractères. Assurez-vous que le SVG a un `fill` (remplissage) pour que la rasterisation fonctionne.

```jsx
import SlimeSimulation from 'react-slime-simulation';

function MySVGShapeSimulation() {
  const customSvg = `
    <svg viewBox="0 0 100 100" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
      <circle cx="50" cy="50" r="45" fill="#555" />
    </svg>
  `;

  // Vous pouvez combiner SVG personnalisé et paramètres spécifiques
  const settings = {
    useRandomDefaults: false,
    initialAgents: 600,
    svgShape: customSvg,
    baseHue: 300, // Magenta
  };

  return <SlimeSimulation {...settings} />;
  // Ou juste le SVG avec les paramètres aléatoires par défaut :
  // return <SlimeSimulation svgShape={customSvg} />;
}
```

## 🙌 Contribuer

Les contributions sont les bienvenues ! Si vous avez des idées d'amélioration, des corrections de bugs ou de nouvelles fonctionnalités :

1.  Forkez le dépôt : [https://github.com/LightInn/react-slime-simulation.git](https://github.com/LightInn/react-slime-simulation.git)
2.  Créez votre branche de fonctionnalité (`git checkout -b feature/ma-super-feature`)
3.  Commitez vos changements (`git commit -am 'Ajout de ma super feature'`)
4.  Poussez vers la branche (`git push origin feature/ma-super-feature`)
5.  Ouvrez une Pull Request !

N'hésitez pas à ouvrir une [Issue](https://github.com/LightInn/react-slime-simulation/issues) pour discuter des changements majeurs au préalable.

## 📜 Licence

Ce projet est distribué sous la licence MIT. Voir le fichier [LICENSE](https://github.com/LightInn/react-slime-simulation/blob/main/LICENSE) pour plus de détails.
