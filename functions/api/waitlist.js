// Cloudflare Pages Function: stores waitlist signups in a KV namespace.
// Setup: create a KV namespace and bind it to this Pages project as "WAITLIST"
// (Dashboard -> Workers & Pages -> project -> Settings -> Bindings).
// Without the binding the endpoint responds 503 and the landing page shows
// a "not live yet" message.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const email = String(payload?.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return json({ error: "invalid_email" }, 400);
  }

  if (!env.WAITLIST) {
    return json({ error: "not_configured" }, 503);
  }

  const key = `signup:${email}`;
  const existing = await env.WAITLIST.get(key);
  if (!existing) {
    await env.WAITLIST.put(
      key,
      JSON.stringify({
        email,
        locale: typeof payload?.locale === "string" ? payload.locale.slice(0, 8) : "",
        at: new Date().toISOString(),
      }),
    );
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
