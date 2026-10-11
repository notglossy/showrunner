import { parseJson, route } from '@/lib/api/http';
import { UpdateInstructionsRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { getInstructions, resetInstructions, updateInstructions } from '@/lib/design/instructions';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

const MAX_BODY = 250 * 1024;

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json(getInstructions());
});

/** Saves the owner's version of the AI guide. Only AI generation uses it, so no device reload. */
export const PUT = route(async (req) => {
  requireAdmin(req);
  const { text } = await parseJson(req, UpdateInstructionsRequestSchema, MAX_BODY);
  return Response.json(updateInstructions(text));
});

/** Back to the built-in guide. */
export const DELETE = route(async (req) => {
  requireAdmin(req);
  return Response.json(resetInstructions());
});
