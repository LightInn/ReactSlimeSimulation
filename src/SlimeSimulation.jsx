import React, { useRef, useEffect, useState, useCallback } from "react";

// --- SVG par défaut (extrait du fichier HTML original) ---
const DEFAULT_SVG_SHAPE = `
  <svg id="spawnShape" width="200" height="200" viewBox="0 0 200 200">
      <!-- Remplacez ceci par votre SVG -->
      <path d="M100,20 L180,180 L20,180 Z" fill="white"/>
  </svg>
`;

// --- Génération des paramètres aléatoires par défaut ---
const generateRandomSettings = () => ({
  initialAgents: Math.floor(Math.random() * 501) + 600, // [600, 1100]
  sensorOffset: Math.floor(Math.random() * 25) + 5, // [5, 29]
  edgeAvoidance: parseFloat(Math.random().toFixed(1)), // [0.0, 0.9]
  agentSpeed: parseFloat((Math.random() * 1.2 + 0.75).toFixed(1)), // [0.8, 1.9]
  trailStrength: parseFloat((Math.random() * 2.5 + 0.5).toFixed(1)), // [0.5, 2.9]
  evaporationRate: parseFloat((Math.random() * 0.04 + 0.005).toFixed(3)), // [0.005, 0.044]
  baseHue: Math.floor(Math.random() * 360), // [0, 359]
  hueRange: Math.floor(Math.random() * 60) + 30, // [30, 89]
  lightnessRange: Math.floor(Math.random() * 30) + 20, // [20, 49]
  escapeThreshold: 0.5 + Math.random() * 0.5, // [0.5, 1.0]
  // Paramètres non-aléatoires mais configurables
  brushSize: 4,
  brushStrength: 1.5,
  pixelScale: 6,
  edgeThreshold: 3,
  reshuffleCount: 10, // Comme dans l'original reshufleInit(10)
  startDelay: 500, // Délai avant démarrage animation
});

// --- Fonctions utilitaires (adaptées pour React / Refs) ---
// La fonction extractPathsFromSVG n'est plus nécessaire et est supprimée.

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function scaleToRange01(value) {
  return value / 4294967295;
}

function hash(position) {
  let x = position.x * 1234.5678;
  let y = position.y * 9012.3456;
  x = x * x * x * 123456 + y;
  y = y * y * y * 654321 + x;
  return (x * y) % 4294967295;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- Classe Agent (Adaptée pour utiliser settingsRef et simulationDimensionsRef) ---
class Agent {
  constructor(settingsRef, simulationDimensionsRef) {
    this.settingsRef = settingsRef;
    this.simulationDimensionsRef = simulationDimensionsRef;
    this.position = { x: 0, y: 0 }; // Sera défini par initAgents
    this.angle = Math.random() * Math.PI * 2;
    const hue = settingsRef.current.baseHue + randomInRange(-20, 20);
    this.color = `hsl(${hue}, 80%, 60%)`;
    this.escapeThreshold = settingsRef.current.escapeThreshold;
    this.isEscaping = false;
    this.escapeTime = 0;
  }

  sense(angleOffset) {
    const sensorAngle = this.angle + angleOffset * (Math.PI / 180);
    const sensorOffset = this.settingsRef.current.sensorOffset;
    const simWidth = this.simulationDimensionsRef.current.width;
    const simHeight = this.simulationDimensionsRef.current.height;

    const sensorDir = { x: Math.cos(sensorAngle), y: Math.sin(sensorAngle) };
    const sensorCenter = {
      x: this.position.x + sensorDir.x * sensorOffset,
      y: this.position.y + sensorDir.y * sensorOffset,
    };

    if (
      sensorCenter.x < 0 ||
      sensorCenter.x >= simWidth ||
      sensorCenter.y < 0 ||
      sensorCenter.y >= simHeight
    ) {
      return { sum: 0, maxDensity: 0 };
    }

    let sum = 0;
    let maxDensity = 0;
    const sensorX = Math.floor(sensorCenter.x);
    const sensorY = Math.floor(sensorCenter.y);
    const trailMap = this.settingsRef.current.trailMap; // Accès via settingsRef

    if (!trailMap) return { sum: 0, maxDensity: 0 }; // Sécurité si trailMap n'est pas prêt

    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      const y = sensorY + offsetY;
      if (y >= 0 && y < simHeight) {
        const rowIndex = y * simWidth;
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const x = sensorX + offsetX;
          if (x >= 0 && x < simWidth) {
            const density = trailMap[rowIndex + x];
            sum += density;
            if (density > maxDensity) {
              maxDensity = density;
            }
          }
        }
      }
    }
    return { sum, maxDensity };
  }

  update() {
    const settings = this.settingsRef.current;
    const simWidth = this.simulationDimensionsRef.current.width;
    const simHeight = this.simulationDimensionsRef.current.height;
    const deltaTime = settings.deltaTime * 60; // Ajustement comme dans l'original
    const speed = settings.agentSpeed;
    const edgeThreshold = settings.edgeThreshold;

    // Check escape condition
    const forwardSense = this.sense(0);
    const shouldEscape = forwardSense.maxDensity > this.escapeThreshold;

    if (shouldEscape && !this.isEscaping) {
      this.isEscaping = true;
      this.escapeTime = 0;
    } else if (!shouldEscape && this.isEscaping && this.escapeTime > 1.0) {
      this.isEscaping = false;
    }

    let newPos;

    if (this.isEscaping) {
      this.escapeTime += deltaTime;
      const leftSense = this.sense(45);
      const rightSense = this.sense(-45);

      if (leftSense.maxDensity > rightSense.maxDensity) {
        this.angle -= 0.2 * deltaTime;
      } else {
        this.angle += 0.2 * deltaTime;
      }

      const escapeSpeed = speed * 1.3;
      const direction = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      newPos = {
        x: this.position.x + direction.x * escapeSpeed,
        y: this.position.y + direction.y * escapeSpeed,
      };
    } else {
      // Normal behavior
      const nearLeftEdge = this.position.x < edgeThreshold;
      const nearRightEdge = this.position.x > simWidth - edgeThreshold;
      const nearTopEdge = this.position.y < edgeThreshold;
      const nearBottomEdge = this.position.y > simHeight - edgeThreshold;

      if (
        (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) &&
        settings.edgeAvoidance > 0
      ) {
        const turnAmount = randomInRange(
          -Math.PI * settings.edgeAvoidance,
          Math.PI * settings.edgeAvoidance,
        );
        if (nearLeftEdge) this.angle = turnAmount;
        else if (nearRightEdge) this.angle = Math.PI + turnAmount;
        else if (nearTopEdge) this.angle = Math.PI / 2 + turnAmount;
        else if (nearBottomEdge) this.angle = -Math.PI / 2 + turnAmount;
      } else {
        const weightForward = this.sense(0).sum;
        const weightLeft = this.sense(45).sum;
        const weightRight = this.sense(-45).sum;
        const random = hash({
          x: this.position.x + performance.now() * 0.001,
          y: this.position.y + performance.now() * 0.001,
        });
        const randomSteerStrength = scaleToRange01(random);

        if (weightForward > weightLeft && weightForward > weightRight) {
          this.angle += (randomSteerStrength - 0.5) * 0.1 * deltaTime;
        } else if (weightForward < weightLeft && weightForward < weightRight) {
          this.angle += (randomSteerStrength - 0.5) * 2 * 0.5 * deltaTime;
        } else if (weightRight > weightLeft) {
          this.angle -= randomSteerStrength * 0.5 * deltaTime;
        } else if (weightLeft > weightRight) {
          this.angle += randomSteerStrength * 0.5 * deltaTime;
        }
      }
      // Move agent
      const direction = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      newPos = {
        x: this.position.x + direction.x * speed,
        y: this.position.y + direction.y * speed,
      };
    }

    // Boundary check (commun aux deux modes)
    if (
      newPos.x < 0 ||
      newPos.x >= simWidth ||
      newPos.y < 0 ||
      newPos.y >= simHeight
    ) {
      if (newPos.x < 0 || newPos.x >= simWidth) {
        this.angle = Math.PI - this.angle + randomInRange(-0.2, 0.2);
      }
      if (newPos.y < 0 || newPos.y >= simHeight) {
        this.angle = -this.angle + randomInRange(-0.2, 0.2);
      }
      newPos.x = Math.max(0, Math.min(simWidth - 0.01, newPos.x));
      newPos.y = Math.max(0, Math.min(simHeight - 0.01, newPos.y));
    }

    this.position = newPos;

    // Leave trail
    const trailX = Math.floor(this.position.x);
    const trailY = Math.floor(this.position.y);
    const trailMap = settings.trailMap; // Accès via settingsRef

    if (
      trailX >= 0 &&
      trailX < simWidth &&
      trailY >= 0 &&
      trailY < simHeight &&
      trailMap
    ) {
      const index = trailY * simWidth + trailX;
      trailMap[index] = Math.min(1.0, trailMap[index] + settings.trailStrength);
    }
  }
}

// --- Composant React SlimeSimulation ---
const SlimeSimulation = (props) => {
  const {
    useRandomDefaults = true,
    svgShape = DEFAULT_SVG_SHAPE,
    ...userProps
  } = props;

  const canvasRef = useRef(null);
  const settingsRef = useRef({}); // Contiendra tous les paramètres fusionnés
  const agentsRef = useRef([]);
  const simulationDimensionsRef = useRef({ width: 0, height: 0 });
  const animationFrameIdRef = useRef(null);
  const mousePositionRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isInitializedRef = useRef(false);
  const resizeTimeoutRef = useRef(null);

  // --- Fonctions de simulation principales (utilisant les Refs) ---

  // Fonction pour rasteriser le SVG fourni en une liste de coordonnées de pixels valides
  const rasterizeSVG = useCallback(async (svgString, width, height) => {
    console.log(
      "Rasterizing SVG string:",
      svgString?.substring(0, 100) + "...",
    ); // Log tronqué

    let originalViewBox = '0 0 200 200'; // Default fallback for viewBox
    let originalContent = '<rect x="0" y="0" width="100%" height="100%" fill="white"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="black">Fallback Shape</text></rect>'; // Default content if SVG is invalid

    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
      const svgRoot = svgDoc.documentElement;

      if (svgDoc.querySelector("parsererror") || !svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
        console.error("Erreur lors du parsing du SVG fourni ou ce n'est pas un SVG valide. Utilisation du contenu par défaut.");
      } else {
        const vb = svgRoot.getAttribute('viewBox');
        if (vb) {
          originalViewBox = vb;
        } else {
          const w = svgRoot.getAttribute('width');
          const h = svgRoot.getAttribute('height');
          if (w && h) {
            originalViewBox = `0 0 ${w} ${h}`;
          } else {
            // If no viewBox and no width/height, use a common default or try to infer
            // For now, relies on the initial '0 0 200 200' or user must provide viewBox
            console.warn("SVG n'a pas de viewBox ou de dimensions width/height explicites. Le rendu pourrait ne pas être comme attendu si le contenu n'est pas dans un viewBox de 200x200.");
          }
        }
        // Utiliser fill="currentColor" ou des styles CSS pour la couleur du texte dans le SVG par défaut
        // S'assurer que le contenu SVG par défaut est visible
        if (svgRoot.innerHTML.trim() === "") {
            originalContent = '<rect x="0" y="0" width="100%" height="100%" fill="white"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="gray">Empty SVG</text></rect>';
        } else {
            originalContent = svgRoot.innerHTML;
        }
      }
    } catch (e) {
      console.error("Exception lors du traitement du SVG fourni:", e);
      // originalViewBox and originalContent remain as defaults
    }
    
    // Créer un SVG qui imbrique le contenu SVG de l'utilisateur,
    // en utilisant preserveAspectRatio pour le centrer et le mettre à l'échelle.
    const simplifiedSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" 
           width="${width}" 
           height="${height}" 
           viewBox="0 0 ${width} ${height}">
        <svg 
          viewBox="${originalViewBox}" 
          preserveAspectRatio="xMidYMid meet" 
          width="100%" 
          height="100%"
          x="0" y="0">
          ${originalContent}
        </svg>
      </svg>
    `;
    
    return new Promise((resolve) => {
      try {
        // Approche de rendu direct en utilisant une image
        const img = new Image();
        const svgBlob = new Blob([simplifiedSVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        // Définir un timeout pour éviter les blocages
        const timeout = setTimeout(() => {
          console.warn("SVG rasterization timed out, using fallback");
          URL.revokeObjectURL(url);
          resolve([]);
        }, 5000);
        
        img.onload = () => {
          clearTimeout(timeout);
          
          // Créer un canvas temporaire pour rasteriser
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tempCtx = tempCanvas.getContext("2d");
          
          // Dessiner l'image au centre du canvas
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const canvasAspect = width / height;
          let drawWidth, drawHeight;
          
          if (canvasAspect > imgAspect) {
            drawHeight = height;
            drawWidth = drawHeight * imgAspect;
          } else {
            drawWidth = width;
            drawHeight = drawWidth / imgAspect;
          }
          
          const offsetX = (width - drawWidth) / 2;
          const offsetY = (height - drawHeight) / 2;
          
          tempCtx.clearRect(0, 0, width, height);
          tempCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          
          // Extraire les pixels non transparents
          try {
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const validPixels = [];
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                // Considérer un pixel comme valide s'il n'est pas totalement transparent
                if (data[index + 3] > 10) {
                  validPixels.push({ x, y });
                }
              }
            }
            
            console.log(`Rasterized SVG: Found ${validPixels.length} valid pixels.`);
            URL.revokeObjectURL(url);
            
            // Si aucun pixel valide n'a été trouvé, créer une forme simple
            if (validPixels.length === 0) {
              console.warn("No valid pixels found in SVG, creating fallback shape");
              
              // Créer une forme simple (cercle ou rectangle) au centre
              const centerX = Math.floor(width / 2);
              const centerY = Math.floor(height / 2);
              const radius = Math.min(width, height) / 4;
              
              for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                  const dx = x - centerX;
                  const dy = y - centerY;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  // Créer un cercle de pixels valides
                  if (distance <= radius) {
                    validPixels.push({ x, y });
                  }
                }
              }
            }
            
            resolve(validPixels);
          } catch (e) {
            console.error("Error processing rasterized SVG:", e);
            URL.revokeObjectURL(url);
            resolve([]);
          }
        };
        
        img.onerror = (err) => {
          clearTimeout(timeout);
          console.error("Error loading SVG image for rasterization:", err);
          URL.revokeObjectURL(url);
          resolve([]);
        };
        
        img.src = url;
      } catch (e) {
        console.error("Error in SVG rasterization process:", e);
        resolve([]);
      }
    });
  }, []); // No dependencies

  // Appliquer l'effet de pinceau basé sur la position de la souris
  const applyBrushEffect = useCallback(() => {
    if (!mousePositionRef.current || !settingsRef.current.trailMap) return;

    const settings = settingsRef.current;
    const simWidth = simulationDimensionsRef.current.width;
    const simHeight = simulationDimensionsRef.current.height;
    const brushSize = settings.brushSize;
    const brushStrength = settings.brushStrength;
    const centerX = Math.floor(mousePositionRef.current.x);
    const centerY = Math.floor(mousePositionRef.current.y);
    const trailMap = settings.trailMap;

    for (let y = -brushSize; y <= brushSize; y++) {
      for (let x = -brushSize; x <= brushSize; x++) {
        if (x * x + y * y <= brushSize * brushSize) {
          const px = centerX + x;
          const py = centerY + y;
          if (px >= 0 && px < simWidth && py >= 0 && py < simHeight) {
            const index = py * simWidth + px;
            const distance = Math.sqrt(x * x + y * y);
            const falloff = Math.max(0, 1 - distance / brushSize);
            trailMap[index] = Math.min(
              1.0,
              trailMap[index] + brushStrength * falloff,
            );
          }
        }
      }
    }
  }, []); // Dépend de rien qui change dynamiquement ici

  // Traiter la carte des traces (diffusion, évaporation)
  const processTrailMap = useCallback(() => {
    const settings = settingsRef.current;
    const simWidth = simulationDimensionsRef.current.width;
    const simHeight = simulationDimensionsRef.current.height;
    const evaporationRate = settings.evaporationRate;
    const trailMap = settings.trailMap;
    const processedTrailMap = settings.processedTrailMap;

    if (!trailMap || !processedTrailMap) return;

    applyBrushEffect();

    for (let y = 0; y < simHeight; y++) {
      for (let x = 0; x < simWidth; x++) {
        const index = y * simWidth + x;
        const originalValue = trailMap[index];

        if (originalValue <= 0.001) {
          processedTrailMap[index] = 0;
          continue;
        }

        let sum = 0;
        let count = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          const sampleY = y + offsetY;
          if (sampleY >= 0 && sampleY < simHeight) {
            const rowIndex = sampleY * simWidth;
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
              const sampleX = x + offsetX;
              if (sampleX >= 0 && sampleX < simWidth) {
                sum += trailMap[rowIndex + sampleX];
                count++;
              }
            }
          }
        }

        const blurResult = count > 0 ? sum / count : 0;
        // Diffusion plus stable
        const diffusedValue = originalValue * (1 - 0.1) + blurResult * 0.1; // 0.9 & 0.1 from original
        processedTrailMap[index] = Math.max(
          0,
          diffusedValue - evaporationRate * settings.deltaTime * 60,
        ); // Scale evaporation by deltaTime
      }
    }

    // Échanger les cartes pour le prochain cycle
    settingsRef.current.trailMap = processedTrailMap;
    settingsRef.current.processedTrailMap = trailMap; // L'ancien trailMap devient le nouveau buffer
  }, [applyBrushEffect]); // Dépend de applyBrushEffect

  // Dessiner les traces sur le canvas
  const drawTrails = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const settings = settingsRef.current;
    const simWidth = simulationDimensionsRef.current.width;
    const simHeight = simulationDimensionsRef.current.height;
    const trailMap = settings.trailMap;

    if (!trailMap) return;

    ctx.fillStyle = "rgba(0, 0, 0, 1)"; // Fond noir opaque
    ctx.fillRect(0, 0, simWidth, simHeight);

    const imageData = ctx.createImageData(simWidth, simHeight);
    const data = imageData.data;

    for (let y = 0; y < simHeight; y++) {
      for (let x = 0; x < simWidth; x++) {
        const index = y * simWidth + x;
        const value = trailMap[index];

        if (value > 0.01) {
          // Seuil de visibilité
          const normalizedValue = Math.min(1.0, value);
          const hue =
            settings.baseHue + settings.hueRange * (normalizedValue - 0.5) * 2; // Centré autour de baseHue
          const lightness =
            50 + settings.lightnessRange * (normalizedValue - 0.5) * 2; // Ajuste la luminosité
          const alpha = Math.min(255, Math.floor(normalizedValue * 255));

          // Convertir HSL en RGB (simplifié, une librairie serait mieux)
          // Pour la démo, on utilise une approximation ou une couleur fixe basée sur la valeur
          const l = lightness / 100;
          const s = 1.0; // Saturation 100%
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x_ = c * (1 - Math.abs(((hue / 60) % 2) - 1));
          const m = l - c / 2;
          let r = 0,
            g = 0,
            b = 0;
          if (0 <= hue && hue < 60) {
            r = c;
            g = x_;
            b = 0;
          } else if (60 <= hue && hue < 120) {
            r = x_;
            g = c;
            b = 0;
          } else if (120 <= hue && hue < 180) {
            r = 0;
            g = c;
            b = x_;
          } else if (180 <= hue && hue < 240) {
            r = 0;
            g = x_;
            b = c;
          } else if (240 <= hue && hue < 300) {
            r = x_;
            g = 0;
            b = c;
          } else if (300 <= hue && hue < 360) {
            r = c;
            g = 0;
            b = x_;
          }
          r = Math.round((r + m) * 255);
          g = Math.round((g + m) * 255);
          b = Math.round((b + m) * 255);

          const pixelIndex = index * 4;
          data[pixelIndex] = r;
          data[pixelIndex + 1] = g;
          data[pixelIndex + 2] = b;
          data[pixelIndex + 3] = alpha;
        }
        // Les pixels < 0.01 restent noirs grâce au clearRect initial (alpha 0 par défaut dans imageData)
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, []); // Dépend des settings pour les couleurs

  // Dessiner les agents sur le canvas
  const drawAgents = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const simWidth = simulationDimensionsRef.current.width;
    const simHeight = simulationDimensionsRef.current.height;

    // Il est plus performant de modifier directement imageData si on vient de le faire pour les trails
    // Mais pour la simplicité et coller à l'original, on utilise fillRect ici.
    // Note: Ceci dessinera *par dessus* les trails.
    agentsRef.current.forEach((agent) => {
      const x = Math.floor(agent.position.x);
      const y = Math.floor(agent.position.y);
      if (x >= 0 && x < simWidth && y >= 0 && y < simHeight) {
        ctx.fillStyle = agent.color;
        ctx.fillRect(x, y, 1, 1); // Dessine un pixel
      }
    });
  }, []); // Dépend de agentsRef

  // Initialiser les agents (positionnement basé sur SVG rasterisé)
  const initAgents = useCallback(async (count, validPixels) => {
    const newAgents = [];
    const AgentClass = Agent; // Pour la portée dans la fonction

    if (!validPixels || validPixels.length === 0) {
      console.warn(
        "No valid pixels from SVG rasterization or SVG invalid. Spawning agents randomly.",
      );
      const simWidth = simulationDimensionsRef.current.width;
      const simHeight = simulationDimensionsRef.current.height;
      for (let i = 0; i < count; i++) {
        const agent = new AgentClass(settingsRef, simulationDimensionsRef);
        agent.position = {
          x: randomInRange(0, simWidth),
          y: randomInRange(0, simHeight),
        };
        agent.angle = Math.random() * Math.PI * 2;
        newAgents.push(agent);
      }
    } else {
      let pixelsCopy = [...validPixels]; // Copie pour pouvoir mélanger
      shuffle(pixelsCopy);
      let pixelIndex = 0;

      for (let i = 0; i < count; i++) {
        if (pixelIndex >= pixelsCopy.length) {
          // Si on a utilisé tous les pixels, on recommence le cycle
          shuffle(pixelsCopy);
          pixelIndex = 0;
        }
        const agent = new AgentClass(settingsRef, simulationDimensionsRef);
        const pixel = pixelsCopy[pixelIndex];
        agent.position = { x: pixel.x, y: pixel.y };
        agent.angle = Math.random() * Math.PI * 2; // Angle initial aléatoire
        newAgents.push(agent);
        pixelIndex++;
      }
    }
    agentsRef.current = newAgents;
  }, []); // Dépend de Agent et shuffle

  // Simule le "reshuffle" initial en redessinant les agents à leur position de départ
  const performInitialShuffles = useCallback(
    async (count, validPixels) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !settingsRef.current.initialAgents) return;

      const agentCount = settingsRef.current.initialAgents;
      const simWidth = simulationDimensionsRef.current.width;
      const simHeight = simulationDimensionsRef.current.height;

      for (let i = 0; i < count; i++) {
        // Pas besoin de `setTimeout` ici car on contrôle le flux avec await
        await initAgents(agentCount, validPixels); // Re-positionne les agents
        // console.log("Initial draw shuffle", i);

        // Efface et redessine seulement les agents pour l'effet visuel initial
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(0, 0, simWidth, simHeight);
        drawAgents(); // Dessine les agents à leur nouvelle position

        // Petite pause pour que ce soit visible si désiré (optionnel)
        if (i < count - 1) {
          // Ne pas attendre après le dernier shuffle
          await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms pause
        }
      }
    },
    [initAgents, drawAgents],
  ); // Dépend de initAgents et drawAgents

  // Boucle d'animation principale
  const animate = useCallback(
    (currentTime) => {
      if (!canvasRef.current || !isInitializedRef.current) {
        // console.log("Animation stopped or component unmounted.");
        return; // Arrête l'animation si le canvas n'existe plus ou si non initialisé
      }

      if (lastTimeRef.current > 0) {
        settingsRef.current.deltaTime = Math.min(
          0.1,
          (currentTime - lastTimeRef.current) / 1000,
        );
      } else {
        settingsRef.current.deltaTime = 1 / 60; // Première frame ou reset
      }
      lastTimeRef.current = currentTime;

      // 1. Traiter la carte des traces (évaporation, diffusion, brush)
      processTrailMap();

      // 2. Dessiner les traces
      drawTrails();

      // 3. Mettre à jour chaque agent
      agentsRef.current.forEach((agent) => agent.update());

      // 4. Dessiner les agents
      drawAgents();

      // Demander la prochaine frame
      animationFrameIdRef.current = requestAnimationFrame(animate);
    },
    [processTrailMap, drawTrails, drawAgents],
  ); // Dépend des fonctions de mise à jour/dessin

  // --- Gestionnaires d'événements ---

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    clearTimeout(inactivityTimeoutRef.current);
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    mousePositionRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    inactivityTimeoutRef.current = setTimeout(() => {
      mousePositionRef.current = null;
    }, 500); // Délai d'inactivité original
  }, []); // Ne dépend de rien qui change

  const handleMouseLeave = useCallback(() => {
    clearTimeout(inactivityTimeoutRef.current);
    mousePositionRef.current = null;
  }, []); // Ne dépend de rien qui change

  // --- Initialisation et Redimensionnement ---

  const initializeSimulation = useCallback(
    async (isResize = false) => {
      if (!canvasRef.current) return;
      // Si ce n'est pas un redimensionnement, et qu'on est déjà initialisé, sortir.
      if (!isResize && isInitializedRef.current) {
        console.log("Simulation already initialized.");
        return;
      }

      console.log(
        isResize
          ? "Re-initializing simulation due to resize..."
          : "Initializing simulation...",
      );
      isInitializedRef.current = false; // Marquer comme non prêt pendant l'init/re-init
      cancelAnimationFrame(animationFrameIdRef.current); // Stopper l'ancienne boucle d'animation
      animationFrameIdRef.current = null;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false }); // Important: alpha false pour fond opaque géré par drawTrails
      if (!ctx) {
        console.error("Failed to get 2D context");
        return;
      }

      // Fusionner les paramètres par défaut/aléatoires avec ceux fournis par l'utilisateur
      const randomDefaults = generateRandomSettings();
      const baseSettings = useRandomDefaults
        ? randomDefaults
        : { ...randomDefaults, ...userProps };

      // Assurer que les props numériques sont bien des nombres
      Object.keys(randomDefaults).forEach((key) => {
        if (typeof randomDefaults[key] === "number") {
          const userValue = baseSettings[key];
          if (typeof userValue === "string") {
            const parsedValue = parseFloat(userValue);
            if (!isNaN(parsedValue)) {
              baseSettings[key] = parsedValue;
            } else {
              console.warn(
                `Invalid numeric value for prop ${key}: "${userValue}". Using default: ${randomDefaults[key]}`,
              );
              baseSettings[key] = randomDefaults[key]; // Utiliser défaut si invalide
            }
          } else if (typeof userValue !== "number") {
            // Si ce n'est ni string ni number, mais devrait être number, utiliser défaut
            baseSettings[key] = randomDefaults[key];
          }
        }
      });
      settingsRef.current = baseSettings; // Stocker les settings finaux

      // Calculer les dimensions de la simulation
      const pixelScale = settingsRef.current.pixelScale;
      const simWidth = Math.max(10, Math.floor(window.innerWidth / pixelScale)); // Eviter 0
      const simHeight = Math.max(
        10,
        Math.floor(window.innerHeight / pixelScale),
      );
      simulationDimensionsRef.current = { width: simWidth, height: simHeight };

      // Configurer le canvas (taille logique et CSS)
      canvas.width = simWidth;
      canvas.height = simHeight;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      canvas.style.display = "block"; // Assurer la visibilité
      canvas.style.background = "#111"; // Fond sombre par défaut
      canvas.style.imageRendering = "pixelated"; // Rendu pixelisé
      canvas.style.cursor = "crosshair"; // Curseur

      // Initialiser les cartes de traces (Float32Array pour performance)
      settingsRef.current.trailMap = new Float32Array(simWidth * simHeight);
      settingsRef.current.processedTrailMap = new Float32Array(
        simWidth * simHeight,
      );

      // Rasteriser le SVG (celui par défaut ou fourni)
      const validPixels = await rasterizeSVG(svgShape, simWidth, simHeight);

      // Effectuer les shuffles initiaux pour l'effet visuel
      await performInitialShuffles(
        settingsRef.current.reshuffleCount,
        validPixels,
      );

      // Ajouter les listeners de souris (s'ils n'existent pas déjà)
      // (useEffect s'assurera qu'ils sont ajoutés/retirés correctement)

      // Marquer comme initialisé et démarrer l'animation après le délai
      isInitializedRef.current = true;
      console.log("Initialization complete. Starting animation soon...");

      // Nettoyer l'ancien timeout avant d'en créer un nouveau
      if (settingsRef.current.startTimeoutId) {
        clearTimeout(settingsRef.current.startTimeoutId);
      }

      settingsRef.current.startTimeoutId = setTimeout(
        () => {
          if (isInitializedRef.current && !animationFrameIdRef.current) {
            // Vérifier si toujours initialisé et pas déjà en cours
            console.log("Starting animation loop.");
            lastTimeRef.current = performance.now(); // Important: Initialiser le temps juste avant de démarrer
            animationFrameIdRef.current = requestAnimationFrame(animate);
          }
        },
        isResize ? 100 : settingsRef.current.startDelay,
      ); // Délai plus court pour resize
    },
    [
      useRandomDefaults,
      JSON.stringify(userProps),
      svgShape,
      rasterizeSVG,
      performInitialShuffles,
      animate,
    ],
  ); // Dépendances clés pour re-init

  // Gestionnaire de redimensionnement avec debounce
  const handleResize = useCallback(() => {
    clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(() => {
      initializeSimulation(true); // Appeler l'initialisation en mode resize
    }, 250); // Debounce de 250ms
  }, [initializeSimulation]);

  // --- Effet principal pour l'initialisation, le nettoyage et les listeners ---
  useEffect(() => {
    console.log("SlimeSimulation component mounted or dependencies changed.");
    initializeSimulation(false); // Initialisation au montage

    // Ajouter les listeners globaux
    window.addEventListener("resize", handleResize);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);
    }

    // Fonction de nettoyage pour le démontage ou avant la prochaine exécution
    return () => {
      console.log("Cleaning up SlimeSimulation...");
      isInitializedRef.current = false; // Marquer comme non initialisé
      cancelAnimationFrame(animationFrameIdRef.current); // Arrêter l'animation
      animationFrameIdRef.current = null;
      if (settingsRef.current.startTimeoutId) {
        clearTimeout(settingsRef.current.startTimeoutId); // Annuler le démarrage différé
      }
      clearTimeout(resizeTimeoutRef.current); // Annuler le debounce de resize
      clearTimeout(inactivityTimeoutRef.current); // Annuler le timer d'inactivité souris

      // Retirer les listeners
      window.removeEventListener("resize", handleResize);
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseleave", handleMouseLeave);
      }

      // Optionnel: libérer la mémoire des refs si nécessaire (généralement pas requis)
      // agentsRef.current = [];
      // settingsRef.current = {}; // Peut être utile si les settings contiennent de gros objets
    };
  }, [initializeSimulation, handleResize, handleMouseMove, handleMouseLeave]); // Dépendances pour recréer les listeners si les handlers changent

  // Le composant rend simplement le canvas, tout le reste est géré via refs et effets
  return <canvas ref={canvasRef} />;
};

export default SlimeSimulation;
