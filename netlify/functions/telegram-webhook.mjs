import { createHash } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";
const ALIEXPRESS_API = "https://api-sg.aliexpress.com/sync";

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function sendTelegramMessage(token, chatId, text) {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error("Telegram sendMessage request failed");
  }
}

function aliExpressSignature(params, appSecret) {
  const source = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHash("md5")
    .update(`${appSecret}${source}${appSecret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

function aliExpressTimestamp() {
  // The TOP gateway expects the timestamp in GMT+8.
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function queryAliExpressProducts(keyword) {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID;

  if (!appKey || !appSecret || !trackingId) {
    throw new Error("AliExpress credentials are not configured");
  }

  const params = {
    app_key: appKey,
    method: "aliexpress.affiliate.product.query",
    sign_method: "md5",
    timestamp: aliExpressTimestamp(),
    v: "2.0",
    format: "json",
    keywords: keyword,
    page_no: "1",
    page_size: "5",
    target_currency: "USD",
    target_language: "EN",
    ship_to_country: "IL",
    tracking_id: trackingId,
    fields: [
      "product_id",
      "product_title",
      "product_main_image_url",
      "product_detail_url",
      "promotion_link",
      "sale_price",
      "sale_price_currency",
      "commission_rate",
    ].join(","),
  };

  params.sign = aliExpressSignature(params, appSecret);

  const body = new URLSearchParams(params);
  const response = await fetch(ALIEXPRESS_API, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error("AliExpress API did not return a valid response");
  }

  const apiResponse =
    data.aliexpress_affiliate_product_query_response ??
    data.aliexpressAffiliateProductQueryResponse ??
    data;

  if (apiResponse?.error_response || apiResponse?.code || apiResponse?.error) {
    const error = apiResponse.error_response ?? apiResponse;
    const code = error.code ?? error.error_code ?? "unknown";
    throw new Error(`AliExpress rejected the request (code: ${String(code).slice(0, 40)})`);
  }

  const result = apiResponse?.resp_result ?? apiResponse?.respResult ?? apiResponse;
  const productsContainer =
    result?.result?.products ??
    result?.products ??
    result?.result ??
    result?.product_list ??
    result?.productList;

  const products = Array.isArray(productsContainer)
    ? productsContainer
    : productsContainer?.product
      ? (Array.isArray(productsContainer.product) ? productsContainer.product : [productsContainer.product])
      : [];

  return products.slice(0, 5).map((product) => ({
    title: product.product_title ?? product.productTitle ?? "AliExpress product",
    price: product.sale_price ?? product.salePrice ?? "",
    currency: product.sale_price_currency ?? product.salePriceCurrency ?? "USD",
    image: product.product_main_image_url ?? product.productMainImageUrl ?? "",
    link: product.promotion_link ?? product.promotionLink ?? product.product_detail_url ?? product.productDetailUrl ?? "",
    commission: product.commission_rate ?? product.commissionRate ?? "",
  }));
}

function formatProducts(products, keyword) {
  if (!products.length) {
    return `לא נמצאו מוצרים עבור "${keyword}". נסה מילות חיפוש באנגלית, למשל: party lights או LED balloons.`;
  }

  const lines = [`🎉 מצאתי ${products.length} מוצרים עבור "${keyword}":`];
  for (const [index, product] of products.entries()) {
    lines.push("");
    lines.push(`${index + 1}. ${product.title}`);
    if (product.price) lines.push(`💰 מחיר: ${product.price} ${product.currency}`);
    if (product.commission) lines.push(`💸 עמלה: ${product.commission}`);
    if (product.link) lines.push(`🛒 ${product.link}`);
    if (product.image) lines.push(`🖼 ${product.image}`);
  }
  return lines.join("\n").slice(0, 3900);
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token || !webhookSecret) {
    return json(503, {
      ok: false,
      error: "Telegram bot configuration is incomplete",
    });
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (receivedSecret !== webhookSecret) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  if (!chatId || !text || !text.startsWith("/")) {
    return json(200, { ok: true, ignored: true });
  }

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();
  let reply;

  switch (command) {
    case "/start":
      reply =
        "🎉 ברוכים הבאים ל־PartyZone Deals!\n\n" +
        "כאן נשתף אביזרים למסיבות, תאורה, קישוטים ומציאות מעניינות מ־AliExpress.\n\n" +
        "פקודות זמינות:\n/search party lights – חיפוש מוצרים\n/status – בדיקת מצב הבוט\n/help – הצגת העזרה";
      break;
    case "/help":
      reply =
        "פקודות זמינות:\n" +
        "/search מילות חיפוש – חיפוש עד 5 מוצרים ב־AliExpress\n" +
        "/start – התחלת שימוש\n" +
        "/status – בדיקת מצב הבוט\n" +
        "/help – הצגת העזרה\n\n" +
        "מומלץ לחפש באנגלית, למשל: party decorations, LED lights, glow sticks.";
      break;
    case "/status":
      reply =
        "🟢 שירות הבוט פעיל ומקבל פקודות.\n" +
        (process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET
          ? "🟢 פרטי חיבור AliExpress מוגדרים בשרת.\n"
          : "🟡 חסרים פרטי חיבור AliExpress בשרת.\n") +
        "כדי לבדוק חיפוש אמיתי, שלח /search party lights";
      break;
    case "/search": {
      const keyword = args.join(" ").trim();
      if (!keyword) {
        reply = "כדי לחפש מוצרים, שלח לדוגמה:\n/search party lights";
        break;
      }
      if (keyword.length > 80) {
        reply = "מילת החיפוש ארוכה מדי. נסה עד 80 תווים.";
        break;
      }
      try {
        const products = await queryAliExpressProducts(keyword);
        reply = formatProducts(products, keyword);
      } catch (error) {
        // Do not expose credentials, signatures, or raw provider responses in Telegram.
        const message = error instanceof Error ? error.message : "";
        console.error("AliExpress product query failed:", message);
        reply =
          "⚠️ החיפוש ב־AliExpress לא הצליח כרגע.\n" +
          "בדוק שההרשאה והפרטים מוגדרים נכון ב־Netlify, ונסה שוב מאוחר יותר.";
      }
      break;
    }
    default:
      reply = "לא זיהיתי את הפקודה. אפשר לשלוח /help כדי לראות את הפקודות הזמינות.";
  }

  try {
    await sendTelegramMessage(token, chatId, reply);
    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false, error: "Could not send Telegram reply" });
  }
};
