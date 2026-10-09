#!/bin/bash
# Genera claves RSA para JWT RS256
# Uso: ./generate-rsa-keys.sh [directorio]

set -e

KEY_DIR="${1:-./keys}"
mkdir -p "$KEY_DIR"

echo "🔐 Generando claves RSA para JWT RS256..."

# Private key (PKCS#8)
openssl genpkey -algorithm RSA -out "$KEY_DIR/private.pem" -pkeyopt rsa_keygen_bits:2048

# Public key
openssl rsa -pubout -in "$KEY_DIR/private.pem" -out "$KEY_DIR/public.pem"

# Convertir private key a PKCS#8 (formato estándar)
openssl pkcs8 -topk8 -inform PEM -in "$KEY_DIR/private.pem" -out "$KEY_DIR/private-pkcs8.pem" -nocrypt

# Generar JWK (JSON Web Key) para uso en JWKS endpoint
cat "$KEY_DIR/public.pem" | openssl rsa -pubin -text -noout | head -20

echo ""
echo "✅ Claves generadas en: $KEY_DIR"
echo "   - private.pem (para firmar tokens)"
echo "   - private-pkcs8.pem (formato PKCS#8)"
echo "   - public.pem (para verificar tokens)"
echo ""
echo "📋 Agrega a .env.production:"
echo "   JWT_PRIVATE_KEY=\"$(cat "$KEY_DIR/private-pkcs8.pem" | sed ':a;N;$!ba;s/\n/\\n/g')\""
echo "   JWT_PUBLIC_KEY=\"$(cat "$KEY_DIR/public.pem" | sed ':a;N;$!ba;s/\n/\\n/g')\""