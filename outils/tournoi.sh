#!/bin/sh
# Plusieurs parties en parallèle : sh outils/tournoi.sh [adresse] [graines…]
A=${1:-0.8}; [ $# -gt 0 ] && shift
G=${*:-34 2026 7919 15838 23757 31676 39595 47514}
for g in $G; do echo "$g"; done | xargs -P 6 -I{} node outils/simulation.mjs {} "$A"
