export const dynamic = "force-static";

export function GET(): Response {
  // The Workers adapter may expose its internal localhost origin in
  // Request.url. A relative Location keeps the redirect on the visitor's host.
  return new Response(null, { status: 308, headers: { Location: "/favicon.svg" } });
}
