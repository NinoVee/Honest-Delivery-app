/** Reads the raw request body as a string. Required for HMAC signature verification,
 * since re-serializing a parsed JSON body can produce different bytes than what was signed. */
export function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
