/**
 * Procedural world – deterministic, so every layer/column is generated the
 * same way for every player and can go on forever (any depth, any x).
 */
export const TAU = Math.PI * 2;
export const hash = (a, b = 0, c = 0) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 13.37) * 43758.5453;
  return x - Math.floor(x);
};

// 8 base biomes; each further group of 8 shifts hue so layers never repeat exactly
const BIOMES = [
  { n: "Topsoil",      h: 28,  s: 45, l: 30, tx: "roots",  c: ["worm", "root"] },
  { n: "Clay",         h: 14,  s: 50, l: 30, tx: "pebble", c: ["beetle", "worm", "root"] },
  { n: "Gravel",       h: 35,  s: 12, l: 36, tx: "pebble", c: ["mole", "goldworm", "beetle"] },
  { n: "Stone",        h: 215, s: 8,  l: 30, tx: "brick",  c: ["bat", "crystal", "skeleton"] },
  { n: "Boneyard",     h: 40,  s: 10, l: 20, tx: "bone",   c: ["skeleton", "bat", "bone"] },
  { n: "Gold vein",    h: 42,  s: 40, l: 20, tx: "ore",    c: ["goldworm", "goldworm", "nugget"] },
  { n: "Crystal cave", h: 240, s: 35, l: 20, tx: "crys",   c: ["crystal", "diamond", "bat"] },
  { n: "Magma",        h: 8,   s: 60, l: 14, tx: "lava",   c: ["salamander", "diamond", "goldworm"] }
];
const cache = new Map();
export function biome(i) {
  if (!cache.has(i)) {
    const b = BIOMES[i % 8], tier = Math.floor(i / 8);
    cache.set(i, { ...b, i, h: (b.h + tier * 47) % 360, l: Math.max(8, b.l - tier * 1.5),
      name: b.n + (tier ? ` ${tier + 1}` : "") });
  }
  return cache.get(i);
}
export const hsl = (b, dl = 0, a = 1) => `hsla(${b.h},${b.s}%,${Math.max(3, b.l + dl)}%,${a})`;

// Surface changes every 1800px: new sky, ground, tree species and animals
export const REGIONS = [
  { sky: ["#0c4a6e", "#38bdf8", "#bae6fd"], grass: "#4ade80", blade: "#22c55e", leaf: ["#14532d", "#166534", "#15803d"], trunk: "#78350f",
    trees: ["oak", "oak", "pine"], fauna: ["rabbit", "sheep", "fox", "deer", "sheep", "squirrel", "hedgehog"] },
  { sky: ["#7c2d12", "#fb923c", "#fde68a"], grass: "#e5b863", blade: "#b45309", leaf: ["#15803d", "#16a34a", "#4d7c0f"], trunk: "#92400e",
    trees: ["cactus", "palm", "cactus"], fauna: ["camel", "fennec", "snake"] },
  { sky: ["#1e293b", "#64748b", "#e2e8f0"], grass: "#f1f5f9", blade: "#cbd5e1", leaf: ["#0f766e", "#115e59", "#134e4a"], trunk: "#44403c",
    trees: ["pine", "pine", "oak"], fauna: ["polar", "wolf", "penguin", "sheep", "rabbit"] },
  { sky: ["#4c1d95", "#c026d3", "#fbcfe8"], grass: "#f9a8d4", blade: "#db2777", leaf: ["#be185d", "#db2777", "#f472b6"], trunk: "#581c87",
    trees: ["oak", "palm", "oak"], fauna: ["unicorn", "sheep", "rabbit", "squirrel", "fox"] },
  { sky: ["#052e16", "#15803d", "#bbf7d0"], grass: "#22c55e", blade: "#15803d", leaf: ["#064e3b", "#047857", "#10b981"], trunk: "#422006",
    trees: ["palm", "oak", "palm"], fauna: ["snake", "sheep", "squirrel", "deer", "hedgehog"] }
];
export const regionAt = (wx) => REGIONS[Math.floor(hash(Math.floor(wx / 1800), 7) * REGIONS.length)];
