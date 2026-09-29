(function (global) {
  "use strict";

  class Quantizer {
    #memory;
    #workspacePointer;

    constructor({ name, n_per_block, block_size, row_meta_size, quantizer, dequantizer, memory }) {
      if (!Number.isSafeInteger(n_per_block) || n_per_block < 1) {
        throw new Error(`Invalid n_per_block for quantizer "${name}"`);
      }

      this.name = name;
      this.n_per_block = n_per_block;
      this.block_size = block_size;
      this.row_meta_size = row_meta_size;
      this.quantizer = quantizer;
      this.dequantizer = dequantizer;
      this.#memory = memory;
      this.#workspacePointer = memory instanceof WebAssembly.Memory
        ? memory.buffer.byteLength
        : 0;
    }

    get memory() {
      return this.#memory;
    }

    quantize(src, nrows, n_per_row) {
      if (typeof this.quantizer !== "function") {
        throw new Error(`Quantizer "${this.name}" does not export quantize_${this.name}`);
      }
      if (!(src instanceof Float32Array)) {
        throw new TypeError("quantize src must be a Float32Array");
      }

      const sizes = this.#getSizes(nrows, n_per_row);
      return this.#run(this.quantizer, src, nrows, n_per_row,
        sizes.floatByteLength, sizes.quantizedByteLength,
        Uint8Array, sizes.quantizedByteLength);
    }

    dequantize(src, nrows, n_per_row) {
      if (typeof this.dequantizer !== "function") {
        throw new Error(`Quantizer "${this.name}" does not export dequantize_${this.name}`);
      }
      if (!(src instanceof Uint8Array)) {
        throw new TypeError("dequantize src must be a Uint8Array");
      }

      const sizes = this.#getSizes(nrows, n_per_row);
      return this.#run(this.dequantizer, src, nrows, n_per_row,
        sizes.quantizedByteLength, sizes.floatByteLength,
        Float32Array, sizes.floatElementCount);
    }

    #getSizes(nrows, n_per_row) {
      for (const [value, label] of [[nrows, "nrows"], [n_per_row, "n_per_row"]]) {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
          throw new RangeError(`${label} must be an unsigned 32-bit integer`);
        }
      }

      if (n_per_row % this.n_per_block !== 0) {
        throw new RangeError(`n_per_row must be divisible by n_per_block (${this.n_per_block})`);
      }

      const floatElementCount = nrows * n_per_row;
      const floatByteLength = floatElementCount * Float32Array.BYTES_PER_ELEMENT;
      const quantizedBytesPerRow = this.row_meta_size
        + (n_per_row / this.n_per_block) * this.block_size;
      const quantizedByteLength = nrows * quantizedBytesPerRow;
      if (!Number.isSafeInteger(floatByteLength) || !Number.isSafeInteger(quantizedByteLength)) {
        throw new RangeError("Requested tensor shape is too large");
      }

      return { floatElementCount, floatByteLength, quantizedByteLength };
    }

    #run(fn, src, nrows, n_per_row, srcByteLength, dstByteLength, outputType, outputLength) {
      if (!(this.#memory instanceof WebAssembly.Memory)) {
        throw new Error("WASM module must export its linear memory to run quantizers");
      }
      if (src.byteLength !== srcByteLength) {
        throw new RangeError(`Expected src to contain ${srcByteLength} bytes; got ${src.byteLength}`);
      }

      const sourceInWasmMemory = src.buffer === this.#memory.buffer;
      const sourceBytes = sourceInWasmMemory
        ? null
        : new Uint8Array(src.buffer, src.byteOffset, src.byteLength).slice();
      const srcPointer = sourceInWasmMemory ? src.byteOffset : this.#workspacePointer;
      const sourceEnd = srcPointer + srcByteLength;
      const dstPointer = Math.ceil(Math.max(this.#workspacePointer, sourceEnd) / 4) * 4;
      const requiredEnd = dstPointer + dstByteLength;
      if (!Number.isSafeInteger(dstPointer) || dstPointer > 0xffffffff
        || !Number.isSafeInteger(requiredEnd) || requiredEnd > 0x100000000) {
        throw new RangeError("Requested WASM memory region is too large");
      }

      const currentByteLength = this.#memory.buffer.byteLength;
      if (requiredEnd > currentByteLength) {
        const pages = Math.ceil((requiredEnd - currentByteLength) / 65536);
        this.#memory.grow(pages);
      }

      const wasmMemory = new Uint8Array(this.#memory.buffer);
      wasmMemory.fill(0, dstPointer, requiredEnd);
      if (!sourceInWasmMemory) wasmMemory.set(sourceBytes, srcPointer);
      fn(srcPointer, dstPointer, nrows, n_per_row);

      return new outputType(this.#memory.buffer, dstPointer, outputLength).slice();
    }
  }

  class CalcErrorResult {
    constructor(block_error, row_error, blk32_error) {
      this.block_error = block_error;
      this.row_error = row_error;
      this.blk32_error = blk32_error;
    }
  }

  global.calc_error = function calc_error(src, dst, nrows, n_per_row, n_per_block) {
    if (!(src instanceof Float32Array) || !(dst instanceof Float32Array)) {
      throw new TypeError("src and dst must be Float32Array instances");
    }

    for (const [value, label, allowZero] of [
      [nrows, "nrows", true],
      [n_per_row, "n_per_row", false],
      [n_per_block, "n_per_block", false],
    ]) {
      if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 0xffffffff) {
        throw new RangeError(`${label} must be a valid unsigned 32-bit dimension`);
      }
    }

    if (n_per_row % n_per_block !== 0) {
      throw new RangeError("n_per_row must be divisible by n_per_block");
    }

    const expectedLength = nrows * n_per_row;
    const nblocks = n_per_row / n_per_block;
    if (!Number.isSafeInteger(expectedLength) || !Number.isSafeInteger(nblocks * nrows)) {
      throw new RangeError("Requested error shape is too large");
    }
    if (src.length !== expectedLength || dst.length !== expectedLength) {
      throw new RangeError(`src and dst must each contain ${expectedLength} floats`);
    }

    const block_error = Array.from({ length: nblocks }, () => new Array(nrows));
    const blk32_error = Array.from({ length: n_per_row / 32 }, () => new Array(nrows));
    const row_error = new Array(nrows);

    for (let row = 0; row < nrows; row++) {
      const rowOffset = row * n_per_row;
      let rowSquaredError = 0;

      for (let block = 0; block < nblocks; block++) {
        const blockOffset = rowOffset + block * n_per_block;
        let blockSquaredError = 0;

        for (let blk32 = 0; blk32 < n_per_block / 32; blk32++) {
          let blk32SquaredError = 0;
          for (let element = 0; element < 32; element++) {
            const index = blockOffset + blk32 * 32 + element;
            const difference = src[index] - dst[index];
            const squaredError = difference * difference;
            blk32SquaredError += squaredError;
          }

          blockSquaredError += blk32SquaredError;
          blk32_error[block * (n_per_block / 32) + blk32][row] = Math.sqrt(blk32SquaredError / 32);
        }

        rowSquaredError += blockSquaredError;
        block_error[block][row] = Math.sqrt(blockSquaredError / n_per_block);
      }

      row_error[row] = Math.sqrt(rowSquaredError / n_per_row);
    }

    return new CalcErrorResult(block_error, row_error, blk32_error);
  };

  global.loadQuantizer = async function loadQuantizer(wasmBytes) {
    const imports = {
      env: {
        abort(_message, _fileName, lineNumber, columnNumber) {
          throw new Error(`AssemblyScript abort at ${lineNumber}:${columnNumber}`);
        },
      },
    };
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    const exports = instance.exports;
    const memory = Object.values(exports).find((value) => value instanceof WebAssembly.Memory);
    const quantizers = {};

    for (const [exportName, info] of Object.entries(exports)) {
      const match = /^info_(.+)$/.exec(exportName);
      if (!match || typeof info !== "function") continue;

      const name = match[1];
      const packed = info() >>> 0;
      const exponent = (packed >>> 24) & 0xff;
      quantizers[name] = new Quantizer({
        name,
        n_per_block: 2 ** exponent,
        block_size: packed & 0xffff,
        row_meta_size: (packed >>> 16) & 0xff,
        quantizer: exports[`quantize_${name}`],
        dequantizer: exports[`dequantize_${name}`],
        memory,
      });
    }

    return quantizers;
  };
})(globalThis);