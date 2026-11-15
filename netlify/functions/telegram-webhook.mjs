import { createHash } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";
const ALIEXPRESS_API = "https://api-sg.aliexpress.com/sync";

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function sendTelegramMessage(token, chatId, text, replyMarkup) {
  const payload = { chat_id: chatId, text, disable_web_page_preview: true };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error("Telegram sendMessage request failed");
}

async function sendTelegramPhoto(token, chatId, photoUrl, caption, replyMarkup) {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, reply_markup: replyMarkup }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error("Telegram sendPhoto request failed");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function productDescription(title, details = {}) {
  const value = String(title || "").toLowerCase();
  const category = String(details.first_level_category_name || "").toLowerCase();
  const rules = [
    [/\b(moving head|beam light)\b/, "ראש תאורה מסתובב שמקרין אלומות אור ומשנה את כיוונן ברחבת הריקודים."],
    [/\b(laser projector|laser light|rgb laser)\b/, "מקרן לייזר שיוצר נקודות וקווים צבעוניים על הקירות והתקרה לאפקט מועדון."],
    [/\b(disco ball|mirror ball)\b/, "כדור מראות שמחזיר את האור לנקודות מנצנצות ברחבי החדר."],
    [/\b(strobe|flash light)\b/, "תאורת סטרוב שמבזיקה בקצב ויוצרת אפקטים של הבזקי אור ברחבת הריקודים."],
    [/\b(par light|stage wash|stage lighting)\b/, "פנס במה שמאיר אזור שלם בצבע ומשמש להדגשת רחבת הריקודים או עמדת הדי־ג׳יי."],
    [/\b(led strip|led tape|light strip)\b/, "פס תאורת LED שאפשר להצמיד לאורך קירות, שולחנות או עמדת DJ כדי להוסיף תאורה צבעונית."],
    [/\b(led curtain|curtain lights|fairy curtain)\b/, "שרשרת אורות בצורת וילון שמתאימה לתלייה כרקע מואר מאחורי שולחן או עמדת צילום."],
    [/\b(string lights|fairy lights)\b/, "שרשרת נורות לתלייה מסביב למתחם, מעל שולחנות או לאורך קירות ליצירת תאורת אווירה."],
    [/\b(neon sign|neon light)\b/, "שלט ניאון מואר שאפשר לתלות כרקע דקורטיבי או לצד עמדת הצילום."],
    [/\b(fog machine|smoke machine)\b/, "מכונת עשן שמפזרת ערפל באוויר כדי להבליט את קרני התאורה ברחבת הריקודים."],
    [/\b(bubble machine|bubble maker)\b/, "מכונת בועות שמפזרת בועות סבון ברחבה ומתאימה למסיבות ולאירועים."],
    [/\b(confetti cannon|confetti launcher)\b/, "משגר קונפטי לפיזור פתיתי נייר צבעוניים ברגעי שיא, כמו כניסת אורחים או ספירה לאחור."],
    [/\b(confetti|table scatter)\b/, "קונפטי לפיזור על שולחנות או באוויר כדי להוסיף צבע וקישוט לרגעי השיא במסיבה."],
    [/\b(balloon arch|balloon garland|balloon kit)\b/, "ערכת בלונים להרכבת קשת או זר בלונים, שמתאימה לעיצוב הכניסה או קיר צילום."],
    [/\b(foil fringe|tinsel curtain|metallic fringe)\b/, "וילון פרנזים מטאלי לתלייה על הקיר כרקע נוצץ לעמדת צילום או לשולחן המרכזי."],
    [/\b(photo backdrop|backdrop|photo booth background)\b/, "רקע דקורטיבי שאפשר לתלות מאחורי האורחים ליצירת פינת צילום במסיבה."],
    [/\b(photo booth props|photo props)\b/, "אביזרי צילום שאורחים יכולים להחזיק בתמונות, כמו שלטים ואביזרים מצחיקים."],
    [/\b(party glasses|led glasses|neon glasses)\b/, "משקפיים צבעוניים או מוארים שהאורחים יכולים להרכיב כאביזר למסיבה ולצילומים."],
    [/\b(glow stick|glow sticks)\b/, "מקלות זוהרים שאפשר לחלק לאורחים ולנופף איתם ברחבת הריקודים."],
    [/\b(glow bracelet|led bracelet|light up bracelet)\b/, "צמידים זוהרים לחלוקה לאורחים, שיוצרים נקודות אור צבעוניות בזמן הריקודים."],
    [/\b(party hat|birthday hat)\b/, "כובעי מסיבה לחלוקה לאורחים ולהוספת אביזר חגיגי לתמונות ולאירוע."],
    [/\b(party mask|masquerade mask)\b/, "מסכות לבישה שמתאימות למסיבת תחפושות, נשף או פינת צילום."],
    [/\b(banner|happy birthday sign|letter banner)\b/, "שלט או שרשרת דגלונים לתלייה על הקיר כרקע חגיגי למסיבה."],
    [/\b(party tablecloth|table cover)\b/, "כיסוי שולחן דקורטיבי שמוסיף צבע לעיצוב שולחן הכיבוד או שולחן יום ההולדת."],
    [/\b(paper plates|disposable plates)\b/, "צלחות חד־פעמיות להגשת אוכל וכיבוד באירוח ובמסיבה."],
    [/\b(paper cups|disposable cups)\b/, "כוסות חד־פעמיות להגשת שתייה לאורחים במהלך האירוע."],
    [/\b(cake topper)\b/, "קישוט שמניחים על גבי העוגה כדי להתאים אותה לנושא החגיגה."],
    [/\b(birthday candles|cake candles)\b/, "נרות לעוגת יום הולדת, להדלקה בזמן שירת יום ההולדת וכיבוי הנרות."],
    [/\b(pinata|piñata)\b/, "פיניאטה לתלייה ולמשחק שבו המשתתפים מנסים לשבור אותה כדי לשחרר את התכולה."],
    [/\b(party popper)\b/, "קונפטי קופץ להפעלה ברגע חגיגי כמו הרמת כוסית, כניסה או ספירה לאחור."],
    [/\b(dj controller stand|dj table|dj booth)\b/, "אביזר לעמדת DJ שמיועד לארגון והצבה של ציוד העמדה במהלך האירוע."],
  ];
  for (const [pattern, description] of rules) {
    if (pattern.test(value)) return description;
  }
  const categoryRules = [
    [/light|lighting|lamp/, "תאורת אווירה למסיבה, המתאימה להוספת אור צבעוני לאזור האירוע."],
    [/balloon/, "בלונים לקישוט המתחם, שולחן החגיגה או אזור הצילום."],
    [/decoration|decor/, "קישוט למסיבה שמיועד לעיצוב חלל האירוע ולהתאמתו לאווירת החגיגה."],
    [/tableware|kitchen|dining/, "אביזר להגשה ולאירוח, המתאים לשולחן הכיבוד במסיבה."],
    [/costume|clothing|accessor/, "אביזר לביש שמשתלב בתחפושת או בלוק של האורחים במסיבה."],
  ];
  for (const [pattern, description] of categoryRules) {
    if (pattern.test(category)) return description;
  }
  return "אביזר למסיבה. מומלץ לבדוק בתמונות המוצר את צורתו ואת אופן השימוש לפני ההזמנה.";
}
function isPartyRelevant(title) {
  const value = title.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const strongTerms = [
    "party", "disco", "dj", "rave", "nightclub", "night club", "club",
    "birthday", "balloon", "confetti", "streamer", "party decoration",
    "party decor", "party supplies", "party favor", "wedding decor",
    "event decor", "photo booth", "photobooth", "glow stick", "glowstick",
    "glow", "neon", "strobe", "laser", "stage light", "party light",
    "cake topper", "pinata", "piñata", "party hat", "party glasses",
    "masquerade", "foil fringe", "bubble machine", "smoke machine",
    "fog machine", "confetti cannon", "led curtain", "led disco",
    "fairy light", "string light"
  ];
  return strongTerms.some((term) => value.includes(term));
}

function formatShekelPrice(value) {
  const amount = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(amount);
}

async function convertProductPricesToILS(products) {
  const needsUsdRate = products.some((p) => String(p.currency || "").toUpperCase() === "USD");
  let usdToIls = null;
  if (needsUsdRate) {
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: AbortSignal.timeout(7000),
      });
      const data = await response.json();
      const rate = Number(data?.rates?.ILS);
      if (response.ok && data?.result === "success" && Number.isFinite(rate) && rate > 0) {
        usdToIls = rate;
      }
    } catch (error) {
      console.warn("Could not retrieve USD/ILS exchange rate:", error?.message ?? "unknown error");
    }
  }

  return products.map((product) => {
    const currency = String(product.currency || "").toUpperCase();
    const amount = Number(String(product.price ?? "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return { ...product, priceILS: null };
    if (currency === "ILS") return { ...product, priceILS: amount };
    if (currency === "USD" && usdToIls) return { ...product, priceILS: amount * usdToIls };
    return { ...product, priceILS: null };
  });
}

function productCaption(product) {
  const lines = [product.title, product.description];
  const price = formatShekelPrice(product.priceILS);
  if (price) lines.push(`💰 מחיר: ${price}`);
  return lines.join("\n\n").slice(0, 1000);
}

async function queryAliExpressProductDetails(products) {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID;
  const ids = products.map((product) => product.id).filter(Boolean);
  if (!appKey || !appSecret || !trackingId || !ids.length) return new Map();

  const params = {
    app_key: appKey,
    method: "aliexpress.affiliate.productdetail.get",
    sign_method: "md5",
    timestamp: aliExpressTimestamp(),
    v: "2.0",
    format: "json",
    product_ids: ids.join(","),
    target_currency: "USD",
    target_language: "EN",
    tracking_id: trackingId,
    country: "IL",
    fields: [
      "product_id", "product_title", "first_level_category_name",
      "second_level_category_name", "evaluate_rate", "lastest_volume",
      "product_video_url", "shop_url", "product_detail_url",
    ].join(","),
  };
  params.sign = aliExpressSignature(params, appSecret);

  const response = await fetch(ALIEXPRESS_API, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("AliExpress product detail request failed");
  const data = await response.json().catch(() => null);
  const apiResponse = data?.aliexpress_affiliate_productdetail_get_response ?? data?.aliexpressAffiliateProductdetailGetResponse ?? data;
  if (!data || apiResponse?.error_response || apiResponse?.error) throw new Error("AliExpress product details unavailable");

  const result = apiResponse?.resp_result ?? apiResponse?.respResult ?? apiResponse;
  const container = result?.result?.products ?? result?.products;
  const items = Array.isArray(container)
    ? container
    : container?.product
      ? (Array.isArray(container.product) ? container.product : [container.product])
      : [];
  return new Map(items.map((item) => [String(item.product_id ?? item.productId ?? ""), item]));
}

function extractResponseText(response) {
  if (typeof response?.output_text === "string") return response.output_text.trim();
  const parts = [];
  for (const item of response?.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("\n").trim();
}

async function writeSmartProductDescription(product, details = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured; refusing to publish without an AI description");

  const context = {
    product_title: product.title,
    category: [details.first_level_category_name, details.second_level_category_name].filter(Boolean).join(" > "),
    popularity_signal: product.popularity || details.lastest_volume || "",
    rating: product.rating || details.evaluate_rate || "",
  };

  const instructions =
    "אתה קופירייטר מסחרי דובר עברית שמתמחה במוצרי מסיבות. כתוב תיאור שיווקי קצר, טבעי ומדויק בעברית בלבד, 1–2 משפטים ועד 220 תווים. " +
    "הסבר מה המוצר, איך משתמשים בו בפועל ובאיזה חלק של המסיבה הוא משתלב, על סמך שם המוצר והקטגוריה. " +
    "תרגם מונחים באנגלית לעברית ואל תשאיר תיאור באנגלית. מותר להסביר שימוש מקובל וברור שנובע ישירות מסוג המוצר. " +
    "אסור להמציא חומר, מידות, עוצמה, כמות, עמידות, תכולת אריזה, תכונות טכניות או הבטחות שלא מופיעות במידע. " +
    "אל תכתוב מידע על דירוג או מכירות. אל תכתוב משפטים ריקים כמו 'פרטי תיאור אינם זמינים' או 'ישדרג את המסיבה'. " +
    "אם השם עמום, תאר בזהירות מה ניתן לזהות ממנו והסבר שימוש כללי בלי להוסיף מפרט. החזר רק את התיאור בעברית.";

  let lastError;
  for (const model of [process.env.OPENAI_MODEL || "gpt-6-luna", "gpt-6.1-terra"]) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions,
          input: JSON.stringify(context),
          max_output_tokens: 160,
        }),
        signal: AbortSignal.timeout(18000),
      });
      if (response.status === 429) {
        console.warn("OpenAI rate/quota limit reached; using a title-based Hebrew fallback.");
        return productDescription(product.title, details);
      }
      if (!response.ok) throw new Error(`OpenAI description request failed: ${response.status}`);
      const data = await response.json();
      const description = extractResponseText(data).replace(/^[\"'״]+|[\"'״]+$/g, "").trim();
      if (!description || description.length > 320 || !/[\u0590-\u05FF]/.test(description)) {
        throw new Error("AI did not return a valid Hebrew description");
      }
      return description;
    } catch (error) {
      lastError = error;
      console.warn(`AI description attempt failed (${model}):`, error?.message ?? "unknown error");
    }
  }
  throw new Error(`Could not generate a Hebrew AI description: ${lastError?.message ?? "unknown error"}`);
}

async function enrichProductDescriptions(products) {
  let detailMap = new Map();
  try {
    detailMap = await queryAliExpressProductDetails(products);
  } catch (error) {
    console.warn("AliExpress detail enrichment unavailable:", error?.message ?? "unknown error");
  }
  const pricedProducts = await convertProductPricesToILS(products);
  const productsWithPrice = pricedProducts.filter((product) =>
    Number.isFinite(product.priceILS) && product.priceILS > 0
  );
  if (!productsWithPrice.length) {
    throw new Error("AliExpress did not return a usable ILS or USD price; refusing to publish products without a shekel price");
  }
  return Promise.all(productsWithPrice.map(async (product) => ({
    ...product,
    description: await writeSmartProductDescription(product, detailMap.get(String(product.id)) ?? {}),
  })));
}

async function sendTelegramProductResults(token, chatId, products, keyword) {
  products = await enrichProductDescriptions(products);
  await sendTelegramMessage(token, chatId, `🎉 נמצאו ${products.length} מוצרים עבור "${keyword}":\n\nהנה המוצרים שמצאתי:`);
  for (const product of products) {
    const link = safeHttpUrl(product.link);
    const image = safeHttpUrl(product.image);
    const keyboard = link ? { inline_keyboard: [[{ text: "🛍️ לצפייה במוצר", url: link }]] } : undefined;
    const caption = productCaption(product);
    if (image) {
      try {
        await sendTelegramPhoto(token, chatId, image, caption, keyboard);
        continue;
      } catch {
        console.warn("Telegram photo delivery failed; using a text product card.");
      }
    }
    await sendTelegramMessage(token, chatId, caption, keyboard);
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

async function queryAliExpressProducts(keyword, { pageNo = 1, pageSize = 50 } = {}) {
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
    page_no: String(pageNo),
    page_size: String(pageSize),
    target_currency: "USD",
    target_language: "EN",
    ship_to_country: "IL",
    sort: "LAST_VOLUME_DESC",
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
      "lastest_volume",
      "evaluate_rate",
      "target_sale_price",
      "target_sale_price_currency",
    ].join(","),
  };

  params.sign = aliExpressSignature(params, appSecret);

  const body = new URLSearchParams(params);
  const response = await fetch(ALIEXPRESS_API, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    signal: AbortSignal.timeout(10000),
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

  const normalizedProducts = products
    .map((product) => ({
      id: String(product.product_id ?? product.productId ?? ""),
      title: product.product_title ?? product.productTitle ?? "AliExpress product",
      price: product.target_sale_price ?? product.targetSalePrice ?? product.sale_price ?? product.salePrice ?? "",
      currency: product.target_sale_price_currency ?? product.targetSalePriceCurrency ?? product.sale_price_currency ?? product.salePriceCurrency ?? "",
      image: product.product_main_image_url ?? product.productMainImageUrl ?? "",
      link: product.promotion_link ?? product.promotionLink ?? product.product_detail_url ?? product.productDetailUrl ?? "",
      commission: product.commission_rate ?? product.commissionRate ?? "",
      popularity: Number(product.lastest_volume ?? product.lastestVolume ?? 0) || 0,
      rating: product.evaluate_rate ?? product.evaluateRate ?? "",
    }))
    .filter((product) => product.id && isPartyRelevant(product.title))
    .sort((a, b) => b.popularity - a.popularity);
  const seenIds = new Set();
  return normalizedProducts.filter((product) => {
    if (!product.id || seenIds.has(product.id)) return false;
    seenIds.add(product.id);
    return true;
  });
}

function formatNoProducts(keyword) {
  return `לא נמצאו מוצרים עבור "${keyword}". נסה מילות חיפוש באנגלית, למשל: party lights או LED balloons.`;
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
        const products = (await queryAliExpressProducts(keyword)).slice(0, 5);
        if (products.length) {
          await sendTelegramProductResults(token, chatId, products, keyword);
          reply = null;
        } else {
          reply = formatNoProducts(keyword);
        }
      } catch (error) {
        // Do not expose credentials, signatures, or raw provider responses in Telegram.
        const message = error instanceof Error ? error.message : "";
        console.error("AliExpress product query failed:", message);
        const safeDiagnostic = String(message || "unknown error")
          .replace(/(app_secret|app_key|access_token|refresh_token|sign)\s*[:=]\s*[^\s,;]+/gi, "$1=[hidden]")
          .replace(/[\r\n]+/g, " ")
          .slice(0, 180);
        reply =
          "⚠️ החיפוש נכשל. סיבת התקלה: " + safeDiagnostic +
          "\nשלח לי את ההודעה הזו כדי שאוכל לתקן.";
      }
      break;
    }
    default:
      reply = "לא זיהיתי את הפקודה. אפשר לשלוח /help כדי לראות את הפקודות הזמינות.";
  }

  try {
    if (reply) await sendTelegramMessage(token, chatId, reply);
    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false, error: "Could not send Telegram reply" });
  }
};


export { queryAliExpressProducts, sendTelegramProductResults };
