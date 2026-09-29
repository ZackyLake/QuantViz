# Quantize Visualize

A browser-only playground for visualizing different quantization types and making simple quality comparisons. Using WebAssembly to keeps quantization fully in the browser, with the expectation that it can run faster than JavaScript implementation.

## Pages

- **[compiler.html](compiler.html)** - Compile AssemblyScript `.ts` source in the browser, validate the generated Wasm, download it, or inspect a Wasm file's exports.
- **[testfns.html](testfns.html)** - Load a `.wasm` file, inspect quantizer metadata and exported methods,  run a small quantize/dequantize error test.
- **[showtensor.html](showtensor.html)** - Load `.safetensors` or `.gguf` tensors together with a quantizer `.wasm`, compare compatible quantizers with row RMSE, and visualize block-level error.

## Wasm Quantizer Interface

For a quantization type named `<type>`, a complete implementation can export these three functions:

```text
info_<type>(): u32
quantize_<type>(src: usize, dst: usize, nrows: u32, n_per_row: u32): void
dequantize_<type>(src: usize, dst: usize, nrows: u32, n_per_row: u32): void
```

- `info_<type>` returns packed metadata: bits 0-15 are `block_size` in bytes, bits 16-23 are `row_meta_size` in bytes, and bits 24-31 are `log2(n_per_block)`.
- `quantize_<type>` reads row-major `Float32` values from `src` and writes quantized bytes to `dst`.
- `dequantize_<type>` reads quantized bytes from `src` and writes reconstructed `Float32` values to `dst`.
- `nrows` is the row count, `n_per_row` is the number of values per row, and `n_per_row` must be divisible by `n_per_block`. `src` and `dst` are raw addresses in Wasm linear memory; the functions return data through memory and return `void`.

The module must also export its `WebAssembly.Memory`. `FloatPtr` and `BytePtr` in `ggml.ts` are semantic aliases for `usize` addresses.

## FNS Test Data

`testfns.html` uses a deterministic MT19937 seed and generates 64 rows of 4096 synthetic LLM-like weights. 

Each value uses a Gaussian distribution by default; 5% of values use a scaled Student-t distribution with 3 degrees of freedom for heavier tails, and 0.1% are multiplied by 10 as outliers. Values are scaled by `1 / sqrt(fanIn)`.

## Quick Start

1. Open **[compiler.html](compiler.html)** and choose AssemblyScript source such as `ggml.ts`. Compile it to Wasm and download the generated file.
2. Open **[testfns.html](testfns.html)**, load the generated `.wasm`, and run `Test` for each type with both `quantize` and `dequantize` exports to sanity-check its reconstruction error.
3. Open **[showtensor.html](showtensor.html)**:
   - Load a `.safetensors` or `.gguf` file.
   - Load the quantizer `.wasm` file.
   - Optionally enable `Weight only` or `Multi-dim` filters.
   - Select a tensor and one or more compatible quantizers, then click `Inspect`.
   - Compare the color-coded row RMSE table. Click a quantizer name to open its interactive Three.js chart of 32-element block errors, with orbit/pan controls, top and 3D views, rotation, log-scaled height/color, and hover details.

## Notes

`compiler.html` loads the latest AssemblyScript compiler from the jsDelivr npm CDN through the `assemblyscript/asc` entry, mapped to `dist/asc.js`, and uses [Binaryen](https://github.com/WebAssembly/binaryen) for Wasm validation.

The quantization algorithms in `ggml.ts` are based on [llama.cpp](https://github.com/ggml-org/llama.cpp) and [ik_llama.cpp](https://github.com/ikawrakow/ik_llama.cpp). They were converted to AssemblyScript using AI, so strict correctness is not guaranteed.

Calibration data or an imatrix is not passed during quantization. The measurements are intended for simple relative comparisons and do not represent the error level or quality of a real quantized model.
