/**
 * Data layer (Mock) – ready for Supabase replacement
 */

export let holes = [
  {
    id: 1,
    owner: "demo1",
    username: "Luna",
    depth: 3,
    x: 0,
    image: "https://picsum.photos/seed/rabbit1/400/400",
    description: "My first experimental hole. Feel free to look around!",
    links: [
      { label: "Twitter", url: "https://x.com" },
      { label: "Website", url: "https://example.com" }
    ],
    customRabbit: { color: "#f59e0b", earColor: "#d97706" },
    gallery: {
      0: [
        { url: "https://picsum.photos/seed/luna-a/480/360", title: "Morning dig" },
        null,
        { url: "https://picsum.photos/seed/luna-b/360/480", title: "Mushroom patch" },
        { url: "https://picsum.photos/seed/luna-c/480/360" },
        null,
        { url: "https://picsum.photos/seed/luna-d/480/480", title: "Home sweet hole" }
      ],
      1: [null, { url: "https://picsum.photos/seed/luna-e/480/360", title: "Second floor view" }]
    }
  },
  {
    id: 2,
    owner: "demo2",
    username: "Bolt",
    depth: 8,
    x: 1,
    image: "https://picsum.photos/seed/rabbit2/400/400",
    description: "Going deeper. The soil here feels different.",
    links: [
      { label: "GitHub", url: "https://github.com" }
    ],
    customRabbit: { color: "#8b5cf6", earColor: "#7c3aed" }
  },
  {
    id: 3,
    owner: "demo3",
    username: "Nyx",
    depth: 15,
    x: 2,
    image: "https://picsum.photos/seed/rabbit3/400/400",
    description: "Reached the stone layer. Things are getting interesting.",
    links: [],
    customRabbit: { color: "#10b981", earColor: "#059669" }
  },
  {
    id: 4,
    owner: "you",
    username: "You",
    depth: 1,
    x: 3,
    image: "https://picsum.photos/seed/rabbit4/400/400",
    description: "Just bought this hole. Still shallow.",
    links: [],
    customRabbit: { color: "#ef4444", earColor: "#dc2626" }
  }
];

// Current player. Replaced by the wallet address after "Connect Wallet".
export const GUEST_USER = "you";
export const session = { user: GUEST_USER, wallet: null };

/* ---------- wall pictures ----------
 * Every floor of a burrow has its own 6 frames: slots 0-2 = left wall,
 * slots 3-5 = right wall (both counted left -> right as seen on screen).
 * hole.gallery = { [floorIndex]: [ { url, title? } | null, ... ] }
 */
export const SLOTS = 6;
export const floorCount = (depth) => 1 + Math.floor((Math.max(1, depth) - 1) / 3);
export function getGallery(hole, floor) {
  const g = hole?.gallery?.[floor] || [];
  return Array.from({ length: SLOTS }, (_, i) => g[i] || null);
}
export function setGallery(hole, floor, items) {
  hole.gallery = hole.gallery || {};
  hole.gallery[floor] = Array.from({ length: SLOTS }, (_, i) => items[i] || null);
}

/** Deepest hole owned by the current player – decides which layers are unlocked. */
export function getMyMaxDepth() {
  return holes.filter(h => h.owner === session.user).reduce((m, h) => Math.max(m, h.depth), 0);
}

// Image cache so canvases can draw user pictures (loaded once)
const imgCache = new Map();
export function getImage(url) {
  if (!url) return null;
  if (!imgCache.has(url)) {
    const img = new Image();
    img.src = url;
    imgCache.set(url, img);
  }
  return imgCache.get(url);
}

export function getAllHoles() {
  return [...holes];
}

export function getHoleById(id) {
  return holes.find(h => h.id === id);
}

export function addHole({ depth = 1, description, image, customRabbit, owner, username } = {}) {
  const newId = holes.length > 0 ? Math.max(...holes.map(h => h.id)) + 1 : 1;
  const newHole = {
    id: newId,
    owner: owner || session.user,
    username: username || (session.wallet ? session.wallet.slice(0, 4) + "…" + session.wallet.slice(-4) : `Rabbit #${newId}`),
    depth: Math.max(1, Math.floor(depth)),   // no upper limit
    x: holes.length,
    image: image || null,   // no picture yet -> map shows a rabbit avatar
    description: description || "A brand new hole.",
    links: [],
    gallery: {},
    customRabbit: customRabbit || {
      color: `hsl(${Math.random() * 360}, 70%, 55%)`,
      earColor: `hsl(${Math.random() * 360}, 65%, 40%)`
    }
  };
  holes.push(newHole);
  return newHole;
}

export function updateHole(id, updates) {
  const hole = getHoleById(id);
  if (!hole) return null;
  Object.assign(hole, updates);
  return hole;
}

export function deepenHole(id) {
  const hole = getHoleById(id);
  if (hole) hole.depth += 1;   // unlimited
  return hole;
}

export function clearAllHoles() {
  holes = [];
}
