#!/bin/sh
# usage: fetch.sh <outfile> <query>
out=$1; q=$2; wait=10
for i in 1 2 3 4 5 6; do
  for ep in https://maps.mail.ru/osm/tools/overpass/api/interpreter https://overpass-api.de/api/interpreter; do
    curl -sS -m 200 -A "KhetKundli-hackathon/0.1" --data-urlencode "data=$q" "$ep" -o "$out.tmp"
    if head -c 20 "$out.tmp" | grep -q '{'; then
      if node -e "JSON.parse(require('fs').readFileSync('$out.tmp','utf8'))" 2>/dev/null; then mv "$out.tmp" "$out"; echo "OK $out from $ep try $i"; exit 0; fi
    fi
  done
  sleep $wait; wait=$((wait*2))
done
echo "FAIL $out"; exit 1
