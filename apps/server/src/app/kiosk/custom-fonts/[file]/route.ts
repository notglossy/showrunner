import fs from 'node:fs';

import { customFontPath } from '@/lib/design/fonts';

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<'/kiosk/custom-fonts/[file]'>;

// No auth: devices and the sandboxed preview iframe load fonts without a session.
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const file = customFontPath((await params).file);
  if (!file) return new Response('Not found', { status: 404 });
  try {
    return new Response(new Uint8Array(fs.readFileSync(file)), {
      headers: {
        'content-type': 'font/woff2',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
