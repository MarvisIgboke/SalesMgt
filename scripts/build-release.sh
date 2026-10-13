#!/usr/bin/env bash
#
# Build a production release bundle for cPanel / shared hosting.
#
#   1. Builds the SPA (dist/).
#   2. Installs production-only Composer dependencies.
#   3. Assembles:
#        release/api          -> the Laravel application (upload to ~/salesmgt)
#        release/public_html  -> SPA build + Apache front controller (upload to public_html)
#   4. Zips everything to release.zip.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO}/release"

echo "==> Building frontend (SPA)"
cd "$REPO"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build

echo "==> Installing production PHP dependencies"
cd "${REPO}/backend"
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

echo "==> Assembling release"
rm -rf "$OUT"
mkdir -p "$OUT/api" "$OUT/public_html"

rsync -a \
    --exclude 'node_modules' \
    --exclude 'tests' \
    --exclude '.phpunit.cache' \
    --exclude '.env' \
    "${REPO}/backend/" "${OUT}/api/"

rsync -a "${REPO}/dist/" "${OUT}/public_html/"
cp "${REPO}/deploy/cpanel/webroot/.htaccess"   "${OUT}/public_html/"
cp "${REPO}/deploy/cpanel/webroot/index.php"   "${OUT}/public_html/"
cp "${REPO}/deploy/cpanel/webroot/install.php" "${OUT}/public_html/"
cp "${REPO}/backend/.env.production.example"   "${OUT}/api/.env.example"

echo "==> Zipping"
cd "$OUT"
rm -f "${REPO}/release.zip"
zip -qr "${REPO}/release.zip" .

echo "Done."
echo "  ${OUT}/api          -> ~/salesmgt          (outside public_html)"
echo "  ${OUT}/public_html  -> ~/public_html"
echo "Archive: ${REPO}/release.zip"
