#!/usr/bin/env bash
# =============================================================================
#  Schwalmtalzupfer – Live-Logs
#  Verwendung: bash logs.sh [--lines 100] [--follow]
# =============================================================================
LINES=50
FOLLOW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--lines) LINES="$2"; shift 2 ;;
    -f|--follow) FOLLOW=true; shift ;;
    *) shift ;;
  esac
done

echo ""
echo "  Schwalmtalzupfer – Journal-Log (letzte $LINES Zeilen)"
echo "  ────────────────────────────────────────────────────"
echo "  Beenden: Strg+C"
echo ""

if $FOLLOW; then
  journalctl -u schwalmtalzupfer -n "$LINES" -f
else
  journalctl -u schwalmtalzupfer -n "$LINES" --no-pager
fi

