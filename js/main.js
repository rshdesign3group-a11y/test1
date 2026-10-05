/**
 * Deep Holes – Main
 */

import {
  getAllHoles, addHole, updateHole, deepenHole, getMyMaxDepth, session, GUEST_USER,
  floorCount, getGallery, setGallery, SLOTS
} from "./data.js?v=6";
import { MapRenderer } from "./map.js?v=6";
import { RoomRenderer } from "./room.js?v=6";
import { fetchWalletNFTs } from "./nft.js?v=6";

const $ = (id) => document.getElementById(id);

// DOM
const mapScreen = $("map-screen");
const roomScreen = $("room-screen");
const mapCanvas = $("map-canvas");
const roomCanvas = $("room-canvas");
const backBtn = $("back-to-map-btn");
const roomTitle = $("room-title");
const roomDepthBadge = $("room-depth-badge");
const roomImage = $("room-image");
const roomDescription = $("room-description");
const roomLinks = $("room-links");
const emptyState = $("empty-state");
const buyFirstBtn = $("buy-first-hole-btn");
const buyHoleBtn = $("buy-hole-btn");
const ownerPanelBtn = $("owner-panel-btn");

// Modals
const buyModal = $("buy-modal");
const depthSlider = $("depth-slider");
const depthValue = $("depth-value");
const costDisplay = $("cost-display");
const cancelBuyBtn = $("cancel-buy-btn");
const confirmBuyBtn = $("confirm-buy-btn");

const ownerModal = $("owner-modal");
const editDescription = $("edit-description");
const editImage = $("edit-image");
const editLinks = $("edit-links");
const editCurrentDepth = $("edit-current-depth");
const buyUsername = $("buy-username");
const buyImageFile = $("buy-image");
const editUsername = $("edit-username");
const editImageFile = $("edit-image-file");
const deepenBtn = $("deepen-btn");
const cancelEditBtn = $("cancel-edit-btn");
const saveEditBtn = $("save-edit-btn");

let currentHole = null;
let isOwner = false;
let pendingBuyImage = null;
let pendingEditImage = null;

/* ---------- helpers ---------- */
// only http(s) links are allowed (no javascript: URLs)
function safeUrl(u) {
  try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}

function readFile(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Crop to a square and shrink to 256px so the profile picture is light enough to store
async function fileToAvatar(file) {
  const src = await readFile(file); if (!src) return null;
  const img = await loadImg(src); if (!img) return null;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const s = Math.min(img.width, img.height);
  c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
  return c.toDataURL("image/jpeg", 0.85);
}
// Keep the aspect ratio, longest side max 720px (wall pictures)
async function fileToPicture(file) {
  const src = await readFile(file); if (!src) return null;
  const img = await loadImg(src); if (!img) return null;
  const k = Math.min(1, 720 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

buyImageFile.addEventListener("change", async () => {
  pendingBuyImage = buyImageFile.files[0] ? await fileToAvatar(buyImageFile.files[0]) : null;
});
editImageFile.addEventListener("change", async () => {
  pendingEditImage = editImageFile.files[0] ? await fileToAvatar(editImageFile.files[0]) : null;
});

/* ---------- picture viewer (cute frame) ---------- */
const lightbox = $("lightbox");
const lbImg = $("lb-img");
const lbCaption = $("lb-caption");

function openLightbox({ item, floor, slot }) {
  lbImg.onerror = () => { lbCaption.textContent = "Couldn't load this picture"; };
  lbImg.src = item.url;
  const side = slot < 3 ? "left wall" : "right wall";
  lbCaption.textContent = item.title || `Floor ${floor + 1} · ${side}`;
  lbImg.alt = lbCaption.textContent;
  lightbox.classList.remove("hidden");
  $("lb-close").focus();
}
function closeLightbox() { lightbox.classList.add("hidden"); lbImg.removeAttribute("src"); }
$("lb-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("pointerdown", (e) => { if (e.target === lightbox) closeLightbox(); });
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!lightbox.classList.contains("hidden")) closeLightbox();
  else if (!$("nft-modal").classList.contains("hidden")) closeNftPicker();
});

/* ---------- renderers ---------- */
const mapRenderer = new MapRenderer(mapCanvas, getAllHoles(), onHoleClick, getMyMaxDepth);
mapRenderer.owner = session.user;
const roomRenderer = new RoomRenderer(roomCanvas, {
  onFrame: (info) => {
    if (info.item) openLightbox(info);
    else if (isOwner) openOwnerPanel(info.floor, info.slot);   // empty frame -> edit that frame
  }
});

/* ---------- events ---------- */
backBtn.addEventListener("click", showMap);

buyFirstBtn.addEventListener("click", () => openBuyModal());
buyHoleBtn.addEventListener("click", () => openBuyModal());

depthSlider.addEventListener("input", () => {
  const d = parseInt(depthSlider.value, 10);
  depthValue.textContent = d;
  costDisplay.textContent = `$${d * 4}`;
});

cancelBuyBtn.addEventListener("click", () => buyModal.classList.add("hidden"));
confirmBuyBtn.addEventListener("click", () => {
  const depth = parseInt(depthSlider.value, 10);
  const hole = addHole({
    depth,
    description: `A new hole starting at depth ${depth}.`,
    username: buyUsername.value.trim() || undefined,
    image: pendingBuyImage,
    owner: session.user
  });
  buyModal.classList.add("hidden");
  updateEmptyState();
  mapRenderer.setHoles(getAllHoles());
  mapRenderer.focusHole(hole);
  console.log("Hole created at depth", depth, hole);
});

ownerPanelBtn.addEventListener("click", () => openOwnerPanel());
cancelEditBtn.addEventListener("click", () => ownerModal.classList.add("hidden"));

saveEditBtn.addEventListener("click", () => {
  if (!currentHole) return;
  const linksText = editLinks.value.trim();
  const links = linksText
    ? linksText.split("\n").map(line => {
        const [label, ...rest] = line.split("|");
        const url = safeUrl((rest.join("|") || "").trim());
        return url ? { label: (label || "").trim() || "Link", url } : null;
      }).filter(Boolean)
    : [];

  updateHole(currentHole.id, {
    username: editUsername.value.trim() || currentHole.username,
    description: editDescription.value,
    image: pendingEditImage || editImage.value.trim() || currentHole.image,
    links
  });
  for (const f of Object.keys(draft)) setGallery(currentHole, Number(f), draft[f]);

  ownerModal.classList.add("hidden");
  fillRoomHeader(currentHole);
  roomRenderer.enter(currentHole, isOwner, roomRenderer.floor);   // rebuild, stay on the same floor
  mapRenderer.holes = getAllHoles();
});

deepenBtn.addEventListener("click", () => {
  if (!currentHole) return;
  deepenHole(currentHole.id);
  editCurrentDepth.textContent = currentHole.depth;
  roomDepthBadge.textContent = `Depth ${currentHole.depth}`;
  for (let f = 0; f < floorCount(currentHole.depth); f++) if (!draft[f]) draft[f] = getGallery(currentHole, f);   // new floor -> new frames
  renderGalleryEditor();
  roomRenderer.enter(currentHole, isOwner, roomRenderer.floor);   // rebuild room, keep the current floor
  mapRenderer.holes = getAllHoles();
  console.log("Deepened to", currentHole.depth);
});

/* ---------- core ---------- */
function onHoleClick(hole) {
  currentHole = hole;
  isOwner = hole.owner === session.user;
  showRoom(hole, isOwner);
}

function showMap() {
  roomRenderer.leave();
  closeLightbox();
  roomScreen.classList.remove("active");
  mapScreen.classList.add("active");
  mapRenderer.holes = getAllHoles();
  mapRenderer.setActive(true);                      // after the screen is visible, so the canvas gets its real size
  if (currentHole) mapRenderer.centerOn(currentHole); // come back exactly where we left: on this hole
  updateEmptyState();
}

function fillRoomHeader(hole) {
  roomTitle.textContent = hole.username || `Hole #${hole.id}`;
  roomDepthBadge.textContent = `Depth ${hole.depth}`;
  if (hole.image) roomImage.src = hole.image; else roomImage.removeAttribute("src");
  roomImage.onerror = () => { roomImage.removeAttribute("src"); };
  roomDescription.textContent = hole.description || "No description yet.";
  roomLinks.innerHTML = "";
  (hole.links || []).forEach(link => {
    const href = safeUrl(link.url); if (!href) return;
    const a = document.createElement("a");
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = link.label;
    roomLinks.appendChild(a);
  });
}

function showRoom(hole, owner) {
  mapRenderer.setActive(false);
  mapScreen.classList.remove("active");
  roomScreen.classList.add("active");
  fillRoomHeader(hole);
  ownerPanelBtn.classList.toggle("hidden", !owner);   // owner button only for owned holes
  // Small delay to ensure canvas is visible before starting
  setTimeout(() => { roomRenderer.enter(hole, owner); }, 50);
}

function updateEmptyState() {
  emptyState.classList.toggle("hidden", getAllHoles().length > 0);
}

function openBuyModal() {
  pendingBuyImage = null; buyImageFile.value = ""; buyUsername.value = "";
  depthSlider.value = 1;
  depthValue.textContent = "1";
  costDisplay.textContent = "$4";
  buyModal.classList.remove("hidden");
}

/* ---------- edit hole + wall pictures ---------- */
let draft = {};          // { floor: [item|null x6] } edited but not saved yet
let draftFloor = 0;
let flashSlot = -1;

const SLOT_NAMES = ["Left wall · 1", "Left wall · 2", "Left wall · 3", "Right wall · 1", "Right wall · 2 (shows your profile picture when empty)", "Right wall · 3"];

function openOwnerPanel(floor = 0, slot = -1) {
  if (!currentHole) return;
  editDescription.value = currentHole.description || "";
  pendingEditImage = null; editImageFile.value = "";
  editUsername.value = currentHole.username || "";
  editImage.value = currentHole.image?.startsWith("data:") ? "" : currentHole.image || "";
  editLinks.value = (currentHole.links || []).map(l => `${l.label}|${l.url}`).join("\n");
  editCurrentDepth.textContent = currentHole.depth;
  draft = {};
  for (let f = 0; f < floorCount(currentHole.depth); f++) draft[f] = getGallery(currentHole, f).map(it => (it ? { ...it } : null));
  draftFloor = Math.min(floor, floorCount(currentHole.depth) - 1);
  flashSlot = slot;
  renderGalleryEditor();
  ownerModal.classList.remove("hidden");
  if (slot >= 0) requestAnimationFrame(() => document.querySelector(".slot-row.flash")?.scrollIntoView({ block: "center" }));
}

function renderGalleryEditor() {
  const tabs = $("gallery-floors"), box = $("gallery-slots");
  tabs.innerHTML = ""; box.innerHTML = "";
  const floors = floorCount(currentHole.depth);
  for (let f = 0; f < floors; f++) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = `Floor ${f + 1}`; b.className = f === draftFloor ? "on" : "";
    b.addEventListener("click", () => { draftFloor = f; flashSlot = -1; renderGalleryEditor(); });
    tabs.appendChild(b);
  }
  [["Left wall", 0], ["Right wall", 3]].forEach(([title, from]) => {
    const group = document.createElement("div"); group.className = "slot-group";
    group.innerHTML = `<h4>${title}</h4>`;
    for (let i = from; i < from + 3; i++) group.appendChild(slotRow(i));
    box.appendChild(group);
  });
}

function slotRow(i) {
  const item = draft[draftFloor][i];
  const row = document.createElement("div"); row.className = "slot-row" + (i === flashSlot ? " flash" : "");

  const thumb = document.createElement("div"); thumb.className = "slot-thumb";
  const setThumb = (url) => {
    thumb.innerHTML = "";
    if (url) { const im = document.createElement("img"); im.src = url; im.alt = ""; im.onerror = () => { thumb.textContent = "⚠"; }; thumb.appendChild(im); }
    else thumb.textContent = "+";
  };
  setThumb(item?.url);

  const body = document.createElement("div"); body.className = "slot-body";
  const name = document.createElement("div"); name.className = "slot-name"; name.textContent = SLOT_NAMES[i];

  const input = document.createElement("input"); input.type = "text"; input.placeholder = "https://… picture link";
  input.value = item && !item.url.startsWith("data:") ? item.url : "";
  if (item?.url.startsWith("data:")) input.placeholder = "Uploaded picture";
  input.addEventListener("input", () => {
    const v = input.value.trim();
    draft[draftFloor][i] = v ? { url: v } : null;
    setThumb(v || null);
  });

  const actions = document.createElement("div"); actions.className = "slot-actions";
  const upload = document.createElement("input"); upload.type = "file"; upload.accept = "image/*";
  upload.addEventListener("change", async () => {
    if (!upload.files[0]) return;
    const url = await fileToPicture(upload.files[0]);
    if (url) { draft[draftFloor][i] = { url }; flashSlot = i; renderGalleryEditor(); }
  });
  const upBtn = btn("Upload", "btn", () => upload.click());
  const nftBtn = btn("My NFTs", "btn", () => openNftPicker(i));
  const clr = btn("Remove", "btn btn-danger", () => { draft[draftFloor][i] = null; flashSlot = -1; renderGalleryEditor(); });
  actions.append(upBtn, nftBtn, clr, upload);

  body.append(name, input, actions);
  row.append(thumb, body);
  return row;
}
function btn(text, cls, fn) {
  const b = document.createElement("button"); b.type = "button"; b.className = cls + " btn-small"; b.textContent = text;
  b.addEventListener("click", fn); return b;
}

/* ---------- NFT picker ---------- */
const nftModal = $("nft-modal"), nftGrid = $("nft-grid"), nftNote = $("nft-note"), nftConnectBtn = $("nft-connect-btn");
let nftTarget = -1;

async function openNftPicker(slot) {
  nftTarget = slot;
  nftGrid.innerHTML = ""; nftConnectBtn.classList.add("hidden");
  nftModal.classList.remove("hidden");
  if (!session.wallet) {
    nftNote.textContent = "Connect your wallet to hang your NFTs on the wall.";
    nftConnectBtn.classList.remove("hidden");
    return;
  }
  nftNote.textContent = "Loading your NFTs…";
  try {
    const { demo, items } = await fetchWalletNFTs(session.wallet);
    if (nftModal.classList.contains("hidden")) return;
    nftNote.textContent = demo
      ? "Demo pictures: set DAS_RPC_URL in js/config.js to list the real NFTs of your wallet."
      : items.length ? "Choose an NFT for this frame." : "No NFTs with a picture were found in this wallet.";
    items.forEach((n) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "nft-item";
      const im = document.createElement("img"); im.src = n.image; im.alt = ""; im.loading = "lazy";
      const t = document.createElement("span"); t.textContent = n.name;
      b.append(im, t);
      b.addEventListener("click", () => {
        draft[draftFloor][nftTarget] = { url: n.image, title: n.name };
        flashSlot = nftTarget; closeNftPicker(); renderGalleryEditor();
      });
      nftGrid.appendChild(b);
    });
  } catch (e) {
    console.warn("NFT lookup failed", e);
    nftNote.textContent = "Could not load your NFTs. Check the RPC endpoint in js/config.js and try again.";
  }
}
function closeNftPicker() { nftModal.classList.add("hidden"); }
$("nft-close-btn").addEventListener("click", closeNftPicker);
nftConnectBtn.addEventListener("click", async () => { if (await connectWallet()) openNftPicker(nftTarget); });

/* ---------- Wallet (Phantom / Solana) ---------- */
const walletBtn = $("connect-wallet-btn");
const walletAddr = $("wallet-address");
const disconnectBtn = $("disconnect-wallet-btn");
const provider = () => window.phantom?.solana?.isPhantom ? window.phantom.solana : (window.solana?.isPhantom ? window.solana : null);

const nftCount = $("nft-count");
// Check the NFTs of every wallet that connects (cached, so the picker opens instantly)
function checkWalletNFTs(address) {
  nftCount.classList.remove("hidden"); nftCount.textContent = "NFTs: …";
  fetchWalletNFTs(address).then(({ demo, items }) => {
    if (session.wallet !== address) return;            // wallet changed meanwhile
    nftCount.textContent = demo ? "NFTs: demo" : `NFTs: ${items.length}`;
    console.log(`Wallet ${address}: ${items.length} NFTs`, items);
  }).catch((e) => {
    if (session.wallet !== address) return;
    nftCount.textContent = "NFTs: error"; console.warn("NFT check failed", e);
  });
}

function applyConnected(address) {
  session.wallet = address;
  session.user = address;
  mapRenderer.owner = session.user;
  walletBtn.classList.add("hidden");
  walletAddr.textContent = address.slice(0, 4) + "…" + address.slice(-4);
  walletAddr.title = address;
  walletAddr.classList.remove("hidden");
  disconnectBtn.classList.remove("hidden");
  mapRenderer.clamp();
  checkWalletNFTs(address);
}
function applyDisconnected() {
  session.wallet = null;
  session.user = GUEST_USER;
  mapRenderer.owner = session.user;
  walletBtn.classList.remove("hidden");
  walletAddr.classList.add("hidden"); walletAddr.textContent = ""; walletAddr.removeAttribute("title");
  disconnectBtn.classList.add("hidden");
  nftCount.classList.add("hidden");
  mapRenderer.clamp();
}
async function connectWallet() {
  const sol = provider();
  if (!sol) { window.open("https://phantom.app/", "_blank", "noopener"); return false; }
  try {
    const { publicKey } = await sol.connect();
    applyConnected(publicKey.toString());
    return true;
  } catch (e) { console.warn("Wallet connection rejected", e); return false; }
}
async function disconnectWallet() {
  try { await provider()?.disconnect(); } catch (e) { console.warn("Wallet disconnect failed", e); }
  applyDisconnected();
}
walletBtn.addEventListener("click", connectWallet);
disconnectBtn.addEventListener("click", disconnectWallet);
{
  const sol = provider();
  if (sol) {
    sol.on?.("disconnect", applyDisconnected);
    sol.on?.("accountChanged", (pk) => (pk ? applyConnected(pk.toString()) : applyDisconnected()));
    sol.connect({ onlyIfTrusted: true }).then(({ publicKey }) => applyConnected(publicKey.toString())).catch(() => {});  // silent re-login
  }
}

// Init
updateEmptyState();
showMap();

window.DeepHoles = {
  getHoles: getAllHoles,
  addHole,
  deepenHole,
  mapRenderer,
  roomRenderer
};

console.log("%cDeep Holes ready", "color:#38bdf8; font-weight:bold;");
