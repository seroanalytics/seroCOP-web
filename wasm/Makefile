# Makefile for Parallel Tempering MCMC WebAssembly Module

CXX = em++
CXXFLAGS = -O3 -std=c++17
EMFLAGS = --bind -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME='createMCMCModule' -s ENVIRONMENT='web'

TARGET = parallel_tempering_mcmc
SRC = parallel_tempering_mcmc.cpp
OUTPUT = parallel_tempering_mcmc.js

all: $(OUTPUT)

$(OUTPUT): $(SRC)
	$(CXX) $(CXXFLAGS) $(EMFLAGS) $(SRC) -o $(OUTPUT)

clean:
	rm -f $(OUTPUT) $(TARGET).wasm

.PHONY: all clean
