#!/bin/bash
cd /c/Users/neals/OneDrive/Desktop/Endcord-Main
git add -A
git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "$(cat <<'EOF'
Ship the current client, Linux installer, and README.

Keep profile sync on one shared list so the API stays within quota, and stop spoofed Nitro from breaking file uploads.
EOF
)"
git status -sb