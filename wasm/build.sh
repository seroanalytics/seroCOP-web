#!/bin/bash
# Build script for Parallel Tempering MCMC WebAssembly module
# Requires: Emscripten SDK (emsdk)

set -e

echo "=== Building Parallel Tempering MCMC WebAssembly Module ==="

# Check if emscripten is installed
if ! command -v em++ &> /dev/null; then
    echo "Error: Emscripten (em++) not found!"
    echo "Please install Emscripten SDK:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

echo "Emscripten version:"
em++ --version

echo ""
echo "Compiling C++ to WebAssembly..."
make clean
make

echo ""
echo "=== Build Complete ==="
echo "Output files:"
ls -lh parallel_tempering_mcmc.js parallel_tempering_mcmc.wasm

echo ""
echo "To use in your web application, include:"
echo "  <script src='wasm/parallel_tempering_mcmc.js'></script>"
