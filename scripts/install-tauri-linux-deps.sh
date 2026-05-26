#!/usr/bin/env bash

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v apt-get >/dev/null 2>&1; then
    echo "error: this helper currently supports Debian/Ubuntu apt-based runners only" >&2
    exit 1
fi

sudo DEBIAN_FRONTEND=noninteractive apt-get update

# Detect which WebKit2GTK dev package is available (4.1 on Ubuntu 22.04+, 4.0 on Ubuntu 20.04)
if apt-cache show libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
    WEBKIT_PKG="libwebkit2gtk-4.1-dev"
else
    WEBKIT_PKG="libwebkit2gtk-4.0-dev"
fi

sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    "$WEBKIT_PKG" \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libdbus-1-dev \
    patchelf \
    libfuse2
