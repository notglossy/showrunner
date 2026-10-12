import { parseJson, route } from '@/lib/api/http';
import { UpdateThemeRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { getTheme, resetTheme, updateTheme } from '@/lib/design/theme';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json(getTheme());
});

/** Body values override the defaults; null clears one. Every device reloads. */
export const PATCH = route(async (req) => {
  requireAdmin(req);
  const patch = await parseJson(req, UpdateThemeRequestSchema);
  return Response.json(updateTheme(patch));
});

/** Back to the default theme. Every device reloads. */
export const DELETE = route(async (req) => {
  requireAdmin(req);
  return Response.json(resetTheme());
});
