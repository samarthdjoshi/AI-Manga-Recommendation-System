/**
 * Vercel Edge Middleware - Security & SSRF Protection
 * Blocks any attempt to abuse URL query parameters for Server-Side Request Forgery.
 */

const BLOCKED_IP_REGEX = /^(https?:\/\/)?(127\.|localhost|0\.0\.0\.0|::1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|metadata\.google\.internal)/i;
const DISALLOWED_SCHEMES = /^(file|gopher|ftp|tftp|ldap|dict|data|javascript):/i;

export default function middleware(request) {
  const url = new URL(request.url);
  const targetParam = url.searchParams.get("url") || url.searchParams.get("target") || url.searchParams.get("dest");

  if (targetParam !== null) {
    const trimmed = targetParam.trim().toLowerCase();
    // Reject internal/loopback/cloud metadata/private IP addresses or dangerous protocols
    if (
      BLOCKED_IP_REGEX.test(trimmed) ||
      DISALLOWED_SCHEMES.test(trimmed) ||
      trimmed.includes("127.0.0.1") ||
      trimmed.includes("localhost") ||
      trimmed.includes("169.254.169.254") ||
      trimmed.includes("0.0.0.0") ||
      trimmed.includes("[::1]")
    ) {
      return new Response(
        JSON.stringify({
          error: "SSRF Protection: Unsafe URL parameter target rejected",
          status: 400,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        }
      );
    }
  }
}
