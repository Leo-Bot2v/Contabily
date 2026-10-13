/**
 * Codificación del parámetro `state` que viaja de ida y vuelta por Google.
 *
 * `mode` decide qué hace el backend cuando el navegador vuelve del consentimiento:
 *
 *  - `redirect`: 302 a FRONTEND_URL/auth/callback con el `code`. Es el contrato
 *    con el frontend (B): la página canjea el código con
 *    POST /auth/google/callback y recibe { user, tokens }.
 *
 *  - `json`: canjear el código aquí mismo y devolver { user, tokens } en la
 *    respuesta. Para probar el flujo sin frontend desde Swagger o curl.
 *
 * Se usa base64url y no base64 porque el estado viaja en la query string: el
 * `+` del base64 normal se interpreta como espacio y el estado llega corrupto.
 * La lectura es tolerante para poder aceptar también estados antiguos.
 */

export type ModoCallbackGoogle = 'json' | 'redirect';

export function codificarEstadoGoogle(modo: ModoCallbackGoogle): string {
  return Buffer.from(JSON.stringify({ provider: 'google', mode: modo }), 'utf8').toString(
    'base64url',
  );
}

/**
 * Lee el modo del `state`. El valor viene del navegador y no es fiable, así que
 * cualquier cosa que no se pueda leer cae en `redirect`, el modo conservador
 * que ya usaba el código antes de existir esta distinción.
 */
export function leerModoCallbackGoogle(estado: unknown): ModoCallbackGoogle {
  if (typeof estado !== 'string' || estado.length === 0) {
    return 'redirect';
  }

  try {
    const normalizado = estado
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/ /g, '+');
    const json: unknown = JSON.parse(Buffer.from(normalizado, 'base64').toString('utf8'));

    if (json && typeof json === 'object' && 'mode' in json) {
      return (json as { mode?: unknown }).mode === 'json' ? 'json' : 'redirect';
    }
  } catch {
    // Estado corrupto o manipulado: se ignora y se usa el modo por defecto.
  }

  return 'redirect';
}
