const FASHN_API = "https://api.fashn.ai";
const MAX_DATA_URI_LENGTH = 28 * 1024 * 1024;
const MAX_BODY_LENGTH = 56 * 1024 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://warmachine999.github.io")
    .split(",").map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-app-access-code",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || !!allowedOrigin(request, env);
}

function requireAccess(request, env) {
  const expected = env.APP_ACCESS_CODE || "";
  const received = request.headers.get("x-app-access-code") || "";
  return !!expected && received.length === expected.length && received === expected;
}

function validModelImage(value) {
  return typeof value === "string" &&
    value.length <= MAX_DATA_URI_LENGTH &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

function validProductImage(value) {
  if (typeof value !== "string") return false;
  if (value.length <= MAX_DATA_URI_LENGTH &&
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "cdn11.bigcommerce.com",
      "images.teamshirts.net",
      "kuchupuchu.store",
      "www.miteckenundkanten.com",
      "miteckenundkanten.com",
      "daanmmausa.com",
      "i00.eu",
      "image.hm.com",
      "ecimg.cafe24img.com",
      "i5.walmartimages.com",
      "i5.walmartimages.cl",
      "s.yimg.com"
    ]);
    return url.protocol === "https:" && allowedHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return json({ ok: false, message: "Not found." }, 404, cors);
    if (!isAllowedOrigin(request, env)) return json({ ok: false, message: "Origin not allowed." }, 403, cors);

    if (url.pathname === "/api/health" && request.method === "GET") {
      if (!requireAccess(request, env)) return json({ ok: false, message: "Incorrect access code or Worker secret not configured." }, 401, cors);
      const ready = !!env.FASHN_API_KEY;
      return json({ ok: ready, message: ready ? "AI Worker is connected." : "FASHN_API_KEY secret is missing." }, ready ? 200 : 503, cors);
    }

    if (!requireAccess(request, env)) return json({ message: "Access denied. Check the private app code." }, 401, cors);
    if (!env.FASHN_API_KEY) return json({ message: "The Worker is missing its FASHN_API_KEY secret." }, 503, cors);

    if (url.pathname === "/api/tryon" && request.method === "POST") {
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength && contentLength > MAX_BODY_LENGTH) return json({ message: "The selected images are too large. Try smaller photos." }, 413, cors);

      let body;
      try { body = await request.json(); }
      catch { return json({ message: "Invalid request body." }, 400, cors); }

      if (!validModelImage(body.modelImage) || !validProductImage(body.productImage)) {
        return json({ message: "The person photo or selected clothing image is invalid." }, 400, cors);
      }

      const allowedFits = ["natural fit", "relaxed fit", "oversized fit", "slim fit"];
      const category = String(body.category || "clothing item").slice(0, 60);
      const fit = allowedFits.includes(body.fit) ? body.fit : "natural fit";
      const allowedStyles = ["Casual", "Sport", "Streetwear", "Smart casual", "Formal", "Techwear"];
      const style = allowedStyles.includes(body.style) ? body.style : "Casual";
      const prompt = "Apply the exact uploaded " + category +
        " naturally to the person. Aim for a " + fit +
        " and a " + style + " styling direction. Preserve the person's identity, face, pose, proportions, and original photo setting. Reproduce the garment shown in the product image, including its color, shape, fabric, seams, and visible design. Do not substitute a different garment. Keep other clothing unchanged.";

      const upstream = await fetch(FASHN_API + "/v1/run", {
        method: "POST",
        headers: {
          "authorization": "Bearer " + env.FASHN_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model_name: "tryon-max",
          inputs: {
            model_image: body.modelImage,
            product_image: body.productImage,
            prompt,
            resolution: "1k",
            generation_mode: "fast",
            output_format: "jpeg",
            return_base64: true,
            num_images: 1
          }
        })
      });

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        return json({ message: data.message || data.error || "FASHN could not start the generation." }, upstream.status, cors);
      }
      if (!data.id) return json({ message: "FASHN did not return a prediction ID." }, 502, cors);
      return json({ id: data.id }, 200, cors);
    }

    if (url.pathname === "/api/status" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      if (!/^[A-Za-z0-9_-]{8,140}$/.test(id)) return json({ message: "Invalid prediction ID." }, 400, cors);

      const upstream = await fetch(FASHN_API + "/v1/status/" + encodeURIComponent(id), {
        headers: { "authorization": "Bearer " + env.FASHN_API_KEY }
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json({ message: data.message || data.error || "Could not retrieve generation status." }, upstream.status, cors);
      return json({
        id: data.id,
        status: data.status,
        output: data.output || null,
        error: data.error || null
      }, 200, cors);
    }

    return json({ message: "Route not found." }, 404, cors);
  }
};