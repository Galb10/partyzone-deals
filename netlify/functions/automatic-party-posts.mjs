import { getStore } from "@netlify/blobs";
import { queryAliExpressProducts, sendTelegramProductResults } from "./telegram-webhook.mjs";

const FIVE_HOURS = 5 * 60 * 60 * 1000;
const RETRY_INTERVAL = 60 * 60 * 1000;
const STATE_KEY = "publisher-state";

const SEARCH_TERMS = [
  "party decorations",
  "disco DJ lights",
  "party balloons confetti",
  "glow sticks rave accessories",
  "bubble smoke fog machine",
  "photo booth party props",
  "birthday party supplies",
  "neon party accessories",
];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function productKey(product) {
  if (product.id) return `id:${product.id}`;
  return `title:${product.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export default async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("Telegram publishing environment variables are missing");
  }

  const store = getStore("partyzone-auto-publisher");
  const state = (await store.get(STATE_KEY, { type: "json", consistency: "strong" })) ?? {
    lastRunAt: null,
    lastAttemptAt: null,
    postedProductKeys: [],
  };

  const now = Date.now();
  if (state.lastRunAt && now - Date.parse(state.lastRunAt) < FIVE_HOURS) {
    return new Response("Not due yet");
  }
  if (state.lastAttemptAt && now - Date.parse(state.lastAttemptAt) < RETRY_INTERVAL) {
    return new Response("Waiting before retrying an incomplete product search");
  }

  // Record the attempt first so a failed search does not hammer AliExpress every 15 minutes.
  await store.setJSON(STATE_KEY, { ...state, lastAttemptAt: new Date(now).toISOString() });

  const alreadyPosted = new Set(state.postedProductKeys ?? []);
  const candidates = new Map();
  const terms = shuffle(SEARCH_TERMS);

  // Search the first 50 results for every party category, then inspect page 2 if needed.
  for (const pageNo of [1, 2]) {
    const results = await Promise.allSettled(
      terms.map((term) => queryAliExpressProducts(term, { pageNo, pageSize: 50 })),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") {
        console.warn("A party-category search failed:", result.reason?.message ?? "unknown error");
        continue;
      }
      for (const product of result.value) {
        const key = productKey(product);
        if (!alreadyPosted.has(key) && !candidates.has(key)) {
          candidates.set(key, { ...product, _dedupeKey: key });
        }
      }
    }

    if (candidates.size >= 3) break;
  }

  if (candidates.size < 3) {
    console.warn(`Automatic post skipped: only ${candidates.size} new relevant products were found; 3 are required.`);
    return new Response("Not enough new relevant products; will retry later");
  }

  const selected = shuffle([...candidates.values()]).slice(0, 3);
  await sendTelegramProductResults(token, chatId, selected, "מבחר אביזרים למסיבה");

  const nextState = {
    lastRunAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    // Keep a rolling history so products are not reposted after future deployments.
    postedProductKeys: [...(state.postedProductKeys ?? []), ...selected.map(productKey)].slice(-2000),
  };
  await store.setJSON(STATE_KEY, nextState);

  console.log("Automatic PartyZone post sent:", selected.map(productKey));
  return new Response("Published 3 new party products");
};

export const config = {
  // Check every 15 minutes; publish as soon as 5 hours have elapsed since the last post.
  schedule: "*/15 * * * *",
};
