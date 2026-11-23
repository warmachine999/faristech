# FitLab — Virtual Outfit Studio

A static GitHub Pages frontend plus a Cloudflare Worker proxy for FASHN Try-On Max.

## Live page

https://warmachine999.github.io/faristech/virtual-tryon/

## Features

- Upload a full-body photo and a photo of one garment or accessory.
- Choose a type: top, pants, one-piece, jacket, hat/cap, shoes, bag, or accessory.
- Select a fit preference and request an AI try-on.
- View and save the generated result.
- Images are resized in the browser. The site does not write them to GitHub or its own storage.
- AI is disabled until a private Worker URL and access code are configured.

## Important: AI uses a paid external service

The app uses FASHN Try-On Max because its endpoint supports clothing, shoes, hats, jewelry, bags, and other wearable items. The app requests one fast 1K output and uses base64 inputs and output to reduce image retention.

FASHN currently lists 1 credit for a fast 1K Try-On Max generation and $0.075 per credit, with a minimum API top-up of $7.50. Prices and model behavior can change. An adult should manage the FASHN account, API key, billing, and approval before a minor uses a paid external AI service.

FASHN's data policy says:
- Base64 input images are used only for processing and their temporary processing copies are deleted when the request finishes, with a one-day automatic cleanup backstop.
- Request records are retained and include parameters and base64 placeholders, not the image bytes.
- Base64 outputs can be retrieved for 60 minutes after completion.
- FASHN says customer content is not used to train its models unless the customer expressly opts in.

Read the FASHN data policy:
https://docs.fashn.ai/api-overview/data-retention-privacy

API endpoint and pricing:
https://docs.fashn.ai/api-reference/tryon-max
https://help.fashn.ai/plans-and-pricing/api-pricing

## Deploy the AI Worker

The GitHub Pages frontend can be viewed without this setup. Real AI generation needs a Cloudflare Worker and an adult-managed FASHN API key.

1. Open a terminal with Node.js and Wrangler installed.
2. Go to this folder in the repository: virtual-tryon
3. Log in to Cloudflare with: npx wrangler login
4. Set the FASHN API key as a Worker secret. Do not put it in this repository:
   npx wrangler secret put FASHN_API_KEY
5. Create a long, private app access code and store it as a second Worker secret:
   npx wrangler secret put APP_ACCESS_CODE
6. Deploy with: npx wrangler deploy
7. Copy the Worker URL shown by Wrangler. It will look like:
   https://fitlab-virtual-tryon.your-subdomain.workers.dev
8. Open the live GitHub Pages app. Expand AI connection settings, paste the Worker URL and the same private app access code, then press Save & test connection.

The Worker only accepts browser requests from https://warmachine999.github.io. If you use a custom domain, update ALLOWED_ORIGINS in wrangler.toml and redeploy.

## Security notes

- Never add FASHN_API_KEY to index.html, JavaScript, GitHub files, or a screenshot.
- Keep APP_ACCESS_CODE private. It protects your Worker from casual use by visitors who discover its public URL.
- Do not share the access code.
- Only upload photos you own or have permission to use.
- A personal photo is sent to FASHN only after the user confirms and presses Generate AI try-on.
- This is a visual style preview, not a guarantee of clothing size, measurements, or real-world fit.

## Files

- index.html — GitHub Pages frontend.
- worker.js — secure FASHN API proxy.
- wrangler.toml — Worker deployment configuration.
