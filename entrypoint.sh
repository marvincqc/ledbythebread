#!/bin/sh
# Inject runtime env vars into a JS file loaded by the app
cat > /usr/share/nginx/html/config.js <<EOF
window.__env = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}"
};
EOF
exec nginx -g "daemon off;"
