# PartyZone Deals

Telegram affiliate bot for party accessories from AliExpress.

## Automatic publishing

The Netlify scheduled function searches party-related AliExpress categories and publishes three new products when five hours have elapsed since the previous successful post. It checks every 15 minutes, so a post can be delayed by up to 15 minutes. If fewer than three new relevant products are found, it skips that run rather than reposting products.

## AI product descriptions

For each product, the bot requests available product metadata from the AliExpress affiliate product-details API, then uses the OpenAI Responses API to write a short, natural Hebrew marketing description. The prompt requires the description to stay grounded in the supplied title and metadata and forbids invented product specifications or promises.

Add the following environment variable in Netlify:

- `OPENAI_API_KEY`: an OpenAI API key with API billing enabled.

Optional:

- `OPENAI_MODEL`: model override. Defaults to `gpt-6-astra`.

If the OpenAI key is missing or the AI request fails, the bot falls back to its existing rule-based Hebrew description so publishing can continue.

Keep all API keys in Netlify environment variables. Do not commit secrets to the repository.
