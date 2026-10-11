import { parseJson, route } from '@/lib/api/http';
import { AddFontRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { addGoogleFont, listCustomFonts } from '@/lib/design/fonts';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json({ fonts: listCustomFonts() });
});

export const POST = route(async (req) => {
  requireAdmin(req);
  const { family } = await parseJson(req, AddFontRequestSchema);
  return Response.json({ font: await addGoogleFont(family) }, { status: 201 });
});
