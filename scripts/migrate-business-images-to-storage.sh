#!/usr/bin/env bash
# Migração única: sobe as imagens estáticas de src/assets/businesses/ pro
# bucket business-photos do Supabase Storage e grava a URL pública em
# businesses.cover_image. Depois de rodar para todos os negócios, os
# arquivos estáticos e o fallback em src/data/businesses.js podem ser
# removidos com segurança. Idempotente: pular objetos já enviados.
set -uo pipefail

cd "$(dirname "$0")/.."

PROJECT_URL="https://npdmzqpennwbrkschuwu.supabase.co"
ASSETS_DIR="src/assets/businesses"
BUCKET="business-photos"

rows=$(npx --no-install supabase db query --linked \
  "select id, slug from public.businesses order by slug;" \
  --output-format json 2>/dev/null)

echo "$rows" | jq -c '.rows[]' | while read -r row; do
  id=$(echo "$row" | jq -r '.id')
  slug=$(echo "$row" | jq -r '.slug')
  file="$ASSETS_DIR/$slug.webp"

  if [ ! -f "$file" ]; then
    echo "SKIP (sem arquivo local): $slug"
    continue
  fi

  upload_output=$(npx --no-install supabase storage cp "$file" "ss:///$BUCKET/$id/cover.webp" \
    --linked --experimental --content-type image/webp --cache-control 31536000 2>&1)
  upload_status=$?

  if [ $upload_status -ne 0 ] && ! echo "$upload_output" | grep -q "KeyAlreadyExists"; then
    echo "FALHOU $slug: $upload_output"
    continue
  fi

  url="$PROJECT_URL/storage/v1/object/public/$BUCKET/$id/cover.webp"
  npx --no-install supabase db query --linked \
    "update public.businesses set cover_image = '$url' where id = '$id';" \
    > /dev/null 2>&1

  echo "OK: $slug -> $url"
done

echo "Migração concluída."
