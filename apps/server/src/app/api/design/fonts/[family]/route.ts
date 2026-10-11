import { route } from '@/lib/api/http';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteCustomFont } from '@/lib/design/fonts';

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<'/api/design/fonts/[family]'>;

export const DELETE = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  // Next already decodes dynamic params; decoding again is harmless for names that pass validation.
  deleteCustomFont((await params).family);
  return new Response(null, { status: 204 });
});
