export function redirect(path) { throw new Response(null, { status: 303, headers: { location: path } }); }
