/**
 * Lists the NFTs owned by a wallet (Solana DAS `getAssetsByOwner`, Helius).
 * Includes compressed NFTs, pages through all results, caches per wallet.
 * Returns { demo: boolean, items: [{ id, name, image }] }
 */
import { DAS_RPC_URL } from "./config.js?v=6";

const ipfs = (u) => (u || "").replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/").replace(/^ar:\/\//, "https://arweave.net/");
const cache = new Map();   // owner -> Promise<{demo, items}>

async function rpc(owner, page) {
  const res = await fetch(DAS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "deep-holes", method: "getAssetsByOwner",
      params: { ownerAddress: owner, page, limit: 1000, displayOptions: { showFungible: false } }
    })
  });
  if (!res.ok) throw new Error("RPC error " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result?.items || [];
}

async function load(owner) {
  if (!DAS_RPC_URL) {
    return { demo: true, items: Array.from({ length: 8 }, (_, i) => ({
      id: "demo" + i, name: `Demo NFT #${i + 1}`, image: `https://picsum.photos/seed/dh-nft${i}/480/480` })) };
  }
  const all = [];
  for (let page = 1; page <= 10; page++) {            // up to 10 000 assets
    const items = await rpc(owner, page);
    all.push(...items);
    if (items.length < 1000) break;
  }
  const items = all.filter((a) => a.ownership?.owner ? a.ownership.owner === owner : true).map((a) => {
    const files = a.content?.files || [];
    const file = files.find((f) => (f.mime || "").startsWith("image/")) || files[0];
    const image = ipfs(file?.cdn_uri || a.content?.links?.image || file?.uri);
    return { id: a.id, name: a.content?.metadata?.name || "NFT", image, compressed: !!a.compression?.compressed };
  }).filter((n) => n.image);
  return { demo: false, items };
}

/** Cached lookup; pass force=true to refresh. */
export function fetchWalletNFTs(owner, force = false) {
  if (force || !cache.has(owner)) {
    const p = load(owner);
    cache.set(owner, p);
    p.catch(() => cache.delete(owner));               // failed lookups can be retried
  }
  return cache.get(owner);
}
