#!/usr/bin/env bash

set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
    echo "error: this helper currently supports Debian/Ubuntu apt-based runners only" >&2
    exit 1
fi

sudo apt-get update
sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libdbus-1-dev \
    patchelf
