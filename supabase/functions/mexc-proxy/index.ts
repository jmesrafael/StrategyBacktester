// mexc-proxy — forwards public MEXC futures market data to the browser with CORS
// headers (contract.mexc.com sends none). Lets the app load MEXC ".P" charts when it
// isn't served by the local dev server. Deploy:
//   supabase functions deploy mexc-proxy --no-verify-jwt
// Called as  <SUPA.url>/functions/v1/mexc-proxy/api/v1/contract/kline/SOL_USDT?interval=Min60&start=..&end=..

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const ALLOWED = /^\/api\/v1\/contract\/(kline\/[A-Z0-9_]+|detail)$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*\/mexc-proxy/, "");
  if (req.method !== "GET" || !ALLOWED.test(sub)) {
    return new Response('{"success":false}', { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  try {
    const r = await fetch(`https://contract.mexc.com${sub}${url.search}`);
    return new Response(await r.text(), { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch {
    return new Response('{"success":false,"message":"MEXC unreachable"}', { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
