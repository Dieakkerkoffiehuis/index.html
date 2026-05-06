// Cloudflare Pages Function — proxies Xero OAuth token exchange server-side
// Deployed automatically at https://dieakker.pages.dev/xero-token

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    const authHeader = context.request.headers.get('Authorization');

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (authHeader) headers['Authorization'] = authHeader;

    const xeroResp = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers,
      body,
    });

    const data = await xeroResp.text();
    return new Response(data, {
      status: xeroResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
