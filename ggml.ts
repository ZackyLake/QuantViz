
function packInfo(nPerBlockLog2: u32, blockSize: u32, rowMetaSize: u32): u32 {
  return blockSize | (rowMetaSize << 16) | (nPerBlockLog2 << 24);
}

// Packed: block_size in bits 0-15, row_meta_size in 16-23, log2(n_per_block) in 24-31.
export function info_q1_0(): u32 { return packInfo(7, 18, 0); }
export function info_q2_0(): u32 { return packInfo(6, 18, 0); }
export function info_ptq1_0(): u32 { return packInfo(7, 28, 0); }
export function info_q4_0(): u32 { return packInfo(5, 18, 0); }
export function info_q4_1(): u32 { return packInfo(5, 20, 0); }
export function info_q5_0(): u32 { return packInfo(5, 22, 0); }
export function info_q5_1(): u32 { return packInfo(5, 24, 0); }
export function info_q8_0(): u32 { return packInfo(5, 34, 0); }
export function info_q8_1(): u32 { return packInfo(5, 36, 0); }
export function info_mxfp4(): u32 { return packInfo(5, 17, 0); }
export function info_nvfp4(): u32 { return packInfo(6, 36, 0); }
export function info_q2_k(): u32 { return packInfo(8, 84, 0); }
export function info_q3_k(): u32 { return packInfo(8, 110, 0); }
export function info_q4_k(): u32 { return packInfo(8, 144, 0); }
export function info_q5_k(): u32 { return packInfo(8, 176, 0); }
export function info_q6_k(): u32 { return packInfo(8, 210, 0); }
export function info_iq2_xxs(): u32 { return packInfo(8, 66, 0); }
export function info_iq2_xs(): u32 { return packInfo(8, 74, 0); }
export function info_iq3_xxs(): u32 { return packInfo(8, 98, 0); }
export function info_iq3_s(): u32 { return packInfo(8, 110, 0); }
export function info_iq2_s(): u32 { return packInfo(8, 82, 0); }
export function info_iq1_s(): u32 { return packInfo(8, 50, 0); }
export function info_iq1_m(): u32 { return packInfo(8, 56, 0); }
export function info_iq4_nl(): u32 { return packInfo(5, 18, 0); }
export function info_iq4_xs(): u32 { return packInfo(8, 136, 0); }
export function info_q8_k(): u32 { return packInfo(8, 292, 0); }
export function info_tq1_0(): u32 { return packInfo(8, 54, 0); }
export function info_tq2_0(): u32 { return packInfo(8, 66, 0); }
export function info_iq2_k(): u32 { return packInfo(8, 76, 0); }
export function info_iq3_k(): u32 { return packInfo(8, 110, 0); }
export function info_iq4_k(): u32 { return packInfo(8, 144, 0); }
export function info_iq5_k(): u32 { return packInfo(8, 176, 0); }
export function info_iq6_k(): u32 { return packInfo(8, 212, 0); }
export function info_iq4_kss(): u32 { return packInfo(8, 128, 4); }
export function info_iq2_ks(): u32 { return packInfo(8, 70, 2); }
export function info_iq3_ks(): u32 { return packInfo(8, 102, 2); }
export function info_iq4_ks(): u32 { return packInfo(8, 136, 4); }
export function info_iq5_ks(): u32 { return packInfo(8, 168, 4); }
export function info_iq2_kl(): u32 { return packInfo(8, 86, 2); }
export function info_iq1_kt(): u32 { return packInfo(8, 56, 4); }
export function info_iq2_kt(): u32 { return packInfo(8, 68, 4); }
export function info_iq3_kt(): u32 { return packInfo(8, 100, 4); }
export function info_iq4_kt(): u32 { return packInfo(8, 128, 4); }

// Semantic aliases for raw Wasm linear-memory addresses; both lower to usize.
type FloatPtr = usize;
type BytePtr = usize;

function absF32(value: f32): f32 {
  return value < 0.0 ? -value : value;
}

const MXFP4_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  0, 1, 2, 3, 4, 6, 8, 12, 0, -1, -2, -3, -4, -6, -8, -12,
]);

function mxfp4Value(index: u32): f32 {
  return f32(unchecked(MXFP4_VALUES[i32(index)]));
}

function e8m0ToF32Half(value: u8): f32 {
  const bits = value < 2
    ? u32(0x00200000) << i32(value)
    : u32(value - 1) << 23;
  return reinterpret<f32>(bits);
}

function floorLog2F32(value: f32): i32 {
  const bits = reinterpret<u32>(value);
  const exponent = (bits >>> 23) & 0xff;
  if (exponent != 0) return i32(exponent) - 127;

  let mantissa = bits & 0x7fffff;
  let result: i32 = -149;
  while (mantissa > 1) {
    mantissa >>>= 1;
    result++;
  }
  return result;
}

function ue4m3ToF32(value: u8): f32 {
  if (value == 0 || value == 0x7f) return 0.0;
  const exponent = (u32(value) >>> 3) & 0xf;
  const mantissa = u32(value) & 7;
  if (exponent == 0) return f32(mantissa) * 0.0009765625;
  const bits = (u32(exponent + 119) << 23) | (mantissa << 20);
  return reinterpret<f32>(bits);
}

function f32ToUe4m3(value: f32): u8 {
  if (!(value > 0.0)) return 0;
  let clamped = value;
  if (clamped > 448.0) clamped = 448.0;

  const bits = reinterpret<u32>(clamped);
  const fp32Exponent = i32((bits >>> 23) & 0xff) - 127;
  const fp32Mantissa = i32((bits >>> 20) & 7);
  let exponent = fp32Exponent + 7;
  if (exponent <= 0) {
    let mantissa = i32(clamped * 512.0 + 0.5);
    if (mantissa > 7) mantissa = 7;
    if (mantissa < 1) return 0;
    return u8(mantissa);
  }
  if (exponent >= 15) return 0x7e;

  let mantissa = fp32Mantissa + i32((bits >>> 19) & 1);
  if (mantissa > 7) {
    mantissa = 0;
    exponent++;
    if (exponent >= 15) return 0x7e;
  }
  return u8((exponent << 3) | mantissa);
}

function bestMxfp4Index(value: f32, scale: f32): u32 {
  let bestIndex: u32 = 0;
  let bestError = absF32(mxfp4Value(0) * scale - value);
  for (let index: u32 = 1; index < 16; index++) {
    const error = absF32(mxfp4Value(index) * scale - value);
    if (error < bestError) {
      bestIndex = index;
      bestError = error;
    }
  }
  return bestIndex;
}

function f32ToFp16(value: f32): u16 {
  const bits = reinterpret<u32>(value);
  const sign = (bits >>> 16) & 0x8000;
  const floatExponent = (bits >>> 23) & 0xff;
  let exponent = i32(floatExponent) - 112;
  let mantissa = bits & 0x7fffff;

  if (floatExponent == 0xff) {
    const payload = mantissa == 0 ? 0 : (mantissa >>> 13) | 0x0200;
    return u16(sign | 0x7c00 | payload);
  }

  if (exponent <= 0) {
    if (exponent < -10) return u16(sign);
    mantissa |= 0x800000;
    const shift = 14 - exponent;
    let rounded = mantissa >>> shift;
    const remainder = mantissa & ((u32(1) << shift) - 1);
    const halfway = u32(1) << (shift - 1);
    if (remainder > halfway || (remainder == halfway && (rounded & 1) != 0)) {
      rounded++;
    }
    return u16(sign | rounded);
  }

  if (exponent >= 31) return u16(sign | 0x7c00);

  let rounded = mantissa >>> 13;
  const remainder = mantissa & 0x1fff;
  if (remainder > 0x1000 || (remainder == 0x1000 && (rounded & 1) != 0)) {
    rounded++;
    if (rounded == 0x400) {
      rounded = 0;
      exponent++;
      if (exponent >= 31) return u16(sign | 0x7c00);
    }
  }

  return u16(sign | (u32(exponent) << 10) | rounded);
}

function fp16ToF32(value: u16): f32 {
  const half = u32(value);
  const sign = (half & 0x8000) << 16;
  const exponent = (half >>> 10) & 0x1f;
  let mantissa = half & 0x03ff;
  let bits: u32;

  if (exponent == 0) {
    if (mantissa == 0) return reinterpret<f32>(sign);
    let unbiasedExponent = -14;
    while ((mantissa & 0x0400) == 0) {
      mantissa <<= 1;
      unbiasedExponent--;
    }
    mantissa &= 0x03ff;
    bits = sign | (u32(unbiasedExponent + 127) << 23) | (mantissa << 13);
  } else if (exponent == 0x1f) {
    bits = sign | 0x7f800000 | (mantissa << 13);
  } else {
    bits = sign | ((exponent + 112) << 23) | (mantissa << 13);
  }

  return reinterpret<f32>(bits);
}

function readF32(src: FloatPtr, index: u32): f32 {
  return load<f32>(src + (usize(index) << 2));
}

function writeF32(dst: FloatPtr, index: u32, value: f32): void {
  store<f32>(dst + (usize(index) << 2), value);
}

function requireBlockAligned(nPerRow: u32, blockElements: u32): void {
  if (nPerRow % blockElements != 0) unreachable();
}

function rowElementCount(nrows: u32, nPerRow: u32, blockElements: u32): u32 {
  requireBlockAligned(nPerRow, blockElements);
  return nrows * nPerRow;
}

function roundAwayFromZero(value: f32): i32 {
  return value >= 0.0 ? i32(value + 0.5) : i32(value - 0.5);
}

function roundNearestEven(value: f32): i32 {
  let lower = i32(value);
  if (f32(lower) > value) lower--;
  const fraction = value - f32(lower);
  if (fraction > 0.5 || (fraction == 0.5 && (lower & 1) != 0)) return lower + 1;
  return lower;
}

// Pointers are raw linear-memory addresses; n_per_row is the number of float elements in each row.
export function quantize_q1_0(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 128);
  for (let block: u32 = 0; block < k / 128; block++) {
    let sumAbs: f32 = 0.0;
    for (let j: u32 = 0; j < 128; j++) sumAbs += absF32(readF32(src, block * 128 + j));
    store<u16>(dst + usize(block * 18), f32ToFp16(sumAbs / 128.0));

    for (let byte: u32 = 0; byte < 16; byte++) {
      let packed: u8 = 0;
      for (let bit: u32 = 0; bit < 8; bit++) {
        if (readF32(src, block * 128 + byte * 8 + bit) >= 0.0) {
          packed = u8(u32(packed) | (u32(1) << i32(bit)));
        }
      }
      store<u8>(dst + usize(block * 18 + 2 + byte), packed);
    }
  }
}

export function dequantize_q1_0(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 128);
  for (let block: u32 = 0; block < k / 128; block++) {
    const blockSrc = src + usize(block * 18);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let j: u32 = 0; j < 128; j++) {
      const packed = load<u8>(blockSrc + usize(2 + (j >> 3)));
      const bit = (u32(packed) >> i32(j & 7)) & 1;
      writeF32(dst, block * 128 + j, bit != 0 ? d : -d);
    }
  }
}

export function quantize_q2_0(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 64);
  for (let block: u32 = 0; block < k / 64; block++) {
    let amax: f32 = 0.0;
    for (let j: u32 = 0; j < 64; j++) {
      const value = absF32(readF32(src, block * 64 + j));
      if (value > amax) amax = value;
    }
    const id: f32 = amax > 0.0 ? f32(1.0) / amax : f32(0.0);
    const blockDst = dst + usize(block * 18);
    store<u16>(blockDst, f32ToFp16(amax));

    for (let byte: u32 = 0; byte < 16; byte++) {
      let packed: u8 = 0;
      for (let lane: u32 = 0; lane < 4; lane++) {
        let q = roundAwayFromZero(readF32(src, block * 64 + byte * 4 + lane) * id) + 1;
        if (q < 0) q = 0;
        if (q > 3) q = 3;
        packed |= u8(q << (lane * 2));
      }
      store<u8>(blockDst + usize(2 + byte), packed);
    }
  }
}

export function dequantize_q2_0(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 64);
  for (let block: u32 = 0; block < k / 64; block++) {
    const blockSrc = src + usize(block * 18);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let j: u32 = 0; j < 64; j++) {
      const packed = load<u8>(blockSrc + usize(2 + (j >> 2)));
      const q = (i32(packed) >> i32((j & 3) * 2)) & 3;
      writeF32(dst, block * 64 + j, f32(q - 1) * d);
    }
  }
}

export function quantize_q4_0(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    let amax: f32 = 0.0;
    let maxValue: f32 = 0.0;
    for (let j: u32 = 0; j < 32; j++) {
      const value = readF32(src, block * 32 + j);
      const magnitude = absF32(value);
      if (magnitude > amax) {
        amax = magnitude;
        maxValue = value;
      }
    }
    const d = maxValue / -8.0;
    const id = d != 0.0 ? 1.0 / d : 0.0;
    const blockDst = dst + usize(block * 18);
    store<u16>(blockDst, f32ToFp16(d));

    for (let j: u32 = 0; j < 16; j++) {
      let q0 = i32(readF32(src, block * 32 + j) * id + 8.5);
      let q1 = i32(readF32(src, block * 32 + 16 + j) * id + 8.5);
      if (q0 > 15) q0 = 15;
      if (q1 > 15) q1 = 15;
      store<u8>(blockDst + usize(2 + j), u8(q0 | (q1 << 4)));
    }
  }
}

export function dequantize_q4_0(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 18);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let j: u32 = 0; j < 16; j++) {
      const packed = load<u8>(blockSrc + usize(2 + j));
      writeF32(dst, block * 32 + j, f32(i32(packed & 0x0f) - 8) * d);
      writeF32(dst, block * 32 + 16 + j, f32(i32(packed >> 4) - 8) * d);
    }
  }
}

export function quantize_q4_1(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    let minValue = readF32(src, block * 32);
    let maxValue = minValue;
    for (let j: u32 = 1; j < 32; j++) {
      const value = readF32(src, block * 32 + j);
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    const d = (maxValue - minValue) / 15.0;
    const id = d != 0.0 ? 1.0 / d : 0.0;
    const blockDst = dst + usize(block * 20);
    store<u16>(blockDst, f32ToFp16(d));
    store<u16>(blockDst + 2, f32ToFp16(minValue));

    for (let j: u32 = 0; j < 16; j++) {
      let q0 = i32((readF32(src, block * 32 + j) - minValue) * id + 0.5);
      let q1 = i32((readF32(src, block * 32 + 16 + j) - minValue) * id + 0.5);
      if (q0 > 15) q0 = 15;
      if (q1 > 15) q1 = 15;
      store<u8>(blockDst + usize(4 + j), u8(q0 | (q1 << 4)));
    }
  }
}

export function dequantize_q4_1(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 20);
    const d = fp16ToF32(load<u16>(blockSrc));
    const m = fp16ToF32(load<u16>(blockSrc + 2));
    for (let j: u32 = 0; j < 16; j++) {
      const packed = load<u8>(blockSrc + usize(4 + j));
      writeF32(dst, block * 32 + j, f32(packed & 0x0f) * d + m);
      writeF32(dst, block * 32 + 16 + j, f32(packed >> 4) * d + m);
    }
  }
}

export function quantize_q5_0(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    let amax: f32 = 0.0;
    let maxValue: f32 = 0.0;
    for (let j: u32 = 0; j < 32; j++) {
      const value = readF32(src, block * 32 + j);
      const magnitude = absF32(value);
      if (magnitude > amax) {
        amax = magnitude;
        maxValue = value;
      }
    }
    const d = maxValue / -16.0;
    const id = d != 0.0 ? 1.0 / d : 0.0;
    const blockDst = dst + usize(block * 22);
    store<u16>(blockDst, f32ToFp16(d));
    let highBits: u32 = 0;

    for (let j: u32 = 0; j < 16; j++) {
      let q0 = i32(readF32(src, block * 32 + j) * id + 16.5);
      let q1 = i32(readF32(src, block * 32 + 16 + j) * id + 16.5);
      if (q0 > 31) q0 = 31;
      if (q1 > 31) q1 = 31;
      store<u8>(blockDst + usize(6 + j), u8((q0 & 0x0f) | ((q1 & 0x0f) << 4)));
      highBits |= u32((q0 >> 4) & 1) << j;
      highBits |= u32((q1 >> 4) & 1) << (j + 16);
    }

    store<u32>(blockDst + 2, highBits);
  }
}

export function dequantize_q5_0(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 22);
    const d = fp16ToF32(load<u16>(blockSrc));
    const highBits = load<u32>(blockSrc + 2);
    for (let j: u32 = 0; j < 16; j++) {
      const packed = load<u8>(blockSrc + usize(6 + j));
      const q0 = i32(packed & 0x0f) | (i32((highBits >>> j) & 1) << 4);
      const q1 = i32(packed >> 4) | (i32((highBits >>> (j + 16)) & 1) << 4);
      writeF32(dst, block * 32 + j, f32(q0 - 16) * d);
      writeF32(dst, block * 32 + 16 + j, f32(q1 - 16) * d);
    }
  }
}

export function quantize_q5_1(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    let minValue = readF32(src, block * 32);
    let maxValue = minValue;
    for (let j: u32 = 1; j < 32; j++) {
      const value = readF32(src, block * 32 + j);
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
    const d = (maxValue - minValue) / 31.0;
    const id = d != 0.0 ? 1.0 / d : 0.0;
    const blockDst = dst + usize(block * 24);
    store<u16>(blockDst, f32ToFp16(d));
    store<u16>(blockDst + 2, f32ToFp16(minValue));
    let highBits: u32 = 0;

    for (let j: u32 = 0; j < 16; j++) {
      const q0 = i32((readF32(src, block * 32 + j) - minValue) * id + 0.5);
      const q1 = i32((readF32(src, block * 32 + 16 + j) - minValue) * id + 0.5);
      store<u8>(blockDst + usize(8 + j), u8((q0 & 0x0f) | ((q1 & 0x0f) << 4)));
      highBits |= u32((q0 >> 4) & 1) << j;
      highBits |= u32((q1 >> 4) & 1) << (j + 16);
    }

    store<u32>(blockDst + 4, highBits);
  }
}

export function dequantize_q5_1(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 24);
    const d = fp16ToF32(load<u16>(blockSrc));
    const m = fp16ToF32(load<u16>(blockSrc + 2));
    const highBits = load<u32>(blockSrc + 4);
    for (let j: u32 = 0; j < 16; j++) {
      const packed = load<u8>(blockSrc + usize(8 + j));
      const q0 = i32(packed & 0x0f) | (i32((highBits >>> j) & 1) << 4);
      const q1 = i32(packed >> 4) | (i32((highBits >>> (j + 16)) & 1) << 4);
      writeF32(dst, block * 32 + j, f32(q0) * d + m);
      writeF32(dst, block * 32 + 16 + j, f32(q1) * d + m);
    }
  }
}

// Follows the x86 AVX quantizer's max/scale/round sequence; Q8_1 also stores d * sum(q).
function quantizeQ8(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32, withSum: bool): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  const blockSize: u32 = withSum ? 36 : 34;
  const quantsOffset: u32 = withSum ? 4 : 2;

  for (let block: u32 = 0; block < k / 32; block++) {
    let amax: f32 = 0.0;
    for (let vector: u32 = 0; vector < 4; vector++) {
      for (let lane: u32 = 0; lane < 8; lane++) {
        const magnitude = absF32(readF32(src, block * 32 + vector * 8 + lane));
        if (magnitude > amax) amax = magnitude;
      }
    }

    const d = amax / 127.0;
    const id: f32 = amax != 0.0 ? f32(127.0) / amax : f32(0.0);
    const blockDst = dst + usize(block * blockSize);
    store<u16>(blockDst, f32ToFp16(d));
    let sum: i32 = 0;

    for (let vector: u32 = 0; vector < 4; vector++) {
      for (let lane: u32 = 0; lane < 8; lane++) {
        const index = vector * 8 + lane;
        const q = roundNearestEven(readF32(src, block * 32 + index) * id);
        store<i8>(blockDst + usize(quantsOffset + index), i8(q));
        sum += q;
      }
    }

    if (withSum) store<u16>(blockDst + 2, f32ToFp16(d * f32(sum)));
  }
}

export function quantize_q8_0(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeQ8(src, dst, nrows, n_per_row, false);
}

export function dequantize_q8_0(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 34);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let j: u32 = 0; j < 32; j++) {
      writeF32(dst, block * 32 + j, f32(load<i8>(blockSrc + usize(2 + j))) * d);
    }
  }
}

export function quantize_q8_1(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeQ8(src, dst, nrows, n_per_row, true);
}

export function dequantize_q8_1(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 36);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let j: u32 = 0; j < 32; j++) {
      writeF32(dst, block * 32 + j, f32(load<i8>(blockSrc + usize(4 + j))) * d);
    }
  }
}

export function quantize_mxfp4(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    let amax: f32 = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const magnitude = absF32(readF32(src, block * 32 + lane));
      if (magnitude > amax) amax = magnitude;
    }

    const exponent: u8 = amax > 0.0 ? u8(floorLog2F32(amax) + 125) : 0;
    const scale = e8m0ToF32Half(exponent);
    const blockDst = dst + usize(block * 17);
    store<u8>(blockDst, exponent);
    for (let lane: u32 = 0; lane < 16; lane++) {
      const low = bestMxfp4Index(readF32(src, block * 32 + lane), scale);
      const high = bestMxfp4Index(readF32(src, block * 32 + 16 + lane), scale);
      store<u8>(blockDst + usize(1 + lane), u8(low | (high << 4)));
    }
  }
}

export function dequantize_mxfp4(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 17);
    const scale = e8m0ToF32Half(load<u8>(blockSrc));
    for (let lane: u32 = 0; lane < 16; lane++) {
      const packed = load<u8>(blockSrc + usize(1 + lane));
      writeF32(dst, block * 32 + lane, mxfp4Value(u32(packed & 0x0f)) * scale);
      writeF32(dst, block * 32 + 16 + lane, mxfp4Value(u32(packed >>> 4)) * scale);
    }
  }
}

export function quantize_nvfp4(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 64);
  for (let block: u32 = 0; block < k / 64; block++) {
    const blockDst = dst + usize(block * 36);
    for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
      const srcStart = block * 64 + subBlock * 16;
      let amax: f32 = 0.0;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const magnitude = absF32(readF32(src, srcStart + lane));
        if (magnitude > amax) amax = magnitude;
      }

      const scaleCode = f32ToUe4m3(amax / 6.0);
      const scale = ue4m3ToF32(scaleCode);
      store<u8>(blockDst + usize(subBlock), scaleCode);
      for (let lane: u32 = 0; lane < 8; lane++) {
        const low = bestMxfp4Index(readF32(src, srcStart + lane), scale);
        const high = bestMxfp4Index(readF32(src, srcStart + 8 + lane), scale);
        store<u8>(blockDst + usize(4 + subBlock * 8 + lane), u8(low | (high << 4)));
      }
    }
  }
}

export function dequantize_nvfp4(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 64);
  for (let block: u32 = 0; block < k / 64; block++) {
    const blockSrc = src + usize(block * 36);
    for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
      const scale = ue4m3ToF32(load<u8>(blockSrc + usize(subBlock)));
      for (let lane: u32 = 0; lane < 8; lane++) {
        const packed = load<u8>(blockSrc + usize(4 + subBlock * 8 + lane));
        const output = block * 64 + subBlock * 16;
        writeF32(dst, output + lane, mxfp4Value(u32(packed & 0x0f)) * scale);
        writeF32(dst, output + 8 + lane, mxfp4Value(u32(packed >>> 4)) * scale);
      }
    }
  }
}

const K_GROUP_MAX_EPS: f32 = 1.0e-15;

function clampQuant(value: i32, minimum: i32, maximum: i32): i32 {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

function sqrtF32(value: f32): f32 {
  return f32(Math.sqrt(f64(value)));
}

function makeQkx2Quants(
  src: FloatPtr,
  srcStart: u32,
  count: u32,
  maxLevel: u32,
  weights: StaticArray<f32>,
  levels: StaticArray<u8>,
  levelStart: u32,
  candidateLevels: StaticArray<u8>,
  rmin: f32,
  rdelta: f32,
  stepCount: u32,
  useMad: bool,
  result: StaticArray<f32>,
): void {
  const countI = i32(count);
  const maxLevelI = i32(maxLevel);
  const firstValue = readF32(src, srcStart);
  let minValue = firstValue;
  let maxValue = firstValue;
  let sumWeights = weights[0];
  let weightedValueSum = sumWeights * firstValue;

  for (let element: i32 = 1; element < countI; element++) {
    const value = readF32(src, srcStart + u32(element));
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
    const weight = weights[element];
    sumWeights += weight;
    weightedValueSum += weight * value;
  }

  if (minValue > 0.0) minValue = 0.0;
  if (maxValue == minValue) {
    for (let element: i32 = 0; element < countI; element++) {
      levels[i32(levelStart) + element] = 0;
    }
    result[0] = 0.0;
    result[1] = -minValue;
    return;
  }

  let inverseScale = f32(maxLevel) / (maxValue - minValue);
  let scale: f32 = f32(1.0) / inverseScale;
  let bestError: f32 = 0.0;
  for (let element: i32 = 0; element < countI; element++) {
    const value = readF32(src, srcStart + u32(element));
    const level = clampQuant(roundNearestEven(inverseScale * (value - minValue)), 0, maxLevelI);
    levels[i32(levelStart) + element] = u8(level);
    let diff = scale * f32(level) + minValue - value;
    diff = useMad ? absF32(diff) : diff * diff;
    bestError += weights[element] * diff;
  }

  for (let step: i32 = 0; step <= i32(stepCount); step++) {
    inverseScale = (rmin + rdelta * f32(step) + f32(maxLevel)) / (maxValue - minValue);
    let sumLevels: f32 = 0.0;
    let sumLevelsSquared: f32 = 0.0;
    let weightedLevelsValue: f32 = 0.0;

    for (let element: i32 = 0; element < countI; element++) {
      const value = readF32(src, srcStart + u32(element));
      const level = clampQuant(roundNearestEven(inverseScale * (value - minValue)), 0, maxLevelI);
      candidateLevels[element] = u8(level);
      const weight = weights[element];
      sumLevels += weight * f32(level);
      sumLevelsSquared += weight * f32(level) * f32(level);
      weightedLevelsValue += weight * f32(level) * value;
    }

    const determinant = sumWeights * sumLevelsSquared - sumLevels * sumLevels;
    if (determinant > 0.0) {
      let candidateScale = (sumWeights * weightedLevelsValue - weightedValueSum * sumLevels) / determinant;
      let candidateMin = (sumLevelsSquared * weightedValueSum - sumLevels * weightedLevelsValue) / determinant;
      if (candidateMin > 0.0) {
        candidateMin = 0.0;
        candidateScale = weightedLevelsValue / sumLevelsSquared;
      }

      let currentError: f32 = 0.0;
      for (let element: i32 = 0; element < countI; element++) {
        const value = readF32(src, srcStart + u32(element));
        let diff = candidateScale * f32(candidateLevels[element]) + candidateMin - value;
        diff = useMad ? absF32(diff) : diff * diff;
        currentError += weights[element] * diff;
      }

      if (currentError < bestError) {
        for (let element: i32 = 0; element < countI; element++) {
          levels[i32(levelStart) + element] = candidateLevels[element];
        }
        bestError = currentError;
        scale = candidateScale;
        minValue = candidateMin;
      }
    }
  }

  result[0] = scale;
  result[1] = -minValue;
}

function makeK4Groups(
  src: FloatPtr,
  srcStart: u32,
  maxLevel: u32,
  rmin: f32,
  stepCount: u32,
  levels: StaticArray<u8>,
  scales: StaticArray<f32>,
  minima: StaticArray<f32>,
  weights: StaticArray<f32>,
  candidateLevels: StaticArray<u8>,
  result: StaticArray<f32>,
): void {
  let maxScale: f32 = 0.0;
  let maxMin: f32 = 0.0;

  for (let group: u32 = 0; group < 8; group++) {
    const groupStart = srcStart + group * 32;
    let sumSquares: f32 = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, groupStart + lane);
      sumSquares += value * value;
    }
    const averageMagnitude = sqrtF32(sumSquares / 32.0);
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, groupStart + lane);
      weights[i32(lane)] = averageMagnitude + absF32(value);
    }

    makeQkx2Quants(src, groupStart, 32, maxLevel, weights, levels, group * 32, candidateLevels,
      rmin, 0.1, stepCount, false, result);
    scales[i32(group)] = result[0];
    minima[i32(group)] = result[1];
    if (result[0] > maxScale) maxScale = result[0];
    if (result[1] > maxMin) maxMin = result[1];
  }

  result[0] = maxScale;
  result[1] = maxMin;
}

function getScaleMinK4(scales: BytePtr, group: u32): u32 {
  let scale: u32;
  let minimum: u32;
  if (group < 4) {
    scale = u32(load<u8>(scales + usize(group))) & 63;
    minimum = u32(load<u8>(scales + usize(group + 4))) & 63;
  } else {
    scale = (u32(load<u8>(scales + usize(group + 4))) & 15) |
      ((u32(load<u8>(scales + usize(group - 4)) >> 6)) << 4);
    minimum = (u32(load<u8>(scales + usize(group + 4)) >> 4) & 15) |
      ((u32(load<u8>(scales + usize(group)) >> 6)) << 4);
  }
  return scale | (minimum << 8);
}

function q3ScaleAt(scales: BytePtr, group: u32): i32 {
  let low: u32;
  if (group < 8) {
    low = u32(load<u8>(scales + usize(group))) & 15;
  } else {
    low = u32(load<u8>(scales + usize(group - 8)) >> 4);
  }
  const high = (u32(load<u8>(scales + usize(8 + group % 4))) >> i32(2 * (group / 4))) & 3;
  return i32(low | (high << 4)) - 32;
}

function makeQ3Quants16(src: FloatPtr, srcStart: u32, levels: StaticArray<i8>, levelStart: u32): f32 {
  let maxValue: f32 = 0.0;
  let amax: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const magnitude = absF32(value);
    if (magnitude > amax) {
      amax = magnitude;
      maxValue = value;
    }
  }

  if (amax < K_GROUP_MAX_EPS) {
    for (let lane: u32 = 0; lane < 16; lane++) levels[i32(levelStart + lane)] = 0;
    return 0.0;
  }

  let inverseScale: f32 = f32(-4.0) / maxValue;
  let sumlx: f32 = 0.0;
  let suml2: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const quant = clampQuant(roundNearestEven(inverseScale * value), -4, 3);
    levels[i32(levelStart + lane)] = i8(quant);
    const weight = value * value;
    sumlx += weight * value * f32(quant);
    suml2 += weight * f32(quant * quant);
  }

  for (let attempt: u32 = 0; attempt < 5; attempt++) {
    let changed: u32 = 0;
    for (let lane: u32 = 0; lane < 16; lane++) {
      const value = readF32(src, srcStart + lane);
      const weight = value * value;
      const current = i32(levels[i32(levelStart + lane)]);
      const slx = sumlx - weight * value * f32(current);
      if (slx > 0.0) {
        const sl2 = suml2 - weight * f32(current * current);
        const newLevel = clampQuant(roundNearestEven(value * sl2 / slx), -4, 3);
        if (newLevel != current) {
          const candidateSlx = slx + weight * value * f32(newLevel);
          const candidateSl2 = sl2 + weight * f32(newLevel * newLevel);
          if (candidateSl2 > 0.0 && candidateSlx * candidateSlx * suml2 > sumlx * sumlx * candidateSl2) {
            levels[i32(levelStart + lane)] = i8(newLevel);
            sumlx = candidateSlx;
            suml2 = candidateSl2;
            changed++;
          }
        }
      }
    }
    if (changed == 0) break;
  }

  for (let lane: u32 = 0; lane < 16; lane++) {
    const index = i32(levelStart + lane);
    levels[index] = i8(i32(levels[index]) + 4);
  }
  return suml2 > 0.0 ? sumlx / suml2 : 0.0;
}

function makeQxQuants16(src: FloatPtr, srcStart: u32, levels: StaticArray<i8>, levelStart: u32): f32 {
  let maxValue: f32 = 0.0;
  let amax: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const magnitude = absF32(value);
    if (magnitude > amax) {
      amax = magnitude;
      maxValue = value;
    }
  }

  if (amax < K_GROUP_MAX_EPS) {
    for (let lane: u32 = 0; lane < 16; lane++) levels[i32(levelStart + lane)] = 0;
    return 0.0;
  }

  let inverseScale: f32 = f32(-32.0) / maxValue;
  let sumlx: f32 = 0.0;
  let suml2: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const quant = clampQuant(roundNearestEven(inverseScale * value), -32, 31);
    levels[i32(levelStart + lane)] = i8(quant + 32);
    const weight = value * value;
    sumlx += weight * value * f32(quant);
    suml2 += weight * f32(quant * quant);
  }

  let scale = suml2 != 0.0 ? sumlx / suml2 : 0.0;
  let best = scale * sumlx;
  for (let step: i32 = -9; step <= 9; step++) {
    if (step == 0) continue;
    inverseScale = -(f32(32.0) + f32(0.1) * f32(step)) / maxValue;
    sumlx = 0.0;
    suml2 = 0.0;
    for (let lane: u32 = 0; lane < 16; lane++) {
      const value = readF32(src, srcStart + lane);
      const quant = clampQuant(roundNearestEven(inverseScale * value), -32, 31);
      const weight = value * value;
      sumlx += weight * value * f32(quant);
      suml2 += weight * f32(quant * quant);
    }
    if (suml2 > 0.0 && sumlx * sumlx > best * suml2) {
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, srcStart + lane);
        const quant = clampQuant(roundNearestEven(inverseScale * value), -32, 31);
        levels[i32(levelStart + lane)] = i8(quant + 32);
      }
      scale = sumlx / suml2;
      best = scale * sumlx;
    }
  }
  return scale;
}

export function quantize_q2_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const levels = new StaticArray<u8>(256);
  const candidateLevels = new StaticArray<u8>(32);
  const weights = new StaticArray<f32>(32);
  const scales = new StaticArray<f32>(16);
  const minima = new StaticArray<f32>(16);
  const result = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 84);
    let maxScale: f32 = 0.0;
    let maxMin: f32 = 0.0;

    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        weights[i32(lane)] = absF32(readF32(src, groupStart + lane));
      }
      makeQkx2Quants(src, groupStart, 16, 3, weights, levels, group * 16, candidateLevels,
        -0.5, 0.1, 15, true, result);
      scales[i32(group)] = result[0];
      minima[i32(group)] = result[1];
      if (result[0] > maxScale) maxScale = result[0];
      if (result[1] > maxMin) maxMin = result[1];
    }

    if (maxScale > 0.0) {
      const inverseScale: f32 = f32(15.0) / maxScale;
      for (let group: u32 = 0; group < 16; group++) {
        store<u8>(blockDst + usize(group), u8(roundNearestEven(inverseScale * scales[i32(group)])));
      }
      store<u16>(blockDst + 80, f32ToFp16(maxScale / 15.0));
    } else {
      for (let group: u32 = 0; group < 16; group++) store<u8>(blockDst + usize(group), 0);
      store<u16>(blockDst + 80, 0);
    }

    if (maxMin > 0.0) {
      const inverseMin: f32 = f32(15.0) / maxMin;
      for (let group: u32 = 0; group < 16; group++) {
        const minimumCode = roundNearestEven(inverseMin * minima[i32(group)]);
        const oldValue = u32(load<u8>(blockDst + usize(group)));
        store<u8>(blockDst + usize(group), u8(oldValue | (u32(minimumCode) << 4)));
      }
      store<u16>(blockDst + 82, f32ToFp16(maxMin / 15.0));
    } else {
      store<u16>(blockDst + 82, 0);
    }

    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      const scaleByte = load<u8>(blockDst + usize(group));
      const d = fp16ToF32(load<u16>(blockDst + 80)) * f32(scaleByte & 15);
      const dm = fp16ToF32(load<u16>(blockDst + 82)) * f32(scaleByte >> 4);
      if (d == 0.0) continue;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const quant = clampQuant(roundNearestEven((readF32(src, groupStart + lane) + dm) / d), 0, 3);
        levels[i32(group * 16 + lane)] = u8(quant);
      }
    }

    for (let chunk: u32 = 0; chunk < 2; chunk++) {
      for (let lane: u32 = 0; lane < 32; lane++) {
        const base = chunk * 128 + lane;
        const packed = u32(levels[i32(base)]) |
          (u32(levels[i32(base + 32)]) << 2) |
          (u32(levels[i32(base + 64)]) << 4) |
          (u32(levels[i32(base + 96)]) << 6);
        store<u8>(blockDst + usize(16 + chunk * 32 + lane), u8(packed));
      }
    }
  }
}

export function dequantize_q2_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 84);
    const dAll = fp16ToF32(load<u16>(blockSrc + 80));
    const minAll = fp16ToF32(load<u16>(blockSrc + 82));
    for (let element: u32 = 0; element < 256; element++) {
      const chunk = element / 128;
      const withinChunk = element % 128;
      const stage = withinChunk / 32;
      const lane = withinChunk % 32;
      const scaleGroup = chunk * 8 + stage * 2 + lane / 16;
      const scaleByte = load<u8>(blockSrc + usize(scaleGroup));
      const packed = load<u8>(blockSrc + usize(16 + chunk * 32 + lane));
      const quant = (u32(packed) >> i32(stage * 2)) & 3;
      const d = dAll * f32(scaleByte & 15);
      const minimum = minAll * f32(scaleByte >> 4);
      writeF32(dst, block * 256 + element, d * f32(quant) - minimum);
    }
  }
}

export function quantize_q3_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const levels = new StaticArray<i8>(256);
  const scales = new StaticArray<f32>(16);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 110);
    let maxScale: f32 = 0.0;
    let maxAbsScale: f32 = 0.0;

    for (let group: u32 = 0; group < 16; group++) {
      const scale = makeQ3Quants16(src, srcStart + group * 16, levels, group * 16);
      scales[i32(group)] = scale;
      const absScale = absF32(scale);
      if (absScale > maxAbsScale) {
        maxAbsScale = absScale;
        maxScale = scale;
      }
    }

    for (let byte: u32 = 0; byte < 12; byte++) store<u8>(blockDst + usize(96 + byte), 0);
    if (maxScale != 0.0) {
      const inverseScale: f32 = f32(-32.0) / maxScale;
      for (let group: u32 = 0; group < 16; group++) {
        const scaleCode = clampQuant(roundNearestEven(inverseScale * scales[i32(group)]), -32, 31) + 32;
        if (group < 8) {
          store<u8>(blockDst + usize(96 + group), u8(scaleCode & 15));
        } else {
          const packedOffset = 96 + group - 8;
          const packed = u32(load<u8>(blockDst + usize(packedOffset))) | (u32(scaleCode & 15) << 4);
          store<u8>(blockDst + usize(packedOffset), u8(packed));
        }
        const highOffset = 96 + 8 + group % 4;
        const highShift = 2 * (group / 4);
        const highPacked = u32(load<u8>(blockDst + usize(highOffset))) |
          (u32(scaleCode >> 4) << i32(highShift));
        store<u8>(blockDst + usize(highOffset), u8(highPacked));
      }
      store<u16>(blockDst + 108, f32ToFp16(f32(1.0) / inverseScale));
    } else {
      store<u16>(blockDst + 108, 0);
    }

    const scalesPtr = blockDst + 96;
    const dAll = fp16ToF32(load<u16>(blockDst + 108));
    for (let group: u32 = 0; group < 16; group++) {
      const d = dAll * f32(q3ScaleAt(scalesPtr, group));
      if (d == 0.0) continue;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const quant = clampQuant(roundNearestEven(readF32(src, srcStart + group * 16 + lane) / d), -4, 3);
        levels[i32(group * 16 + lane)] = i8(quant + 4);
      }
    }

    for (let byte: u32 = 0; byte < 32; byte++) store<u8>(blockDst + usize(byte), 0);
    for (let element: u32 = 0; element < 256; element++) {
      let quant = i32(levels[i32(element)]);
      if (quant > 3) {
        const maskOffset = element % 32;
        const mask = u32(1) << i32(element / 32);
        const highByte = u32(load<u8>(blockDst + usize(maskOffset))) | mask;
        store<u8>(blockDst + usize(maskOffset), u8(highByte));
        quant -= 4;
      }
      levels[i32(element)] = i8(quant);
    }

    for (let chunk: u32 = 0; chunk < 2; chunk++) {
      for (let lane: u32 = 0; lane < 32; lane++) {
        const base = chunk * 128 + lane;
        const packed = i32(levels[i32(base)]) |
          (i32(levels[i32(base + 32)]) << 2) |
          (i32(levels[i32(base + 64)]) << 4) |
          (i32(levels[i32(base + 96)]) << 6);
        store<u8>(blockDst + usize(32 + chunk * 32 + lane), u8(packed));
      }
    }
  }
}

export function dequantize_q3_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 110);
    const dAll = fp16ToF32(load<u16>(blockSrc + 108));
    const scalesPtr = blockSrc + 96;
    for (let element: u32 = 0; element < 256; element++) {
      const chunk = element / 128;
      const withinChunk = element % 128;
      const stage = withinChunk / 32;
      const lane = withinChunk % 32;
      const scaleGroup = chunk * 8 + stage * 2 + lane / 16;
      const signedScale = q3ScaleAt(scalesPtr, scaleGroup);
      const packed = load<u8>(blockSrc + usize(32 + chunk * 32 + lane));
      const lowQuant = (u32(packed) >> i32(stage * 2)) & 3;
      const highBitIndex = chunk * 4 + stage;
      const highMask = u32(load<u8>(blockSrc + usize(lane))) & (u32(1) << i32(highBitIndex));
      const signedQuant = i32(lowQuant) - (highMask != 0 ? 0 : 4);
      const scale = dAll * f32(signedScale);
      writeF32(dst, block * 256 + element, scale * f32(signedQuant));
    }
  }
}

function quantizeK4(
  src: FloatPtr,
  dst: BytePtr,
  nrows: u32,
  nPerRow: u32,
  maxLevel: u32,
  blockByteSize: u32,
  rmin: f32,
  stepCount: u32,
  withHighBits: bool,
): void {
  const k = rowElementCount(nrows, nPerRow, 256);
  const levels = new StaticArray<u8>(256);
  const scales = new StaticArray<f32>(8);
  const minima = new StaticArray<f32>(8);
  const weights = new StaticArray<f32>(32);
  const candidateLevels = new StaticArray<u8>(32);
  const result = new StaticArray<f32>(2);
  const maxLevelI = i32(maxLevel);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * blockByteSize);
    makeK4Groups(src, srcStart, maxLevel, rmin, stepCount, levels, scales, minima, weights,
      candidateLevels, result);
    const maxScale = result[0];
    const maxMin = result[1];
    const inverseScale: f32 = maxScale > 0.0 ? 63.0 / maxScale : 0.0;
    const inverseMin: f32 = maxMin > 0.0 ? 63.0 / maxMin : 0.0;
    const scalesPtr = blockDst + 4;

    for (let byte: u32 = 0; byte < 12; byte++) store<u8>(scalesPtr + usize(byte), 0);
    for (let group: u32 = 0; group < 8; group++) {
      const scaleCode = clampQuant(roundNearestEven(inverseScale * scales[i32(group)]), 0, 63);
      const minCode = clampQuant(roundNearestEven(inverseMin * minima[i32(group)]), 0, 63);
      if (group < 4) {
        store<u8>(scalesPtr + usize(group), u8(scaleCode));
        store<u8>(scalesPtr + usize(group + 4), u8(minCode));
      } else {
        store<u8>(scalesPtr + usize(group + 4), u8((scaleCode & 15) | (minCode << 4)));
        const scaleHighOffset = group - 4;
        const scaleHigh = u32(load<u8>(scalesPtr + usize(scaleHighOffset))) | (u32(scaleCode >> 4) << 6);
        store<u8>(scalesPtr + usize(scaleHighOffset), u8(scaleHigh));
        const minHighOffset = group;
        const minHigh = u32(load<u8>(scalesPtr + usize(minHighOffset))) | (u32(minCode >> 4) << 6);
        store<u8>(scalesPtr + usize(minHighOffset), u8(minHigh));
      }
    }

    store<u16>(blockDst, f32ToFp16(maxScale / 63.0));
    store<u16>(blockDst + 2, f32ToFp16(maxMin / 63.0));
    const dAll = fp16ToF32(load<u16>(blockDst));
    const minAll = fp16ToF32(load<u16>(blockDst + 2));

    for (let group: u32 = 0; group < 8; group++) {
      const packedScaleMin = getScaleMinK4(scalesPtr, group);
      const scale = dAll * f32(packedScaleMin & 255);
      const minimum = minAll * f32((packedScaleMin >>> 8) & 255);
      if (scale == 0.0) continue;
      for (let lane: u32 = 0; lane < 32; lane++) {
        const sourceValue = readF32(src, srcStart + group * 32 + lane);
        const quant = clampQuant(roundNearestEven((sourceValue + minimum) / scale), 0, maxLevelI);
        levels[i32(group * 32 + lane)] = u8(quant);
      }
    }

    if (withHighBits) {
      for (let lane: u32 = 0; lane < 32; lane++) store<u8>(blockDst + usize(16 + lane), 0);
      for (let chunk: u32 = 0; chunk < 4; chunk++) {
        const base = chunk * 64;
        const lowMask = u32(1) << i32(chunk * 2);
        const highMask = lowMask << 1;
        for (let lane: u32 = 0; lane < 32; lane++) {
          let lowQuant = u32(levels[i32(base + lane)]);
          let highQuant = u32(levels[i32(base + lane + 32)]);
          let packedHigh = u32(load<u8>(blockDst + usize(16 + lane)));
          if (lowQuant > 15) {
            lowQuant -= 16;
            packedHigh |= lowMask;
          }
          if (highQuant > 15) {
            highQuant -= 16;
            packedHigh |= highMask;
          }
          store<u8>(blockDst + usize(16 + lane), u8(packedHigh));
          store<u8>(blockDst + usize(48 + base / 2 + lane), u8(lowQuant | (highQuant << 4)));
        }
      }
    } else {
      for (let chunk: u32 = 0; chunk < 4; chunk++) {
        const base = chunk * 64;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const packed = u32(levels[i32(base + lane)]) | (u32(levels[i32(base + lane + 32)]) << 4);
          store<u8>(blockDst + usize(16 + base / 2 + lane), u8(packed));
        }
      }
    }
  }
}

function dequantizeK4(
  src: BytePtr,
  dst: FloatPtr,
  nrows: u32,
  nPerRow: u32,
  blockByteSize: u32,
  withHighBits: bool,
): void {
  const k = rowElementCount(nrows, nPerRow, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * blockByteSize);
    const scalesPtr = blockSrc + 4;
    const dAll = fp16ToF32(load<u16>(blockSrc));
    const minAll = fp16ToF32(load<u16>(blockSrc + 2));
    for (let element: u32 = 0; element < 256; element++) {
      const group = element / 32;
      const withinGroup = element % 32;
      const packedScaleMin = getScaleMinK4(scalesPtr, group);
      const scale = dAll * f32(packedScaleMin & 255);
      const minimum = minAll * f32((packedScaleMin >>> 8) & 255);
      let quant: u32;
      if (withHighBits) {
        const lowByte = load<u8>(blockSrc + usize(48 + (group / 2) * 32 + withinGroup));
        const highByte = load<u8>(blockSrc + usize(16 + withinGroup));
        const low = (group & 1) == 0 ? u32(lowByte & 15) : u32(lowByte >> 4);
        quant = low | (((u32(highByte) >> i32(group)) & 1) << 4);
      } else {
        const packed = load<u8>(blockSrc + usize(16 + (group / 2) * 32 + withinGroup));
        quant = (group & 1) == 0 ? u32(packed & 15) : u32(packed >> 4);
      }
      writeF32(dst, block * 256 + element, scale * f32(quant) - minimum);
    }
  }
}

export function quantize_q4_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeK4(src, dst, nrows, n_per_row, 15, 144, -1.0, 20, false);
}

export function dequantize_q4_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  dequantizeK4(src, dst, nrows, n_per_row, 144, false);
}

export function quantize_q5_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeK4(src, dst, nrows, n_per_row, 31, 176, -0.5, 15, true);
}

export function dequantize_q5_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  dequantizeK4(src, dst, nrows, n_per_row, 176, true);
}

export function quantize_q6_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const levels = new StaticArray<i8>(256);
  const scales = new StaticArray<f32>(16);
  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 210);
    let maxScale: f32 = 0.0;
    let maxAbsScale: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const scale = makeQxQuants16(src, srcStart + group * 16, levels, group * 16);
      scales[i32(group)] = scale;
      const absScale = absF32(scale);
      if (absScale > maxAbsScale) {
        maxAbsScale = absScale;
        maxScale = scale;
      }
    }

    if (maxAbsScale < K_GROUP_MAX_EPS) {
      for (let byte: u32 = 0; byte < 210; byte++) store<u8>(blockDst + usize(byte), 0);
      continue;
    }

    const inverseScale: f32 = f32(-128.0) / maxScale;
    store<u16>(blockDst + 208, f32ToFp16(f32(1.0) / inverseScale));
    for (let group: u32 = 0; group < 16; group++) {
      let scaleCode = roundNearestEven(inverseScale * scales[i32(group)]);
      if (scaleCode > 127) scaleCode = 127;
      store<i8>(blockDst + usize(192 + group), i8(scaleCode));
    }

    const dAll = fp16ToF32(load<u16>(blockDst + 208));
    for (let group: u32 = 0; group < 16; group++) {
      const scale = dAll * f32(load<i8>(blockDst + usize(192 + group)));
      if (scale == 0.0) continue;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const quant = clampQuant(roundNearestEven(readF32(src, srcStart + group * 16 + lane) / scale), -32, 31);
        levels[i32(group * 16 + lane)] = i8(quant + 32);
      }
    }

    for (let chunk: u32 = 0; chunk < 2; chunk++) {
      for (let lane: u32 = 0; lane < 32; lane++) {
        const base = chunk * 128 + lane;
        const q1 = u32(i32(levels[i32(base)]) & 15);
        const q2 = u32(i32(levels[i32(base + 32)]) & 15);
        const q3 = u32(i32(levels[i32(base + 64)]) & 15);
        const q4 = u32(i32(levels[i32(base + 96)]) & 15);
        const high = u32(i32(levels[i32(base)]) >> 4) |
          (u32(i32(levels[i32(base + 32)]) >> 4) << 2) |
          (u32(i32(levels[i32(base + 64)]) >> 4) << 4) |
          (u32(i32(levels[i32(base + 96)]) >> 4) << 6);
        store<u8>(blockDst + usize(chunk * 64 + lane), u8(q1 | (q3 << 4)));
        store<u8>(blockDst + usize(chunk * 64 + lane + 32), u8(q2 | (q4 << 4)));
        store<u8>(blockDst + usize(128 + chunk * 32 + lane), u8(high));
      }
    }
  }
}

export function dequantize_q6_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 210);
    const dAll = fp16ToF32(load<u16>(blockSrc + 208));
    for (let element: u32 = 0; element < 256; element++) {
      const chunk = element / 128;
      const withinChunk = element % 128;
      const lane = withinChunk % 32;
      const band = withinChunk / 32;
      const lowByteOffset = chunk * 64 + lane + (band % 2) * 32;
      const highByteOffset = 128 + chunk * 32 + lane;
      const nibbleShift = band >= 2 ? 4 : 0;
      const highShift = band * 2;
      const lowByte = load<u8>(blockSrc + usize(lowByteOffset));
      const highByte = load<u8>(blockSrc + usize(highByteOffset));
      const quant = i32(((u32(lowByte) >> i32(nibbleShift)) & 15) |
        (((u32(highByte) >> i32(highShift)) & 3) << 4)) - 32;
      const scaleIndex = chunk * 8 + lane / 16 + band * 2;
      const scale = load<i8>(blockSrc + usize(192 + scaleIndex));
      writeF32(dst, block * 256 + element, dAll * f32(scale) * f32(quant));
    }
  }
}

export function quantize_q8_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 292);
    let maxAbs: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const magnitude = absF32(readF32(src, srcStart + element));
      if (magnitude > maxAbs) maxAbs = magnitude;
    }

    const d = maxAbs / 127.0;
    const inverseScale: f32 = maxAbs != 0.0 ? 127.0 / maxAbs : 0.0;
    store<f32>(blockDst, d);
    for (let group: u32 = 0; group < 16; group++) {
      let sum: i32 = 0;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const element = group * 16 + lane;
        const quant = roundNearestEven(readF32(src, srcStart + element) * inverseScale);
        store<i8>(blockDst + usize(4 + element), i8(quant));
        sum += quant;
      }
      store<i16>(blockDst + usize(260 + group * 2), i16(sum));
    }
  }
}

export function dequantize_q8_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 292);
    const d = load<f32>(blockSrc);
    for (let element: u32 = 0; element < 256; element++) {
      const quant = load<i8>(blockSrc + usize(4 + element));
      writeF32(dst, block * 256 + element, d * f32(quant));
    }
  }
}

const IQ2_XXS_LUT: StaticArray<u64> = StaticArray.fromArray<u64>([
  0x0808080808080808, 0x080808080808082b, 0x0808080808081919, 0x0808080808082b08, 0x0808080808082b2b, 0x0808080808190819, 0x0808080808191908, 0x08080808082b0808,
  0x08080808082b082b, 0x08080808082b2b08, 0x08080808082b2b2b, 0x0808080819080819, 0x0808080819081908, 0x0808080819190808, 0x0808080819192b08, 0x08080808192b0819,
  0x08080808192b1908, 0x080808082b080808, 0x080808082b08082b, 0x080808082b082b2b, 0x080808082b2b082b, 0x0808081908080819, 0x0808081908081908, 0x0808081908190808,
  0x0808081908191919, 0x0808081919080808, 0x080808192b081908, 0x080808192b192b08, 0x0808082b08080808, 0x0808082b0808082b, 0x0808082b082b082b, 0x0808082b2b08082b,
  0x0808190808080819, 0x0808190808081908, 0x0808190808190808, 0x08081908082b0819, 0x08081908082b1908, 0x0808190819080808, 0x080819081908082b, 0x0808190819082b08,
  0x08081908192b0808, 0x080819082b080819, 0x080819082b081908, 0x080819082b190808, 0x080819082b2b1908, 0x0808191908080808, 0x080819190808082b, 0x0808191908082b08,
  0x08081919082b0808, 0x080819191908192b, 0x08081919192b2b19, 0x080819192b080808, 0x080819192b190819, 0x0808192b08082b19, 0x0808192b08190808, 0x0808192b19080808,
  0x0808192b2b081908, 0x0808192b2b2b1908, 0x08082b0808080808, 0x08082b0808081919, 0x08082b0808082b08, 0x08082b0808191908, 0x08082b08082b2b08, 0x08082b0819080819,
  0x08082b0819081908, 0x08082b0819190808, 0x08082b081919082b, 0x08082b082b082b08, 0x08082b1908081908, 0x08082b1919080808, 0x08082b2b0808082b, 0x08082b2b08191908,
  0x0819080808080819, 0x0819080808081908, 0x0819080808190808, 0x08190808082b0819, 0x0819080819080808, 0x08190808192b0808, 0x081908082b081908, 0x081908082b190808,
  0x081908082b191919, 0x0819081908080808, 0x0819081908082b08, 0x08190819082b0808, 0x0819081919190808, 0x0819081919192b2b, 0x081908192b080808, 0x0819082b082b1908,
  0x0819082b19081919, 0x0819190808080808, 0x0819190808082b08, 0x08191908082b0808, 0x08191908082b1919, 0x0819190819082b19, 0x081919082b080808, 0x0819191908192b08,
  0x08191919192b082b, 0x0819192b08080808, 0x0819192b0819192b, 0x08192b0808080819, 0x08192b0808081908, 0x08192b0808190808, 0x08192b0819080808, 0x08192b082b080819,
  0x08192b1908080808, 0x08192b1908081919, 0x08192b192b2b0808, 0x08192b2b19190819, 0x082b080808080808, 0x082b08080808082b, 0x082b080808082b2b, 0x082b080819081908,
  0x082b0808192b0819, 0x082b08082b080808, 0x082b08082b08082b, 0x082b0819082b2b19, 0x082b081919082b08, 0x082b082b08080808, 0x082b082b0808082b, 0x082b190808080819,
  0x082b190808081908, 0x082b190808190808, 0x082b190819080808, 0x082b19081919192b, 0x082b191908080808, 0x082b191919080819, 0x082b1919192b1908, 0x082b192b2b190808,
  0x082b2b0808082b08, 0x082b2b08082b0808, 0x082b2b082b191908, 0x082b2b2b19081908, 0x1908080808080819, 0x1908080808081908, 0x1908080808190808, 0x1908080808192b08,
  0x19080808082b0819, 0x19080808082b1908, 0x1908080819080808, 0x1908080819082b08, 0x190808081919192b, 0x19080808192b0808, 0x190808082b080819, 0x190808082b081908,
  0x190808082b190808, 0x1908081908080808, 0x19080819082b0808, 0x19080819192b0819, 0x190808192b080808, 0x190808192b081919, 0x1908082b08080819, 0x1908082b08190808,
  0x1908082b19082b08, 0x1908082b1919192b, 0x1908082b192b2b08, 0x1908190808080808, 0x1908190808082b08, 0x19081908082b0808, 0x190819082b080808, 0x190819082b192b19,
  0x190819190819082b, 0x19081919082b1908, 0x1908192b08080808, 0x19082b0808080819, 0x19082b0808081908, 0x19082b0808190808, 0x19082b0819080808, 0x19082b0819081919,
  0x19082b1908080808, 0x19082b1919192b08, 0x19082b19192b0819, 0x19082b192b08082b, 0x19082b2b19081919, 0x19082b2b2b190808, 0x1919080808080808, 0x1919080808082b08,
  0x1919080808190819, 0x1919080808192b19, 0x19190808082b0808, 0x191908082b080808, 0x191908082b082b08, 0x1919081908081908, 0x191908191908082b, 0x191908192b2b1908,
  0x1919082b2b190819, 0x191919082b190808, 0x191919082b19082b, 0x1919191908082b2b, 0x1919192b08080819, 0x1919192b19191908, 0x19192b0808080808, 0x19192b0808190819,
  0x19192b0808192b19, 0x19192b08192b1908, 0x19192b1919080808, 0x19192b2b08082b08, 0x192b080808081908, 0x192b080808190808, 0x192b080819080808, 0x192b0808192b2b08,
  0x192b081908080808, 0x192b081919191919, 0x192b082b08192b08, 0x192b082b192b0808, 0x192b190808080808, 0x192b190808081919, 0x192b191908190808, 0x192b19190819082b,
  0x192b19192b081908, 0x192b2b081908082b, 0x2b08080808080808, 0x2b0808080808082b, 0x2b08080808082b2b, 0x2b08080819080819, 0x2b0808082b08082b, 0x2b08081908081908,
  0x2b08081908192b08, 0x2b08081919080808, 0x2b08082b08190819, 0x2b08190808080819, 0x2b08190808081908, 0x2b08190808190808, 0x2b08190808191919, 0x2b08190819080808,
  0x2b081908192b0808, 0x2b08191908080808, 0x2b0819191908192b, 0x2b0819192b191908, 0x2b08192b08082b19, 0x2b08192b19080808, 0x2b08192b192b0808, 0x2b082b080808082b,
  0x2b082b1908081908, 0x2b082b2b08190819, 0x2b19080808081908, 0x2b19080808190808, 0x2b190808082b1908, 0x2b19080819080808, 0x2b1908082b2b0819, 0x2b1908190819192b,
  0x2b1908192b080808, 0x2b19082b19081919, 0x2b19190808080808, 0x2b191908082b082b, 0x2b19190819081908, 0x2b19191919190819, 0x2b192b082b080819, 0x2b192b19082b0808,
  0x2b2b08080808082b, 0x2b2b080819190808, 0x2b2b08082b081919, 0x2b2b081908082b19, 0x2b2b082b08080808, 0x2b2b190808192b08, 0x2b2b2b0819190808, 0x2b2b2b1908081908,
]);

const IQ2_XS_LUT: StaticArray<u64> = StaticArray.fromArray<u64>([
  0x0808080808080808, 0x080808080808082b, 0x0808080808081919, 0x0808080808082b08, 0x0808080808082b2b, 0x0808080808190819, 0x0808080808191908, 0x080808080819192b,
  0x0808080808192b19, 0x08080808082b0808, 0x08080808082b082b, 0x08080808082b1919, 0x08080808082b2b08, 0x0808080819080819, 0x0808080819081908, 0x080808081908192b,
  0x0808080819082b19, 0x0808080819190808, 0x080808081919082b, 0x0808080819191919, 0x0808080819192b08, 0x08080808192b0819, 0x08080808192b1908, 0x080808082b080808,
  0x080808082b08082b, 0x080808082b081919, 0x080808082b082b08, 0x080808082b190819, 0x080808082b191908, 0x080808082b192b19, 0x080808082b2b0808, 0x0808081908080819,
  0x0808081908081908, 0x080808190808192b, 0x0808081908082b19, 0x0808081908190808, 0x080808190819082b, 0x0808081908191919, 0x0808081908192b08, 0x0808081908192b2b,
  0x08080819082b0819, 0x08080819082b1908, 0x0808081919080808, 0x080808191908082b, 0x0808081919081919, 0x0808081919082b08, 0x0808081919190819, 0x0808081919191908,
  0x08080819192b0808, 0x08080819192b2b08, 0x080808192b080819, 0x080808192b081908, 0x080808192b190808, 0x0808082b08080808, 0x0808082b0808082b, 0x0808082b08081919,
  0x0808082b08082b08, 0x0808082b08190819, 0x0808082b08191908, 0x0808082b082b0808, 0x0808082b19080819, 0x0808082b19081908, 0x0808082b19190808, 0x0808082b19191919,
  0x0808082b2b080808, 0x0808082b2b082b2b, 0x0808190808080819, 0x0808190808081908, 0x080819080808192b, 0x0808190808082b19, 0x0808190808190808, 0x080819080819082b,
  0x0808190808191919, 0x0808190808192b08, 0x08081908082b0819, 0x08081908082b1908, 0x0808190819080808, 0x080819081908082b, 0x0808190819081919, 0x0808190819082b08,
  0x0808190819190819, 0x0808190819191908, 0x080819081919192b, 0x08081908192b0808, 0x080819082b080819, 0x080819082b081908, 0x080819082b190808, 0x0808191908080808,
  0x080819190808082b, 0x0808191908081919, 0x0808191908082b08, 0x0808191908190819, 0x0808191908191908, 0x08081919082b0808, 0x0808191919080819, 0x0808191919081908,
  0x0808191919190808, 0x08081919192b0819, 0x080819192b080808, 0x0808192b08080819, 0x0808192b08081908, 0x0808192b08190808, 0x0808192b082b192b, 0x0808192b19080808,
  0x0808192b1908082b, 0x0808192b2b081908, 0x08082b0808080808, 0x08082b080808082b, 0x08082b0808081919, 0x08082b0808082b08, 0x08082b0808082b2b, 0x08082b0808190819,
  0x08082b0808191908, 0x08082b08082b0808, 0x08082b08082b1919, 0x08082b0819080819, 0x08082b0819081908, 0x08082b0819190808, 0x08082b0819192b08, 0x08082b082b080808,
  0x08082b082b2b0808, 0x08082b082b2b2b2b, 0x08082b1908080819, 0x08082b1908081908, 0x08082b1908190808, 0x08082b1919080808, 0x08082b192b080819, 0x08082b192b082b19,
  0x08082b2b08080808, 0x08082b2b082b0808, 0x08082b2b082b2b08, 0x08082b2b2b19192b, 0x08082b2b2b2b0808, 0x0819080808080819, 0x0819080808081908, 0x081908080808192b,
  0x0819080808082b19, 0x0819080808190808, 0x081908080819082b, 0x0819080808191919, 0x0819080808192b08, 0x08190808082b0819, 0x08190808082b1908, 0x0819080819080808,
  0x081908081908082b, 0x0819080819081919, 0x0819080819082b08, 0x0819080819190819, 0x0819080819191908, 0x08190808192b0808, 0x08190808192b2b2b, 0x081908082b080819,
  0x081908082b081908, 0x081908082b190808, 0x0819081908080808, 0x081908190808082b, 0x0819081908081919, 0x0819081908082b08, 0x0819081908190819, 0x0819081908191908,
  0x08190819082b0808, 0x0819081919080819, 0x0819081919081908, 0x0819081919190808, 0x081908192b080808, 0x081908192b191908, 0x081908192b19192b, 0x0819082b08080819,
  0x0819082b08081908, 0x0819082b0808192b, 0x0819082b08190808, 0x0819082b19080808, 0x0819082b192b0808, 0x0819190808080808, 0x081919080808082b, 0x0819190808081919,
  0x0819190808082b08, 0x0819190808190819, 0x0819190808191908, 0x08191908082b0808, 0x0819190819080819, 0x0819190819081908, 0x0819190819082b19, 0x0819190819190808,
  0x08191908192b1908, 0x081919082b080808, 0x0819191908080819, 0x0819191908081908, 0x0819191908190808, 0x0819191919080808, 0x0819192b08080808, 0x0819192b08191908,
  0x0819192b19082b19, 0x08192b0808080819, 0x08192b0808081908, 0x08192b0808190808, 0x08192b080819082b, 0x08192b0819080808, 0x08192b0819191908, 0x08192b082b08192b,
  0x08192b1908080808, 0x08192b1908081919, 0x08192b19192b192b, 0x08192b2b19190819, 0x08192b2b2b2b2b19, 0x082b080808080808, 0x082b08080808082b, 0x082b080808081919,
  0x082b080808082b08, 0x082b080808082b2b, 0x082b080808190819, 0x082b080808191908, 0x082b0808082b0808, 0x082b080819080819, 0x082b080819081908, 0x082b080819190808,
  0x082b08082b080808, 0x082b08082b2b0808, 0x082b081908080819, 0x082b081908081908, 0x082b081908190808, 0x082b081919080808, 0x082b081919082b08, 0x082b0819192b1919,
  0x082b082b08080808, 0x082b082b082b082b, 0x082b082b2b080808, 0x082b082b2b2b2b08, 0x082b190808080819, 0x082b190808081908, 0x082b190808190808, 0x082b1908082b2b19,
  0x082b190819080808, 0x082b191908080808, 0x082b191919080819, 0x082b19191919082b, 0x082b19192b192b19, 0x082b192b08080819, 0x082b192b08192b2b, 0x082b192b2b2b192b,
  0x082b2b0808080808, 0x082b2b0808082b08, 0x082b2b0808082b2b, 0x082b2b08082b0808, 0x082b2b0819191919, 0x082b2b082b082b08, 0x082b2b082b2b082b, 0x082b2b19192b2b08,
  0x082b2b192b190808, 0x082b2b2b08082b08, 0x082b2b2b082b0808, 0x082b2b2b2b08082b, 0x082b2b2b2b082b08, 0x082b2b2b2b082b2b, 0x1908080808080819, 0x1908080808081908,
  0x190808080808192b, 0x1908080808082b19, 0x1908080808190808, 0x190808080819082b, 0x1908080808191919, 0x1908080808192b08, 0x19080808082b0819, 0x19080808082b1908,
  0x1908080819080808, 0x190808081908082b, 0x1908080819081919, 0x1908080819082b08, 0x1908080819082b2b, 0x1908080819190819, 0x1908080819191908, 0x19080808192b0808,
  0x19080808192b1919, 0x190808082b080819, 0x190808082b081908, 0x190808082b190808, 0x1908081908080808, 0x190808190808082b, 0x1908081908081919, 0x1908081908082b08,
  0x1908081908190819, 0x1908081908191908, 0x19080819082b0808, 0x1908081919080819, 0x1908081919081908, 0x1908081919190808, 0x190808192b080808, 0x190808192b081919,
  0x190808192b2b082b, 0x1908082b08080819, 0x1908082b08081908, 0x1908082b08190808, 0x1908082b0819082b, 0x1908082b082b2b19, 0x1908082b19080808, 0x1908190808080808,
  0x190819080808082b, 0x1908190808081919, 0x1908190808082b08, 0x1908190808190819, 0x1908190808191908, 0x1908190808192b19, 0x19081908082b0808, 0x1908190819080819,
  0x1908190819081908, 0x1908190819190808, 0x190819082b080808, 0x190819082b191908, 0x1908191908080819, 0x1908191908081908, 0x1908191908190808, 0x19081919082b1908,
  0x1908191919080808, 0x190819192b192b2b, 0x1908192b08080808, 0x1908192b08082b2b, 0x1908192b19081908, 0x1908192b19190808, 0x19082b0808080819, 0x19082b0808081908,
  0x19082b0808190808, 0x19082b0819080808, 0x19082b0819081919, 0x19082b0819191908, 0x19082b08192b082b, 0x19082b1908080808, 0x19082b1908190819, 0x19082b1919081908,
  0x19082b1919190808, 0x19082b19192b2b19, 0x19082b2b08081908, 0x1919080808080808, 0x191908080808082b, 0x1919080808081919, 0x1919080808082b08, 0x1919080808190819,
  0x1919080808191908, 0x19190808082b0808, 0x19190808082b2b08, 0x1919080819080819, 0x1919080819081908, 0x1919080819190808, 0x191908082b080808, 0x1919081908080819,
  0x1919081908081908, 0x1919081908190808, 0x1919081908191919, 0x1919081919080808, 0x191908191908082b, 0x1919082b08080808, 0x1919082b19081908, 0x1919082b2b2b2b2b,
  0x1919190808080819, 0x1919190808081908, 0x1919190808190808, 0x19191908082b0819, 0x1919190819080808, 0x19191908192b0808, 0x191919082b080819, 0x191919082b2b0819,
  0x1919191908080808, 0x1919191908082b08, 0x191919192b080808, 0x191919192b082b08, 0x1919192b082b0819, 0x1919192b192b2b08, 0x1919192b2b2b0819, 0x19192b0808080808,
  0x19192b0808191908, 0x19192b0819080819, 0x19192b0819190808, 0x19192b082b192b19, 0x19192b1908192b2b, 0x19192b1919080808, 0x19192b191908082b, 0x19192b2b2b081919,
  0x192b080808080819, 0x192b080808081908, 0x192b080808190808, 0x192b080819080808, 0x192b080819191908, 0x192b0808192b082b, 0x192b08082b08192b, 0x192b08082b2b2b19,
  0x192b081908080808, 0x192b082b082b1908, 0x192b082b19082b2b, 0x192b082b2b19082b, 0x192b190808080808, 0x192b19080819192b, 0x192b191908190808, 0x192b191919080808,
  0x192b191919081919, 0x192b19192b2b1908, 0x192b2b0808080819, 0x192b2b08192b2b2b, 0x192b2b19082b1919, 0x192b2b2b0808192b, 0x192b2b2b19191908, 0x192b2b2b192b082b,
  0x2b08080808080808, 0x2b0808080808082b, 0x2b08080808081919, 0x2b08080808082b08, 0x2b08080808190819, 0x2b08080808191908, 0x2b080808082b0808, 0x2b080808082b2b2b,
  0x2b08080819080819, 0x2b08080819081908, 0x2b08080819190808, 0x2b0808082b080808, 0x2b0808082b08082b, 0x2b0808082b2b2b08, 0x2b0808082b2b2b2b, 0x2b08081908080819,
  0x2b08081908081908, 0x2b0808190808192b, 0x2b08081908190808, 0x2b08081919080808, 0x2b08081919190819, 0x2b08081919192b19, 0x2b08082b08080808, 0x2b08082b082b0808,
  0x2b08082b2b080808, 0x2b08082b2b08082b, 0x2b08082b2b2b0808, 0x2b08082b2b2b2b08, 0x2b08190808080819, 0x2b08190808081908, 0x2b08190808190808, 0x2b0819080819082b,
  0x2b08190808191919, 0x2b08190819080808, 0x2b081908192b0808, 0x2b0819082b082b19, 0x2b08191908080808, 0x2b08191919081908, 0x2b0819192b2b1919, 0x2b08192b08192b08,
  0x2b08192b192b2b2b, 0x2b082b0808080808, 0x2b082b0808082b08, 0x2b082b08082b1919, 0x2b082b0819192b2b, 0x2b082b082b080808, 0x2b082b082b08082b, 0x2b082b082b2b2b08,
  0x2b082b190808192b, 0x2b082b2b082b082b, 0x2b082b2b2b080808, 0x2b082b2b2b082b08, 0x2b082b2b2b19192b, 0x2b082b2b2b2b2b08, 0x2b19080808080819, 0x2b19080808081908,
  0x2b19080808190808, 0x2b19080819080808, 0x2b1908081919192b, 0x2b1908082b081908, 0x2b19081908080808, 0x2b190819082b082b, 0x2b190819192b1908, 0x2b19082b1919192b,
  0x2b19082b2b082b19, 0x2b19190808080808, 0x2b19190808081919, 0x2b19190819081908, 0x2b19190819190808, 0x2b19190819192b08, 0x2b191919082b2b19, 0x2b1919192b190808,
  0x2b1919192b19082b, 0x2b19192b19080819, 0x2b192b0819190819, 0x2b192b082b2b192b, 0x2b192b1919082b19, 0x2b192b2b08191919, 0x2b192b2b192b0808, 0x2b2b080808080808,
  0x2b2b08080808082b, 0x2b2b080808082b08, 0x2b2b080808082b2b, 0x2b2b0808082b0808, 0x2b2b0808082b2b2b, 0x2b2b08082b2b0808, 0x2b2b081919190819, 0x2b2b081919192b19,
  0x2b2b08192b2b192b, 0x2b2b082b08080808, 0x2b2b082b0808082b, 0x2b2b082b08082b08, 0x2b2b082b082b2b2b, 0x2b2b082b2b080808, 0x2b2b082b2b2b0808, 0x2b2b190819080808,
  0x2b2b19082b191919, 0x2b2b192b192b1919, 0x2b2b192b2b192b08, 0x2b2b2b0808082b2b, 0x2b2b2b08082b0808, 0x2b2b2b08082b082b, 0x2b2b2b08082b2b08, 0x2b2b2b082b2b0808,
  0x2b2b2b082b2b2b08, 0x2b2b2b1908081908, 0x2b2b2b192b081908, 0x2b2b2b192b08192b, 0x2b2b2b2b082b2b08, 0x2b2b2b2b082b2b2b, 0x2b2b2b2b2b190819, 0x2b2b2b2b2b2b2b2b,
]);

const IQ2_S_LUT: StaticArray<u64> = StaticArray.fromArray<u64>([
  0x0808080808080808, 0x080808080808082b, 0x0808080808081919, 0x0808080808082b08, 0x0808080808082b2b, 0x0808080808190819, 0x0808080808191908, 0x080808080819192b,
  0x0808080808192b19, 0x08080808082b0808, 0x08080808082b082b, 0x08080808082b1919, 0x08080808082b2b08, 0x0808080819080819, 0x0808080819081908, 0x080808081908192b,
  0x0808080819082b19, 0x0808080819190808, 0x080808081919082b, 0x0808080819191919, 0x0808080819192b08, 0x08080808192b0819, 0x08080808192b1908, 0x08080808192b192b,
  0x08080808192b2b19, 0x080808082b080808, 0x080808082b08082b, 0x080808082b081919, 0x080808082b082b08, 0x080808082b190819, 0x080808082b191908, 0x080808082b2b0808,
  0x080808082b2b1919, 0x080808082b2b2b2b, 0x0808081908080819, 0x0808081908081908, 0x080808190808192b, 0x0808081908082b19, 0x0808081908190808, 0x080808190819082b,
  0x0808081908191919, 0x0808081908192b08, 0x08080819082b0819, 0x08080819082b1908, 0x0808081919080808, 0x080808191908082b, 0x0808081919081919, 0x0808081919082b08,
  0x0808081919190819, 0x0808081919191908, 0x080808191919192b, 0x0808081919192b19, 0x08080819192b0808, 0x08080819192b1919, 0x08080819192b2b08, 0x080808192b080819,
  0x080808192b081908, 0x080808192b190808, 0x080808192b19082b, 0x080808192b191919, 0x080808192b2b0819, 0x080808192b2b1908, 0x0808082b08080808, 0x0808082b0808082b,
  0x0808082b08081919, 0x0808082b08082b08, 0x0808082b08190819, 0x0808082b08191908, 0x0808082b082b0808, 0x0808082b082b2b2b, 0x0808082b19080819, 0x0808082b19081908,
  0x0808082b1908192b, 0x0808082b19082b19, 0x0808082b19190808, 0x0808082b19191919, 0x0808082b2b080808, 0x0808082b2b081919, 0x0808082b2b082b2b, 0x0808082b2b191908,
  0x0808082b2b2b082b, 0x0808190808080819, 0x0808190808081908, 0x080819080808192b, 0x0808190808082b19, 0x0808190808190808, 0x080819080819082b, 0x0808190808191919,
  0x0808190808192b08, 0x08081908082b0819, 0x08081908082b1908, 0x08081908082b192b, 0x08081908082b2b19, 0x0808190819080808, 0x080819081908082b, 0x0808190819081919,
  0x0808190819082b08, 0x0808190819082b2b, 0x0808190819190819, 0x0808190819191908, 0x080819081919192b, 0x0808190819192b19, 0x08081908192b0808, 0x08081908192b082b,
  0x08081908192b1919, 0x080819082b080819, 0x080819082b081908, 0x080819082b08192b, 0x080819082b082b19, 0x080819082b190808, 0x080819082b191919, 0x080819082b192b08,
  0x080819082b2b0819, 0x080819082b2b1908, 0x0808191908080808, 0x080819190808082b, 0x0808191908081919, 0x0808191908082b08, 0x0808191908082b2b, 0x0808191908190819,
  0x0808191908191908, 0x080819190819192b, 0x0808191908192b19, 0x08081919082b0808, 0x08081919082b1919, 0x08081919082b2b08, 0x0808191919080819, 0x0808191919081908,
  0x080819191908192b, 0x0808191919082b19, 0x0808191919190808, 0x080819191919082b, 0x0808191919191919, 0x0808191919192b08, 0x08081919192b0819, 0x08081919192b1908,
  0x080819192b080808, 0x080819192b08082b, 0x080819192b081919, 0x080819192b082b08, 0x080819192b190819, 0x080819192b191908, 0x080819192b2b0808, 0x0808192b08080819,
  0x0808192b08081908, 0x0808192b0808192b, 0x0808192b08082b19, 0x0808192b08190808, 0x0808192b08191919, 0x0808192b19080808, 0x0808192b19081919, 0x0808192b19082b08,
  0x0808192b19190819, 0x0808192b19191908, 0x0808192b192b0808, 0x0808192b2b080819, 0x0808192b2b081908, 0x0808192b2b190808, 0x08082b0808080808, 0x08082b080808082b,
  0x08082b0808081919, 0x08082b0808082b08, 0x08082b0808190819, 0x08082b0808191908, 0x08082b080819192b, 0x08082b0808192b19, 0x08082b08082b0808, 0x08082b08082b1919,
  0x08082b08082b2b2b, 0x08082b0819080819, 0x08082b0819081908, 0x08082b081908192b, 0x08082b0819082b19, 0x08082b0819190808, 0x08082b081919082b, 0x08082b0819191919,
  0x08082b0819192b08, 0x08082b08192b0819, 0x08082b08192b1908, 0x08082b082b080808, 0x08082b082b081919, 0x08082b082b191908, 0x08082b082b2b2b2b, 0x08082b1908080819,
  0x08082b1908081908, 0x08082b1908190808, 0x08082b190819082b, 0x08082b1908191919, 0x08082b1908192b08, 0x08082b19082b0819, 0x08082b1919080808, 0x08082b1919081919,
  0x08082b1919082b08, 0x08082b1919190819, 0x08082b1919191908, 0x08082b19192b0808, 0x08082b192b080819, 0x08082b192b190808, 0x08082b2b08080808, 0x08082b2b08190819,
  0x08082b2b08191908, 0x08082b2b082b082b, 0x08082b2b082b2b08, 0x08082b2b082b2b2b, 0x08082b2b19190808, 0x08082b2b2b192b19, 0x0819080808080819, 0x0819080808081908,
  0x081908080808192b, 0x0819080808082b19, 0x0819080808190808, 0x081908080819082b, 0x0819080808191919, 0x0819080808192b08, 0x08190808082b0819, 0x08190808082b1908,
  0x08190808082b192b, 0x0819080819080808, 0x081908081908082b, 0x0819080819081919, 0x0819080819082b08, 0x0819080819190819, 0x0819080819191908, 0x081908081919192b,
  0x0819080819192b19, 0x08190808192b0808, 0x08190808192b082b, 0x08190808192b1919, 0x08190808192b2b08, 0x081908082b080819, 0x081908082b081908, 0x081908082b08192b,
  0x081908082b190808, 0x081908082b191919, 0x081908082b192b08, 0x081908082b2b0819, 0x081908082b2b1908, 0x0819081908080808, 0x081908190808082b, 0x0819081908081919,
  0x0819081908082b08, 0x0819081908082b2b, 0x0819081908190819, 0x0819081908191908, 0x081908190819192b, 0x0819081908192b19, 0x08190819082b0808, 0x08190819082b082b,
  0x08190819082b1919, 0x08190819082b2b08, 0x0819081919080819, 0x0819081919081908, 0x081908191908192b, 0x0819081919082b19, 0x0819081919190808, 0x081908191919082b,
  0x0819081919191919, 0x0819081919192b08, 0x08190819192b0819, 0x08190819192b1908, 0x081908192b080808, 0x081908192b08082b, 0x081908192b081919, 0x081908192b082b08,
  0x081908192b190819, 0x081908192b191908, 0x0819082b08080819, 0x0819082b08081908, 0x0819082b08082b19, 0x0819082b08190808, 0x0819082b08191919, 0x0819082b082b0819,
  0x0819082b082b1908, 0x0819082b19080808, 0x0819082b19081919, 0x0819082b19190819, 0x0819082b19191908, 0x0819082b2b080819, 0x0819082b2b081908, 0x0819082b2b190808,
  0x0819190808080808, 0x081919080808082b, 0x0819190808081919, 0x0819190808082b08, 0x0819190808190819, 0x0819190808191908, 0x081919080819192b, 0x0819190808192b19,
  0x08191908082b0808, 0x08191908082b1919, 0x08191908082b2b08, 0x0819190819080819, 0x0819190819081908, 0x081919081908192b, 0x0819190819082b19, 0x0819190819190808,
  0x081919081919082b, 0x0819190819191919, 0x0819190819192b08, 0x08191908192b0819, 0x08191908192b1908, 0x081919082b080808, 0x081919082b08082b, 0x081919082b081919,
  0x081919082b082b08, 0x081919082b190819, 0x081919082b191908, 0x081919082b2b0808, 0x0819191908080819, 0x0819191908081908, 0x081919190808192b, 0x0819191908082b19,
  0x0819191908190808, 0x081919190819082b, 0x0819191908191919, 0x0819191908192b08, 0x08191919082b0819, 0x08191919082b1908, 0x0819191919080808, 0x081919191908082b,
  0x0819191919081919, 0x0819191919082b08, 0x0819191919190819, 0x0819191919191908, 0x08191919192b0808, 0x081919192b080819, 0x081919192b081908, 0x081919192b190808,
  0x0819192b08080808, 0x0819192b08081919, 0x0819192b08082b08, 0x0819192b08190819, 0x0819192b08191908, 0x0819192b082b0808, 0x0819192b19080819, 0x0819192b19081908,
  0x0819192b19190808, 0x0819192b2b080808, 0x0819192b2b2b2b2b, 0x08192b0808080819, 0x08192b0808081908, 0x08192b080808192b, 0x08192b0808082b19, 0x08192b0808190808,
  0x08192b0808191919, 0x08192b0808192b08, 0x08192b08082b0819, 0x08192b0819080808, 0x08192b081908082b, 0x08192b0819081919, 0x08192b0819082b08, 0x08192b0819190819,
  0x08192b0819191908, 0x08192b08192b0808, 0x08192b082b080819, 0x08192b082b081908, 0x08192b1908080808, 0x08192b190808082b, 0x08192b1908081919, 0x08192b1908082b08,
  0x08192b1908190819, 0x08192b1908191908, 0x08192b19082b0808, 0x08192b1919080819, 0x08192b1919081908, 0x08192b1919190808, 0x08192b19192b2b19, 0x08192b192b2b082b,
  0x08192b2b08081908, 0x08192b2b08190808, 0x08192b2b19080808, 0x08192b2b1919192b, 0x082b080808080808, 0x082b08080808082b, 0x082b080808081919, 0x082b080808082b08,
  0x082b080808190819, 0x082b080808191908, 0x082b08080819192b, 0x082b080808192b19, 0x082b0808082b0808, 0x082b0808082b1919, 0x082b0808082b2b2b, 0x082b080819080819,
  0x082b080819081908, 0x082b080819190808, 0x082b08081919082b, 0x082b080819191919, 0x082b0808192b1908, 0x082b08082b080808, 0x082b08082b082b2b, 0x082b08082b191908,
  0x082b08082b2b2b2b, 0x082b081908080819, 0x082b081908081908, 0x082b081908190808, 0x082b08190819082b, 0x082b081908191919, 0x082b0819082b0819, 0x082b081919080808,
  0x082b08191908082b, 0x082b081919081919, 0x082b081919190819, 0x082b081919191908, 0x082b0819192b0808, 0x082b08192b080819, 0x082b08192b081908, 0x082b08192b190808,
  0x082b082b08080808, 0x082b082b08082b2b, 0x082b082b082b082b, 0x082b082b082b2b08, 0x082b082b082b2b2b, 0x082b082b19081908, 0x082b082b19190808, 0x082b082b2b082b08,
  0x082b082b2b082b2b, 0x082b082b2b2b2b08, 0x082b190808080819, 0x082b190808081908, 0x082b19080808192b, 0x082b190808082b19, 0x082b190808190808, 0x082b190808191919,
  0x082b190808192b08, 0x082b1908082b0819, 0x082b1908082b1908, 0x082b190819080808, 0x082b19081908082b, 0x082b190819081919, 0x082b190819082b08, 0x082b190819190819,
  0x082b190819191908, 0x082b1908192b0808, 0x082b19082b080819, 0x082b19082b081908, 0x082b19082b190808, 0x082b191908080808, 0x082b191908081919, 0x082b191908082b08,
  0x082b191908190819, 0x082b191908191908, 0x082b1919082b0808, 0x082b191919080819, 0x082b191919081908, 0x082b191919190808, 0x082b1919192b192b, 0x082b19192b080808,
  0x082b192b08080819, 0x082b192b08081908, 0x082b192b08190808, 0x082b192b19080808, 0x082b192b19192b19, 0x082b2b0808080808, 0x082b2b0808081919, 0x082b2b0808190819,
  0x082b2b0808191908, 0x082b2b0819080819, 0x082b2b0819081908, 0x082b2b0819190808, 0x082b2b082b082b2b, 0x082b2b082b2b2b2b, 0x082b2b1908080819, 0x082b2b1908081908,
  0x082b2b1908190808, 0x082b2b192b191919, 0x082b2b2b08082b2b, 0x082b2b2b082b082b, 0x082b2b2b192b1908, 0x082b2b2b2b082b08, 0x082b2b2b2b082b2b, 0x1908080808080819,
  0x1908080808081908, 0x190808080808192b, 0x1908080808082b19, 0x1908080808190808, 0x190808080819082b, 0x1908080808191919, 0x1908080808192b08, 0x1908080808192b2b,
  0x19080808082b0819, 0x19080808082b1908, 0x19080808082b192b, 0x1908080819080808, 0x190808081908082b, 0x1908080819081919, 0x1908080819082b08, 0x1908080819082b2b,
  0x1908080819190819, 0x1908080819191908, 0x190808081919192b, 0x1908080819192b19, 0x19080808192b0808, 0x19080808192b082b, 0x19080808192b1919, 0x190808082b080819,
  0x190808082b081908, 0x190808082b190808, 0x190808082b191919, 0x190808082b192b08, 0x190808082b2b0819, 0x190808082b2b1908, 0x1908081908080808, 0x190808190808082b,
  0x1908081908081919, 0x1908081908082b08, 0x1908081908190819, 0x1908081908191908, 0x190808190819192b, 0x1908081908192b19, 0x19080819082b0808, 0x19080819082b082b,
  0x19080819082b1919, 0x1908081919080819, 0x1908081919081908, 0x190808191908192b, 0x1908081919082b19, 0x1908081919190808, 0x190808191919082b, 0x1908081919191919,
  0x1908081919192b08, 0x19080819192b0819, 0x19080819192b1908, 0x190808192b080808, 0x190808192b08082b, 0x190808192b081919, 0x190808192b082b08, 0x190808192b190819,
  0x190808192b191908, 0x190808192b2b0808, 0x1908082b08080819, 0x1908082b08081908, 0x1908082b08190808, 0x1908082b0819082b, 0x1908082b08191919, 0x1908082b08192b08,
  0x1908082b082b1908, 0x1908082b19080808, 0x1908082b19081919, 0x1908082b19082b08, 0x1908082b19190819, 0x1908082b19191908, 0x1908082b192b0808, 0x1908082b2b080819,
  0x1908082b2b081908, 0x1908190808080808, 0x190819080808082b, 0x1908190808081919, 0x1908190808082b08, 0x1908190808082b2b, 0x1908190808190819, 0x1908190808191908,
  0x190819080819192b, 0x1908190808192b19, 0x19081908082b0808, 0x19081908082b082b, 0x19081908082b1919, 0x19081908082b2b08, 0x1908190819080819, 0x1908190819081908,
  0x190819081908192b, 0x1908190819082b19, 0x1908190819190808, 0x190819081919082b, 0x1908190819191919, 0x1908190819192b08, 0x19081908192b0819, 0x19081908192b1908,
  0x190819082b080808, 0x190819082b08082b, 0x190819082b081919, 0x190819082b082b08, 0x190819082b190819, 0x190819082b191908, 0x190819082b2b0808, 0x1908191908080819,
  0x1908191908081908, 0x190819190808192b, 0x1908191908082b19, 0x1908191908190808, 0x190819190819082b, 0x1908191908191919, 0x1908191908192b08, 0x19081919082b0819,
  0x19081919082b1908, 0x1908191919080808, 0x190819191908082b, 0x1908191919081919, 0x1908191919082b08, 0x1908191919190819, 0x1908191919191908, 0x19081919192b0808,
  0x19081919192b2b2b, 0x190819192b080819, 0x190819192b081908, 0x190819192b190808, 0x1908192b08080808, 0x1908192b0808082b, 0x1908192b08081919, 0x1908192b08082b08,
  0x1908192b08190819, 0x1908192b08191908, 0x1908192b082b0808, 0x1908192b19080819, 0x1908192b19081908, 0x1908192b19190808, 0x1908192b2b080808, 0x1908192b2b2b1919,
  0x19082b0808080819, 0x19082b0808081908, 0x19082b0808082b19, 0x19082b0808190808, 0x19082b080819082b, 0x19082b0808191919, 0x19082b0808192b08, 0x19082b08082b0819,
  0x19082b08082b1908, 0x19082b0819080808, 0x19082b081908082b, 0x19082b0819081919, 0x19082b0819082b08, 0x19082b0819190819, 0x19082b0819191908, 0x19082b08192b0808,
  0x19082b082b081908, 0x19082b082b190808, 0x19082b1908080808, 0x19082b190808082b, 0x19082b1908081919, 0x19082b1908082b08, 0x19082b1908190819, 0x19082b1908191908,
  0x19082b19082b0808, 0x19082b1919080819, 0x19082b1919081908, 0x19082b1919190808, 0x19082b192b080808, 0x19082b192b19192b, 0x19082b2b08080819, 0x19082b2b08081908,
  0x19082b2b08190808, 0x19082b2b19080808, 0x1919080808080808, 0x191908080808082b, 0x1919080808081919, 0x1919080808082b08, 0x1919080808190819, 0x1919080808191908,
  0x191908080819192b, 0x1919080808192b19, 0x19190808082b0808, 0x19190808082b082b, 0x19190808082b1919, 0x19190808082b2b08, 0x1919080819080819, 0x1919080819081908,
  0x191908081908192b, 0x1919080819082b19, 0x1919080819190808, 0x191908081919082b, 0x1919080819191919, 0x1919080819192b08, 0x19190808192b0819, 0x19190808192b1908,
  0x191908082b080808, 0x191908082b08082b, 0x191908082b081919, 0x191908082b082b08, 0x191908082b190819, 0x191908082b191908, 0x1919081908080819, 0x1919081908081908,
  0x191908190808192b, 0x1919081908082b19, 0x1919081908190808, 0x191908190819082b, 0x1919081908191919, 0x1919081908192b08, 0x19190819082b0819, 0x19190819082b1908,
  0x1919081919080808, 0x191908191908082b, 0x1919081919081919, 0x1919081919082b08, 0x1919081919190819, 0x1919081919191908, 0x19190819192b0808, 0x191908192b080819,
  0x191908192b081908, 0x191908192b190808, 0x1919082b08080808, 0x1919082b08081919, 0x1919082b08082b08, 0x1919082b08190819, 0x1919082b08191908, 0x1919082b082b0808,
  0x1919082b19080819, 0x1919082b19081908, 0x1919082b19190808, 0x1919082b192b2b19, 0x1919082b2b080808, 0x1919190808080819, 0x1919190808081908, 0x191919080808192b,
  0x1919190808082b19, 0x1919190808190808, 0x191919080819082b, 0x1919190808191919, 0x1919190808192b08, 0x19191908082b0819, 0x19191908082b1908, 0x1919190819080808,
  0x191919081908082b, 0x1919190819081919, 0x1919190819082b08, 0x1919190819190819, 0x1919190819191908, 0x19191908192b0808, 0x191919082b080819, 0x191919082b081908,
  0x191919082b190808, 0x1919191908080808, 0x191919190808082b, 0x1919191908081919, 0x1919191908082b08, 0x1919191908190819, 0x1919191908191908, 0x19191919082b0808,
  0x1919191919080819, 0x1919191919081908, 0x1919191919190808, 0x191919192b080808, 0x1919192b08080819, 0x1919192b08081908, 0x1919192b08190808, 0x1919192b082b192b,
  0x1919192b19080808, 0x19192b0808080808, 0x19192b080808082b, 0x19192b0808081919, 0x19192b0808082b08, 0x19192b0808190819, 0x19192b0808191908, 0x19192b08082b0808,
  0x19192b0819080819, 0x19192b0819081908, 0x19192b0819190808, 0x19192b0819192b2b, 0x19192b082b080808, 0x19192b1908080819, 0x19192b1908081908, 0x19192b1908190808,
  0x19192b1919080808, 0x19192b2b08080808, 0x19192b2b08192b19, 0x19192b2b2b081919, 0x19192b2b2b2b2b08, 0x192b080808080819, 0x192b080808081908, 0x192b08080808192b,
  0x192b080808190808, 0x192b08080819082b, 0x192b080808191919, 0x192b080808192b08, 0x192b0808082b0819, 0x192b0808082b1908, 0x192b080819080808, 0x192b080819081919,
  0x192b080819082b08, 0x192b080819190819, 0x192b080819191908, 0x192b0808192b0808, 0x192b08082b081908, 0x192b08082b190808, 0x192b081908080808, 0x192b08190808082b,
  0x192b081908081919, 0x192b081908082b08, 0x192b081908190819, 0x192b081908191908, 0x192b0819082b0808, 0x192b081919080819, 0x192b081919081908, 0x192b081919190808,
  0x192b08192b080808, 0x192b08192b192b19, 0x192b082b08081908, 0x192b082b08190808, 0x192b082b19080808, 0x192b082b1919192b, 0x192b082b2b2b0819, 0x192b190808080808,
  0x192b190808081919, 0x192b190808082b08, 0x192b190808190819, 0x192b190808191908, 0x192b1908082b0808, 0x192b190819080819, 0x192b190819081908, 0x192b190819190808,
  0x192b19082b080808, 0x192b191908080819, 0x192b191908081908, 0x192b191908190808, 0x192b191919080808, 0x192b191919082b2b, 0x192b1919192b2b08, 0x192b19192b19082b,
  0x192b192b08080808, 0x192b192b2b191908, 0x192b2b0808080819, 0x192b2b0808081908, 0x192b2b0808190808, 0x192b2b08192b1919, 0x192b2b082b192b08, 0x192b2b1908080808,
  0x192b2b19082b2b2b, 0x192b2b2b1908082b, 0x192b2b2b2b2b0819, 0x2b08080808080808, 0x2b0808080808082b, 0x2b08080808081919, 0x2b08080808082b08, 0x2b08080808190819,
  0x2b08080808191908, 0x2b08080808192b19, 0x2b080808082b0808, 0x2b080808082b1919, 0x2b08080819080819, 0x2b08080819081908, 0x2b08080819190808, 0x2b0808081919082b,
  0x2b08080819191919, 0x2b08080819192b08, 0x2b080808192b0819, 0x2b0808082b080808, 0x2b0808082b081919, 0x2b0808082b190819, 0x2b0808082b191908, 0x2b08081908080819,
  0x2b08081908081908, 0x2b08081908082b19, 0x2b08081908190808, 0x2b0808190819082b, 0x2b08081908191919, 0x2b08081908192b08, 0x2b080819082b0819, 0x2b080819082b1908,
  0x2b08081919080808, 0x2b0808191908082b, 0x2b08081919081919, 0x2b08081919082b08, 0x2b08081919190819, 0x2b08081919191908, 0x2b0808192b080819, 0x2b0808192b081908,
  0x2b0808192b190808, 0x2b0808192b2b2b19, 0x2b08082b08080808, 0x2b08082b08081919, 0x2b08082b08082b2b, 0x2b08082b08190819, 0x2b08082b08191908, 0x2b08082b19080819,
  0x2b08082b19081908, 0x2b08082b19190808, 0x2b08190808080819, 0x2b08190808081908, 0x2b0819080808192b, 0x2b08190808082b19, 0x2b08190808190808, 0x2b0819080819082b,
  0x2b08190808191919, 0x2b08190808192b08, 0x2b081908082b0819, 0x2b08190819080808, 0x2b0819081908082b, 0x2b08190819081919, 0x2b08190819082b08, 0x2b08190819190819,
  0x2b08190819191908, 0x2b081908192b0808, 0x2b0819082b080819, 0x2b0819082b081908, 0x2b0819082b190808, 0x2b08191908080808, 0x2b0819190808082b, 0x2b08191908081919,
  0x2b08191908082b08, 0x2b08191908190819, 0x2b08191908191908, 0x2b081919082b0808, 0x2b08191919080819, 0x2b08191919081908, 0x2b08191919190808, 0x2b0819192b080808,
  0x2b0819192b082b2b, 0x2b08192b08080819, 0x2b08192b08081908, 0x2b08192b08190808, 0x2b08192b082b2b19, 0x2b08192b19080808, 0x2b082b0808080808, 0x2b082b0808081919,
  0x2b082b0808190819, 0x2b082b0808191908, 0x2b082b0819080819, 0x2b082b0819081908, 0x2b082b0819190808, 0x2b082b082b2b082b, 0x2b082b1908080819, 0x2b082b1908081908,
  0x2b082b1919080808, 0x2b082b19192b1919, 0x2b082b2b082b082b, 0x2b082b2b19192b08, 0x2b082b2b19192b2b, 0x2b082b2b2b08082b, 0x2b082b2b2b2b082b, 0x2b19080808080819,
  0x2b19080808081908, 0x2b19080808082b19, 0x2b19080808190808, 0x2b1908080819082b, 0x2b19080808191919, 0x2b19080808192b08, 0x2b190808082b1908, 0x2b19080819080808,
  0x2b1908081908082b, 0x2b19080819081919, 0x2b19080819082b08, 0x2b19080819190819, 0x2b19080819191908, 0x2b190808192b0808, 0x2b1908082b080819, 0x2b1908082b081908,
  0x2b1908082b190808, 0x2b19081908080808, 0x2b19081908081919, 0x2b19081908190819, 0x2b19081908191908, 0x2b19081919080819, 0x2b19081919081908, 0x2b19081919190808,
  0x2b19081919192b2b, 0x2b19082b08080819, 0x2b19082b08081908, 0x2b19082b08190808, 0x2b19082b19080808, 0x2b19082b2b2b192b, 0x2b19190808080808, 0x2b1919080808082b,
  0x2b19190808081919, 0x2b19190808082b08, 0x2b19190808190819, 0x2b19190808191908, 0x2b191908082b0808, 0x2b19190819080819, 0x2b19190819081908, 0x2b19190819190808,
  0x2b1919082b080808, 0x2b1919082b19192b, 0x2b19191908080819, 0x2b19191908081908, 0x2b19191908190808, 0x2b19191919080808, 0x2b1919192b192b08, 0x2b1919192b2b0819,
  0x2b19192b08080808, 0x2b19192b1908192b, 0x2b19192b192b1908, 0x2b192b0808080819, 0x2b192b0808081908, 0x2b192b0808190808, 0x2b192b08082b192b, 0x2b192b0819080808,
  0x2b192b082b2b2b19, 0x2b192b1908080808, 0x2b192b1919082b19, 0x2b192b191919082b, 0x2b192b2b2b190808, 0x2b2b080808080808, 0x2b2b080808081919, 0x2b2b080808082b2b,
  0x2b2b080808191908, 0x2b2b0808082b082b, 0x2b2b0808082b2b2b, 0x2b2b080819080819, 0x2b2b080819081908, 0x2b2b080819190808, 0x2b2b08082b2b082b, 0x2b2b08082b2b2b2b,
  0x2b2b081919080808, 0x2b2b0819192b1919, 0x2b2b082b0808082b, 0x2b2b082b08082b2b, 0x2b2b082b082b082b, 0x2b2b082b082b2b08, 0x2b2b082b082b2b2b, 0x2b2b082b2b08082b,
  0x2b2b082b2b082b08, 0x2b2b082b2b082b2b, 0x2b2b082b2b2b2b08, 0x2b2b190808080819, 0x2b2b190808081908, 0x2b2b190808190808, 0x2b2b190819080808, 0x2b2b19082b082b19,
  0x2b2b19082b2b1908, 0x2b2b191908080808, 0x2b2b191908192b19, 0x2b2b192b19190819, 0x2b2b2b0808082b2b, 0x2b2b2b08082b2b08, 0x2b2b2b082b2b082b, 0x2b2b2b1919191908,
  0x2b2b2b192b08192b, 0x2b2b2b2b08082b08, 0x2b2b2b2b08082b2b, 0x2b2b2b2b082b0808, 0x2b2b2b2b082b082b, 0x2b2b2b2b082b2b08, 0x2b2b2b2b2b082b08, 0x2b2b2b2b2b2b2b2b,
]);

const IQ3_XXS_LUT: StaticArray<u32> = StaticArray.fromArray<u32>([
  0x04040404, 0x04040414, 0x04040424, 0x04040c0c, 0x04040c1c, 0x04040c3e, 0x04041404, 0x04041414,
  0x04041c0c, 0x04042414, 0x04043e1c, 0x04043e2c, 0x040c040c, 0x040c041c, 0x040c0c04, 0x040c0c14,
  0x040c140c, 0x040c142c, 0x040c1c04, 0x040c1c14, 0x040c240c, 0x040c2c24, 0x040c3e04, 0x04140404,
  0x04140414, 0x04140424, 0x04140c0c, 0x04141404, 0x04141414, 0x04141c0c, 0x04141c1c, 0x04141c3e,
  0x04142c0c, 0x04142c3e, 0x04143e2c, 0x041c040c, 0x041c043e, 0x041c0c04, 0x041c0c14, 0x041c142c,
  0x041c3e04, 0x04240c1c, 0x04241c3e, 0x04242424, 0x04242c3e, 0x04243e1c, 0x04243e2c, 0x042c040c,
  0x042c043e, 0x042c1c14, 0x042c2c14, 0x04341c2c, 0x04343424, 0x043e0c04, 0x043e0c24, 0x043e0c34,
  0x043e241c, 0x043e340c, 0x0c04040c, 0x0c04041c, 0x0c040c04, 0x0c040c14, 0x0c04140c, 0x0c04141c,
  0x0c041c04, 0x0c041c14, 0x0c041c24, 0x0c04243e, 0x0c042c04, 0x0c0c0404, 0x0c0c0414, 0x0c0c0c0c,
  0x0c0c1404, 0x0c0c1414, 0x0c14040c, 0x0c14041c, 0x0c140c04, 0x0c140c14, 0x0c14140c, 0x0c141c04,
  0x0c143e14, 0x0c1c0404, 0x0c1c0414, 0x0c1c1404, 0x0c1c1c0c, 0x0c1c2434, 0x0c1c3434, 0x0c24040c,
  0x0c24042c, 0x0c242c04, 0x0c2c1404, 0x0c2c1424, 0x0c2c2434, 0x0c2c3e0c, 0x0c34042c, 0x0c3e1414,
  0x0c3e2404, 0x14040404, 0x14040414, 0x14040c0c, 0x14040c1c, 0x14041404, 0x14041414, 0x14041434,
  0x14041c0c, 0x14042414, 0x140c040c, 0x140c041c, 0x140c042c, 0x140c0c04, 0x140c0c14, 0x140c140c,
  0x140c1c04, 0x140c341c, 0x140c343e, 0x140c3e04, 0x14140404, 0x14140414, 0x14140c0c, 0x14140c3e,
  0x14141404, 0x14141414, 0x14141c3e, 0x14142404, 0x14142c2c, 0x141c040c, 0x141c0c04, 0x141c0c24,
  0x141c3e04, 0x141c3e24, 0x14241c2c, 0x14242c1c, 0x142c041c, 0x142c143e, 0x142c240c, 0x142c3e24,
  0x143e040c, 0x143e041c, 0x143e0c34, 0x143e242c, 0x1c04040c, 0x1c040c04, 0x1c040c14, 0x1c04140c,
  0x1c04141c, 0x1c042c04, 0x1c04342c, 0x1c043e14, 0x1c0c0404, 0x1c0c0414, 0x1c0c1404, 0x1c0c1c0c,
  0x1c0c2424, 0x1c0c2434, 0x1c14040c, 0x1c14041c, 0x1c140c04, 0x1c14142c, 0x1c142c14, 0x1c143e14,
  0x1c1c0c0c, 0x1c1c1c1c, 0x1c241c04, 0x1c24243e, 0x1c243e14, 0x1c2c0404, 0x1c2c0434, 0x1c2c1414,
  0x1c2c2c2c, 0x1c340c24, 0x1c341c34, 0x1c34341c, 0x1c3e1c1c, 0x1c3e3404, 0x24040424, 0x24040c3e,
  0x24041c2c, 0x24041c3e, 0x24042c1c, 0x24042c3e, 0x240c3e24, 0x24141404, 0x24141c3e, 0x24142404,
  0x24143404, 0x24143434, 0x241c043e, 0x241c242c, 0x24240424, 0x24242c0c, 0x24243424, 0x242c142c,
  0x242c241c, 0x242c3e04, 0x243e042c, 0x243e0c04, 0x243e0c14, 0x243e1c04, 0x2c040c14, 0x2c04240c,
  0x2c043e04, 0x2c0c0404, 0x2c0c0434, 0x2c0c1434, 0x2c0c2c2c, 0x2c140c24, 0x2c141c14, 0x2c143e14,
  0x2c1c0414, 0x2c1c2c1c, 0x2c240c04, 0x2c24141c, 0x2c24143e, 0x2c243e14, 0x2c2c0414, 0x2c2c1c0c,
  0x2c342c04, 0x2c3e1424, 0x2c3e2414, 0x34041424, 0x34042424, 0x34042434, 0x34043424, 0x340c140c,
  0x340c340c, 0x34140c3e, 0x34143424, 0x341c1c04, 0x341c1c34, 0x34242424, 0x342c042c, 0x342c2c14,
  0x34341c1c, 0x343e041c, 0x343e140c, 0x3e04041c, 0x3e04042c, 0x3e04043e, 0x3e040c04, 0x3e041c14,
  0x3e042c14, 0x3e0c1434, 0x3e0c2404, 0x3e140c14, 0x3e14242c, 0x3e142c14, 0x3e1c0404, 0x3e1c0c2c,
  0x3e1c1c1c, 0x3e1c3404, 0x3e24140c, 0x3e24240c, 0x3e2c0404, 0x3e2c0414, 0x3e2c1424, 0x3e341c04,
]);

const IQ3_S_LUT: StaticArray<u32> = StaticArray.fromArray<u32>([
  0x01010101, 0x01010103, 0x01010105, 0x0101010b, 0x0101010f, 0x01010301, 0x01010303, 0x01010305,
  0x01010309, 0x0101030d, 0x01010501, 0x01010503, 0x0101050b, 0x01010707, 0x01010901, 0x01010905,
  0x0101090b, 0x0101090f, 0x01010b03, 0x01010b07, 0x01010d01, 0x01010d05, 0x01010f03, 0x01010f09,
  0x01010f0f, 0x01030101, 0x01030103, 0x01030105, 0x01030109, 0x01030301, 0x01030303, 0x0103030b,
  0x01030501, 0x01030507, 0x0103050f, 0x01030703, 0x0103070b, 0x01030909, 0x01030d03, 0x01030d0b,
  0x01030f05, 0x01050101, 0x01050103, 0x0105010b, 0x0105010f, 0x01050301, 0x01050307, 0x0105030d,
  0x01050503, 0x0105050b, 0x01050701, 0x01050709, 0x01050905, 0x0105090b, 0x0105090f, 0x01050b03,
  0x01050b07, 0x01050f01, 0x01050f07, 0x01070107, 0x01070303, 0x0107030b, 0x01070501, 0x01070505,
  0x01070703, 0x01070707, 0x0107070d, 0x01070909, 0x01070b01, 0x01070b05, 0x01070d0f, 0x01070f03,
  0x01070f0b, 0x01090101, 0x01090307, 0x0109030f, 0x01090503, 0x01090509, 0x01090705, 0x01090901,
  0x01090907, 0x01090b03, 0x01090f01, 0x010b0105, 0x010b0109, 0x010b0501, 0x010b0505, 0x010b050d,
  0x010b0707, 0x010b0903, 0x010b090b, 0x010b090f, 0x010b0d0d, 0x010b0f07, 0x010d010d, 0x010d0303,
  0x010d0307, 0x010d0703, 0x010d0b05, 0x010d0f03, 0x010f0101, 0x010f0105, 0x010f0109, 0x010f0501,
  0x010f0505, 0x010f050d, 0x010f0707, 0x010f0b01, 0x010f0b09, 0x03010101, 0x03010103, 0x03010105,
  0x03010109, 0x03010301, 0x03010303, 0x03010307, 0x0301030b, 0x0301030f, 0x03010501, 0x03010505,
  0x03010703, 0x03010709, 0x0301070d, 0x03010b09, 0x03010b0d, 0x03010d03, 0x03010f05, 0x03030101,
  0x03030103, 0x03030107, 0x0303010d, 0x03030301, 0x03030309, 0x03030503, 0x03030701, 0x03030707,
  0x03030903, 0x03030b01, 0x03030b05, 0x03030f01, 0x03030f0d, 0x03050101, 0x03050305, 0x0305030b,
  0x0305030f, 0x03050501, 0x03050509, 0x03050705, 0x03050901, 0x03050907, 0x03050b0b, 0x03050d01,
  0x03050f05, 0x03070103, 0x03070109, 0x0307010f, 0x03070301, 0x03070307, 0x03070503, 0x0307050f,
  0x03070701, 0x03070709, 0x03070903, 0x03070d05, 0x03070f01, 0x03090107, 0x0309010b, 0x03090305,
  0x03090309, 0x03090703, 0x03090707, 0x03090905, 0x0309090d, 0x03090b01, 0x03090b09, 0x030b0103,
  0x030b0301, 0x030b0307, 0x030b0503, 0x030b0701, 0x030b0705, 0x030b0b03, 0x030d0501, 0x030d0509,
  0x030d050f, 0x030d0909, 0x030d090d, 0x030f0103, 0x030f0107, 0x030f0301, 0x030f0305, 0x030f0503,
  0x030f070b, 0x030f0903, 0x030f0d05, 0x030f0f01, 0x05010101, 0x05010103, 0x05010107, 0x0501010b,
  0x0501010f, 0x05010301, 0x05010305, 0x05010309, 0x0501030d, 0x05010503, 0x05010507, 0x0501050f,
  0x05010701, 0x05010705, 0x05010903, 0x05010907, 0x0501090b, 0x05010b01, 0x05010b05, 0x05010d0f,
  0x05010f01, 0x05010f07, 0x05010f0b, 0x05030101, 0x05030105, 0x05030301, 0x05030307, 0x0503030f,
  0x05030505, 0x0503050b, 0x05030703, 0x05030709, 0x05030905, 0x05030b03, 0x05050103, 0x05050109,
  0x0505010f, 0x05050503, 0x05050507, 0x05050701, 0x0505070f, 0x05050903, 0x05050b07, 0x05050b0f,
  0x05050f03, 0x05050f09, 0x05070101, 0x05070105, 0x0507010b, 0x05070303, 0x05070505, 0x05070509,
  0x05070703, 0x05070707, 0x05070905, 0x05070b01, 0x05070d0d, 0x05090103, 0x0509010f, 0x05090501,
  0x05090507, 0x05090705, 0x0509070b, 0x05090903, 0x05090f05, 0x05090f0b, 0x050b0109, 0x050b0303,
  0x050b0505, 0x050b070f, 0x050b0901, 0x050b0b07, 0x050b0f01, 0x050d0101, 0x050d0105, 0x050d010f,
  0x050d0503, 0x050d0b0b, 0x050d0d03, 0x050f010b, 0x050f0303, 0x050f050d, 0x050f0701, 0x050f0907,
  0x050f0b01, 0x07010105, 0x07010303, 0x07010307, 0x0701030b, 0x0701030f, 0x07010505, 0x07010703,
  0x07010707, 0x0701070b, 0x07010905, 0x07010909, 0x0701090f, 0x07010b03, 0x07010d07, 0x07010f03,
  0x07030103, 0x07030107, 0x0703010b, 0x07030309, 0x07030503, 0x07030507, 0x07030901, 0x07030d01,
  0x07030f05, 0x07030f0d, 0x07050101, 0x07050305, 0x07050501, 0x07050705, 0x07050709, 0x07050b01,
  0x07070103, 0x07070301, 0x07070309, 0x07070503, 0x07070507, 0x0707050f, 0x07070701, 0x07070903,
  0x07070907, 0x0707090f, 0x07070b0b, 0x07070f07, 0x07090107, 0x07090303, 0x0709030d, 0x07090505,
  0x07090703, 0x07090b05, 0x07090d01, 0x07090d09, 0x070b0103, 0x070b0301, 0x070b0305, 0x070b050b,
  0x070b0705, 0x070b0909, 0x070b0b0d, 0x070b0f07, 0x070d030d, 0x070d0903, 0x070f0103, 0x070f0107,
  0x070f0501, 0x070f0505, 0x070f070b, 0x09010101, 0x09010109, 0x09010305, 0x09010501, 0x09010509,
  0x0901050f, 0x09010705, 0x09010903, 0x09010b01, 0x09010f01, 0x09030105, 0x0903010f, 0x09030303,
  0x09030307, 0x09030505, 0x09030701, 0x0903070b, 0x09030907, 0x09030b03, 0x09030b0b, 0x09050103,
  0x09050107, 0x09050301, 0x0905030b, 0x09050503, 0x09050707, 0x09050901, 0x09050b0f, 0x09050d05,
  0x09050f01, 0x09070109, 0x09070303, 0x09070307, 0x09070501, 0x09070505, 0x09070703, 0x0907070b,
  0x09090101, 0x09090105, 0x09090509, 0x0909070f, 0x09090901, 0x09090f03, 0x090b010b, 0x090b010f,
  0x090b0503, 0x090b0d05, 0x090d0307, 0x090d0709, 0x090d0d01, 0x090f0301, 0x090f030b, 0x090f0701,
  0x090f0907, 0x090f0b03, 0x0b010105, 0x0b010301, 0x0b010309, 0x0b010505, 0x0b010901, 0x0b010909,
  0x0b01090f, 0x0b010b05, 0x0b010d0d, 0x0b010f09, 0x0b030103, 0x0b030107, 0x0b03010b, 0x0b030305,
  0x0b030503, 0x0b030705, 0x0b030f05, 0x0b050101, 0x0b050303, 0x0b050507, 0x0b050701, 0x0b05070d,
  0x0b050b07, 0x0b070105, 0x0b07010f, 0x0b070301, 0x0b07050f, 0x0b070909, 0x0b070b03, 0x0b070d0b,
  0x0b070f07, 0x0b090103, 0x0b090109, 0x0b090501, 0x0b090705, 0x0b09090d, 0x0b0b0305, 0x0b0b050d,
  0x0b0b0b03, 0x0b0b0b07, 0x0b0d0905, 0x0b0f0105, 0x0b0f0109, 0x0b0f0505, 0x0d010303, 0x0d010307,
  0x0d01030b, 0x0d010703, 0x0d010707, 0x0d010d01, 0x0d030101, 0x0d030501, 0x0d03050f, 0x0d030d09,
  0x0d050305, 0x0d050709, 0x0d050905, 0x0d050b0b, 0x0d050d05, 0x0d050f01, 0x0d070101, 0x0d070309,
  0x0d070503, 0x0d070901, 0x0d09050b, 0x0d090907, 0x0d090d05, 0x0d0b0101, 0x0d0b0107, 0x0d0b0709,
  0x0d0b0d01, 0x0d0d010b, 0x0d0d0901, 0x0d0f0303, 0x0d0f0307, 0x0f010101, 0x0f010109, 0x0f01010f,
  0x0f010501, 0x0f010505, 0x0f01070d, 0x0f010901, 0x0f010b09, 0x0f010d05, 0x0f030105, 0x0f030303,
  0x0f030509, 0x0f030907, 0x0f03090b, 0x0f050103, 0x0f050109, 0x0f050301, 0x0f05030d, 0x0f050503,
  0x0f050701, 0x0f050b03, 0x0f070105, 0x0f070705, 0x0f07070b, 0x0f070b07, 0x0f090103, 0x0f09010b,
  0x0f090307, 0x0f090501, 0x0f090b01, 0x0f0b0505, 0x0f0b0905, 0x0f0d0105, 0x0f0d0703, 0x0f0f0101,
]);

const IQ1_S_LUT: StaticArray<u64> = StaticArray.fromArray<u64>([
  0xffffffffffffffff, 0xffffffffffffff01, 0xffffffffffff0000, 0xffffffffffff01ff, 0xffffffffffff0101, 0xffffffffff00ff00, 0xffffffffff000000, 0xffffffffff01ffff,
  0xffffffffff01ff01, 0xffffffffff0101ff, 0xffffffffff010101, 0xffffffff00ff0000, 0xffffffff0000ff00, 0xffffffff000000ff, 0xffffffff00000001, 0xffffffff00010000,
  0xffffffff01ffffff, 0xffffffff01ffff01, 0xffffffff01ff01ff, 0xffffffff01ff0101, 0xffffffff01000000, 0xffffffff0101ffff, 0xffffffff0101ff01, 0xffffffff010101ff,
  0xffffffff01010101, 0xffffff00ffff00ff, 0xffffff00ffff0000, 0xffffff00ff00ff00, 0xffffff00ff0000ff, 0xffffff00ff000001, 0xffffff00ff000100, 0xffffff00ff000101,
  0xffffff00ff010000, 0xffffff0000ffff00, 0xffffff0000ff0001, 0xffffff0000ff0100, 0xffffff000000ff01, 0xffffff0000000000, 0xffffff0000000101, 0xffffff000001ff00,
  0xffffff00000100ff, 0xffffff0000010001, 0xffffff00000101ff, 0xffffff0001ff0000, 0xffffff000100ff00, 0xffffff00010000ff, 0xffffff0001000001, 0xffffff0001010000,
  0xffffff01ffffffff, 0xffffff01ffffff01, 0xffffff01ffff01ff, 0xffffff01ffff0101, 0xffffff01ff000000, 0xffffff01ff01ffff, 0xffffff01ff01ff01, 0xffffff01ff0101ff,
  0xffffff01ff010101, 0xffffff0100ff0000, 0xffffff010000ff00, 0xffffff0100000100, 0xffffff01000100ff, 0xffffff0100010100, 0xffffff0101ffffff, 0xffffff0101ffff01,
  0xffffff0101ff01ff, 0xffffff0101ff0101, 0xffffff010100ff00, 0xffffff0101000000, 0xffffff0101000100, 0xffffff010101ffff, 0xffffff010101ff01, 0xffffff01010101ff,
  0xffffff0101010101, 0xffff00ffff00ff00, 0xffff00ffff0000ff, 0xffff00ffff000001, 0xffff00ffff010000, 0xffff00ff00ffff00, 0xffff00ff00ff0100, 0xffff00ff00000000,
  0xffff00ff00000101, 0xffff00ff000100ff, 0xffff00ff00010000, 0xffff00ff0100ff00, 0xffff00ff01000100, 0xffff00ff01010000, 0xffff0000ffffff00, 0xffff0000ffff00ff,
  0xffff0000ffff0000, 0xffff0000ffff0001, 0xffff0000ff000000, 0xffff0000ff0001ff, 0xffff0000ff000101, 0xffff0000ff010100, 0xffff000000ffffff, 0xffff000000ff0000,
  0xffff000000ff0101, 0xffff00000000ffff, 0xffff00000000ff00, 0xffff0000000000ff, 0xffff000000000000, 0xffff000000000001, 0xffff000000000100, 0xffff00000001ffff,
  0xffff00000001ff01, 0xffff000000010000, 0xffff0000000101ff, 0xffff000000010101, 0xffff000001ffff00, 0xffff00000100ff00, 0xffff000001000000, 0xffff0000010001ff,
  0xffff000001000101, 0xffff00000101ff00, 0xffff0000010100ff, 0xffff000001010000, 0xffff000001010001, 0xffff000001010100, 0xffff0001ff0000ff, 0xffff0001ff000100,
  0xffff000100ffff00, 0xffff000100ff00ff, 0xffff00010000ffff, 0xffff00010000ff01, 0xffff000100000000, 0xffff0001000001ff, 0xffff00010001ffff, 0xffff00010001ff00,
  0xffff000100010001, 0xffff000100010100, 0xffff000101ff0000, 0xffff00010100ff00, 0xffff0001010000ff, 0xffff000101000100, 0xffff01ffffffffff, 0xffff01ffffffff01,
  0xffff01ffffff01ff, 0xffff01ffffff0101, 0xffff01ffff000000, 0xffff01ffff01ffff, 0xffff01ffff01ff01, 0xffff01ffff0101ff, 0xffff01ffff010101, 0xffff01ff00ff0000,
  0xffff01ff0000ff00, 0xffff01ff00000001, 0xffff01ff00010000, 0xffff01ff01ffffff, 0xffff01ff01ffff01, 0xffff01ff01ff01ff, 0xffff01ff01ff0101, 0xffff01ff01000000,
  0xffff01ff0101ffff, 0xffff01ff0101ff01, 0xffff01ff010101ff, 0xffff01ff01010101, 0xffff0100ffff0000, 0xffff0100ff00ff00, 0xffff0100ff0000ff, 0xffff0100ff000100,
  0xffff0100ff0100ff, 0xffff0100ff010000, 0xffff010000ffff00, 0xffff01000000ffff, 0xffff01000000ff00, 0xffff010000000000, 0xffff01000001ff00, 0xffff0100000100ff,
  0xffff010000010100, 0xffff01000100ff00, 0xffff0100010000ff, 0xffff010001000001, 0xffff010001000100, 0xffff010001010000, 0xffff0101ffffffff, 0xffff0101ffffff01,
  0xffff0101ffff01ff, 0xffff0101ffff0101, 0xffff0101ff000000, 0xffff0101ff01ffff, 0xffff0101ff01ff01, 0xffff0101ff0101ff, 0xffff0101ff010101, 0xffff010100ff0000,
  0xffff01010000ff00, 0xffff010100000100, 0xffff01010001ff00, 0xffff010100010000, 0xffff010101ffffff, 0xffff010101ffff01, 0xffff010101ff0000, 0xffff010101ff01ff,
  0xffff010101ff0101, 0xffff010101000000, 0xffff01010101ffff, 0xffff01010101ff01, 0xffff0101010101ff, 0xffff010101010101, 0xff00ffffff00ffff, 0xff00ffffff00ff00,
  0xff00ffffff0000ff, 0xff00ffffff000100, 0xff00ffffff0100ff, 0xff00ffffff010000, 0xff00ffff00ffff00, 0xff00ffff00ff00ff, 0xff00ffff0000ffff, 0xff00ffff00000000,
  0xff00ffff000001ff, 0xff00ffff0001ff00, 0xff00ffff000100ff, 0xff00ffff00010000, 0xff00ffff00010100, 0xff00ffff0100ff00, 0xff00ffff010000ff, 0xff00ffff01000001,
  0xff00ffff0101ff00, 0xff00ffff01010000, 0xff00ff00ffffff00, 0xff00ff00ffff00ff, 0xff00ff00ffff0001, 0xff00ff00ffff0100, 0xff00ff00ff00ffff, 0xff00ff00ff00ff01,
  0xff00ff00ff000000, 0xff00ff00ff0001ff, 0xff00ff00ff01ff00, 0xff00ff00ff0100ff, 0xff00ff00ff010100, 0xff00ff0000ff0000, 0xff00ff0000ff0101, 0xff00ff000000ffff,
  0xff00ff000000ff00, 0xff00ff000000ff01, 0xff00ff00000000ff, 0xff00ff0000000000, 0xff00ff0000000001, 0xff00ff0000000100, 0xff00ff000001ffff, 0xff00ff0000010000,
  0xff00ff0001ff00ff, 0xff00ff000100ff01, 0xff00ff0001000000, 0xff00ff000101ff00, 0xff00ff00010100ff, 0xff00ff01ff00ff00, 0xff00ff01ff0000ff, 0xff00ff01ff000001,
  0xff00ff01ff010000, 0xff00ff0100ffffff, 0xff00ff0100ff0001, 0xff00ff0100ff0100, 0xff00ff010000ff01, 0xff00ff0100000000, 0xff00ff01000001ff, 0xff00ff0100000101,
  0xff00ff01000100ff, 0xff00ff0100010001, 0xff00ff0101ff0000, 0xff00ff010100ff00, 0xff00ff01010000ff, 0xff00ff0101000001, 0xff00ff0101010000, 0xff0000ffffffff00,
  0xff0000ffffff0001, 0xff0000ffffff0100, 0xff0000ffff0000ff, 0xff0000ffff000000, 0xff0000ffff0001ff, 0xff0000ffff000100, 0xff0000ffff01ff00, 0xff0000ffff010001,
  0xff0000ff00ffff00, 0xff0000ff00ff0000, 0xff0000ff00ff0001, 0xff0000ff00ff01ff, 0xff0000ff00ff0101, 0xff0000ff0000ff00, 0xff0000ff000000ff, 0xff0000ff00000000,
  0xff0000ff00000001, 0xff0000ff00000100, 0xff0000ff0001ff01, 0xff0000ff00010000, 0xff0000ff000101ff, 0xff0000ff01ff00ff, 0xff0000ff01ff0100, 0xff0000ff0100ffff,
  0xff0000ff010000ff, 0xff0000ff01000000, 0xff0000ff010001ff, 0xff0000ff01000100, 0xff0000ff01000101, 0xff0000ff0101ff00, 0xff0000ff010100ff, 0xff0000ff01010000,
  0xff0000ff01010100, 0xff000000ffffff01, 0xff000000ffff0000, 0xff000000ffff0101, 0xff000000ff00ff00, 0xff000000ff0000ff, 0xff000000ff000000, 0xff000000ff000001,
  0xff000000ff000100, 0xff000000ff01ffff, 0xff000000ff01ff01, 0xff000000ff010000, 0xff000000ff0101ff, 0xff000000ff010101, 0xff00000000ffff00, 0xff00000000ff00ff,
  0xff00000000ff0000, 0xff00000000ff0001, 0xff0000000000ff00, 0xff0000000000ff01, 0xff000000000000ff, 0xff00000000000000, 0xff00000000000001, 0xff00000000000100,
  0xff00000000000101, 0xff0000000001ff00, 0xff000000000100ff, 0xff00000000010000, 0xff00000000010001, 0xff00000000010100, 0xff00000001ffffff, 0xff00000001ffff01,
  0xff00000001ff00ff, 0xff00000001ff0000, 0xff00000001ff01ff, 0xff00000001ff0101, 0xff0000000100ffff, 0xff0000000100ff00, 0xff000000010000ff, 0xff00000001000000,
  0xff00000001000001, 0xff00000001000100, 0xff00000001000101, 0xff0000000101ffff, 0xff0000000101ff01, 0xff00000001010000, 0xff000001ffffff00, 0xff000001ffff00ff,
  0xff000001ffff0000, 0xff000001ffff0001, 0xff000001ff000000, 0xff000001ff000001, 0xff000001ff0001ff, 0xff000001ff000101, 0xff000001ff01ff00, 0xff000001ff010001,
  0xff00000100ffffff, 0xff00000100ffff01, 0xff00000100ff00ff, 0xff00000100ff0000, 0xff00000100ff01ff, 0xff00000100ff0101, 0xff0000010000ff00, 0xff00000100000000,
  0xff00000100000001, 0xff000001000001ff, 0xff00000100000100, 0xff0000010001ff00, 0xff000001000100ff, 0xff00000100010000, 0xff000001000101ff, 0xff00000100010100,
  0xff00000100010101, 0xff00000101ff0001, 0xff00000101ff0101, 0xff0000010100ff01, 0xff00000101000000, 0xff000001010100ff, 0xff00000101010100, 0xff0001ffff00ff00,
  0xff0001ffff000001, 0xff0001ffff010000, 0xff0001ff00ffff00, 0xff0001ff00ff00ff, 0xff0001ff00ff0001, 0xff0001ff00ff0100, 0xff0001ff0000ffff, 0xff0001ff00000000,
  0xff0001ff000001ff, 0xff0001ff00000101, 0xff0001ff0001ffff, 0xff0001ff0001ff00, 0xff0001ff000100ff, 0xff0001ff00010001, 0xff0001ff00010100, 0xff0001ff01ff0000,
  0xff0001ff0100ff00, 0xff0001ff010000ff, 0xff0001ff01010000, 0xff000100ff00ffff, 0xff000100ff00ff01, 0xff000100ff000000, 0xff000100ff000101, 0xff000100ff01ff00,
  0xff000100ff010000, 0xff00010000ffff01, 0xff00010000ff00ff, 0xff00010000ff0000, 0xff00010000ff01ff, 0xff0001000000ff00, 0xff000100000000ff, 0xff00010000000000,
  0xff00010000000001, 0xff00010000000100, 0xff00010000000101, 0xff0001000001ffff, 0xff00010000010000, 0xff00010000010101, 0xff00010001ff0100, 0xff0001000100ff00,
  0xff0001000100ff01, 0xff00010001000000, 0xff000100010001ff, 0xff0001000101ff00, 0xff00010001010001, 0xff00010001010100, 0xff000101ffff0100, 0xff000101ff000001,
  0xff000101ff0100ff, 0xff000101ff010001, 0xff00010100ff00ff, 0xff00010100ff0001, 0xff00010100ff0100, 0xff0001010000ffff, 0xff0001010000ff01, 0xff00010100000000,
  0xff000101000001ff, 0xff0001010001ff00, 0xff00010100010001, 0xff00010100010100, 0xff00010101ff0000, 0xff0001010100ff00, 0xff00010101000001, 0xff00010101000101,
  0xff01ffffffffffff, 0xff01ffffffffff01, 0xff01ffffffff01ff, 0xff01ffffffff0101, 0xff01ffffff000000, 0xff01ffffff01ffff, 0xff01ffffff01ff01, 0xff01ffffff010000,
  0xff01ffffff0101ff, 0xff01ffffff010101, 0xff01ffff00ff0000, 0xff01ffff0000ff00, 0xff01ffff00000100, 0xff01ffff0001ff00, 0xff01ffff00010000, 0xff01ffff01ffffff,
  0xff01ffff01ffff01, 0xff01ffff01ff01ff, 0xff01ffff01ff0101, 0xff01ffff01000000, 0xff01ffff0101ffff, 0xff01ffff0101ff01, 0xff01ffff01010000, 0xff01ffff010101ff,
  0xff01ffff01010101, 0xff01ff00ffff0000, 0xff01ff00ff00ff00, 0xff01ff00ff0000ff, 0xff01ff00ff000100, 0xff01ff00ff010000, 0xff01ff0000ffff01, 0xff01ff0000ff00ff,
  0xff01ff0000ff0100, 0xff01ff0000000000, 0xff01ff00000001ff, 0xff01ff0000000101, 0xff01ff000001ff00, 0xff01ff00000100ff, 0xff01ff0000010000, 0xff01ff0000010001,
  0xff01ff0001ff0000, 0xff01ff000100ffff, 0xff01ff0001000001, 0xff01ff0001000100, 0xff01ff0001010000, 0xff01ff01ffffff00, 0xff01ff01ffff01ff, 0xff01ff01ffff0101,
  0xff01ff01ff00ff00, 0xff01ff01ff000000, 0xff01ff01ff01ffff, 0xff01ff01ff01ff01, 0xff01ff01ff0101ff, 0xff01ff01ff010101, 0xff01ff0100ff0000, 0xff01ff010000ff00,
  0xff01ff0100000001, 0xff01ff0100000100, 0xff01ff0100010000, 0xff01ff0101ffff00, 0xff01ff0101ff01ff, 0xff01ff0101ff0101, 0xff01ff010100ff00, 0xff01ff0101000000,
  0xff01ff010101ffff, 0xff01ff010101ff01, 0xff01ff01010101ff, 0xff01ff0101010101, 0xff0100ffffff0000, 0xff0100ffff0000ff, 0xff0100ffff000001, 0xff0100ffff000100,
  0xff0100ffff010000, 0xff0100ff00ff00ff, 0xff0100ff00ff0000, 0xff0100ff00ff0001, 0xff0100ff00ff0100, 0xff0100ff0000ff01, 0xff0100ff00000000, 0xff0100ff000001ff,
  0xff0100ff00000101, 0xff0100ff00010001, 0xff0100ff01ff0000, 0xff0100ff0100ff00, 0xff0100ff010000ff, 0xff0100ff01000100, 0xff0100ff0101ff00, 0xff0100ff01010000,
  0xff010000ffff0100, 0xff010000ff000000, 0xff010000ff01ff00, 0xff010000ff010100, 0xff01000000ffffff, 0xff01000000ff0000, 0xff01000000ff01ff, 0xff0100000000ff00,
  0xff010000000000ff, 0xff01000000000000, 0xff01000000000100, 0xff0100000001ff01, 0xff01000000010000, 0xff010000000101ff, 0xff01000001ff0100, 0xff0100000100ffff,
  0xff010000010000ff, 0xff01000001000000, 0xff010000010001ff, 0xff01000001000101, 0xff0100000101ff00, 0xff010000010100ff, 0xff01000001010001, 0xff01000001010100,
  0xff010001ffff0000, 0xff010001ff00ffff, 0xff010001ff00ff01, 0xff010001ff000100, 0xff010001ff010000, 0xff01000100ffff00, 0xff01000100ff0100, 0xff01000100000000,
  0xff0100010001ffff, 0xff0100010001ff00, 0xff01000100010100, 0xff01000101ff00ff, 0xff01000101ff0001, 0xff0100010100ffff, 0xff01000101000101, 0xff0101ffffffffff,
  0xff0101ffffffff01, 0xff0101ffffff01ff, 0xff0101ffffff0101, 0xff0101ffff000000, 0xff0101ffff01ffff, 0xff0101ffff01ff01, 0xff0101ffff0101ff, 0xff0101ffff010101,
  0xff0101ff00ff0000, 0xff0101ff0000ff00, 0xff0101ff000000ff, 0xff0101ff00010000, 0xff0101ff01ffffff, 0xff0101ff01ffff01, 0xff0101ff01ff01ff, 0xff0101ff01ff0101,
  0xff0101ff0101ffff, 0xff0101ff0101ff01, 0xff0101ff010101ff, 0xff0101ff01010101, 0xff010100ffff0100, 0xff010100ff00ff00, 0xff010100ff0000ff, 0xff010100ff000100,
  0xff010100ff010000, 0xff01010000ff0001, 0xff01010000ff0100, 0xff0101000000ff01, 0xff01010000000000, 0xff0101000001ff00, 0xff010100000100ff, 0xff01010000010001,
  0xff01010000010100, 0xff01010001ff0000, 0xff0101000100ffff, 0xff01010001000001, 0xff01010001000100, 0xff010100010100ff, 0xff01010001010000, 0xff010101ffffffff,
  0xff010101ffffff01, 0xff010101ffff01ff, 0xff010101ffff0101, 0xff010101ff01ffff, 0xff010101ff01ff01, 0xff010101ff0101ff, 0xff010101ff010101, 0xff01010100ff0000,
  0xff0101010000ff00, 0xff01010100000001, 0xff01010100000100, 0xff01010100010000, 0xff01010101ffffff, 0xff01010101ffff01, 0xff01010101ff01ff, 0xff01010101ff0101,
  0xff01010101000000, 0xff0101010101ffff, 0xff0101010101ff01, 0xff010101010101ff, 0xff01010101010101, 0x00ffffffffff0000, 0x00ffffffff00ff00, 0x00ffffffff000001,
  0x00ffffffff010000, 0x00ffffff00ff0100, 0x00ffffff0000ff01, 0x00ffffff00000000, 0x00ffffff000001ff, 0x00ffffff00000101, 0x00ffffff0001ff00, 0x00ffffff000100ff,
  0x00ffffff00010001, 0x00ffffff010000ff, 0x00ffffff01000100, 0x00ffffff0101ff00, 0x00ffffff01010001, 0x00ffff00ffffffff, 0x00ffff00ffffff00, 0x00ffff00ffff00ff,
  0x00ffff00ffff0001, 0x00ffff00ffff0100, 0x00ffff00ff00ff01, 0x00ffff00ff000000, 0x00ffff00ff000001, 0x00ffff00ff0001ff, 0x00ffff00ff000101, 0x00ffff00ff01ff00,
  0x00ffff00ff010001, 0x00ffff00ff010100, 0x00ffff0000ff0000, 0x00ffff0000ff01ff, 0x00ffff0000ff0101, 0x00ffff000000ff00, 0x00ffff00000000ff, 0x00ffff0000000000,
  0x00ffff0000000001, 0x00ffff0000000100, 0x00ffff0000000101, 0x00ffff0000010000, 0x00ffff00000101ff, 0x00ffff0000010101, 0x00ffff0001ffff00, 0x00ffff0001ff00ff,
  0x00ffff0001ff0001, 0x00ffff000100ffff, 0x00ffff000100ff01, 0x00ffff0001000000, 0x00ffff000101ffff, 0x00ffff000101ff00, 0x00ffff000101ff01, 0x00ffff01ffff0000,
  0x00ffff01ff00ff00, 0x00ffff01ff0000ff, 0x00ffff01ff000001, 0x00ffff01ff010000, 0x00ffff0100ffff00, 0x00ffff010000ff01, 0x00ffff0100000000, 0x00ffff0100000101,
  0x00ffff01000100ff, 0x00ffff0100010100, 0x00ffff0101ff0100, 0x00ffff01010000ff, 0x00ffff0101010000, 0x00ff00ffffffff00, 0x00ff00ffff000000, 0x00ff00ffff000100,
  0x00ff00ffff010100, 0x00ff00ff00ff0000, 0x00ff00ff00ff01ff, 0x00ff00ff00ff0101, 0x00ff00ff0000ff00, 0x00ff00ff000000ff, 0x00ff00ff00000000, 0x00ff00ff00000001,
  0x00ff00ff0001ff00, 0x00ff00ff0001ff01, 0x00ff00ff00010000, 0x00ff00ff000101ff, 0x00ff00ff00010101, 0x00ff00ff01ffff00, 0x00ff00ff01ff0001, 0x00ff00ff01ff0100,
  0x00ff00ff0100ffff, 0x00ff00ff0100ff01, 0x00ff00ff01000000, 0x00ff00ff0101ffff, 0x00ff00ff0101ff00, 0x00ff00ff01010100, 0x00ff0000ffffff00, 0x00ff0000ffffff01,
  0x00ff0000ffff0000, 0x00ff0000ffff0101, 0x00ff0000ff00ff00, 0x00ff0000ff0000ff, 0x00ff0000ff000000, 0x00ff0000ff000001, 0x00ff0000ff000100, 0x00ff0000ff01ffff,
  0x00ff0000ff010000, 0x00ff0000ff010101, 0x00ff000000ffff00, 0x00ff000000ff00ff, 0x00ff000000ff0000, 0x00ff000000ff0001, 0x00ff000000ff0100, 0x00ff00000000ffff,
  0x00ff00000000ff00, 0x00ff0000000000ff, 0x00ff000000000000, 0x00ff000000000001, 0x00ff0000000001ff, 0x00ff000000000100, 0x00ff00000001ff00, 0x00ff0000000100ff,
  0x00ff000000010000, 0x00ff000000010001, 0x00ff000000010100, 0x00ff000001ffff01, 0x00ff000001ff00ff, 0x00ff000001ff0000, 0x00ff000001ff01ff, 0x00ff00000100ff00,
  0x00ff0000010000ff, 0x00ff000001000000, 0x00ff000001000001, 0x00ff000001000100, 0x00ff000001000101, 0x00ff000001010000, 0x00ff0000010101ff, 0x00ff000001010101,
  0x00ff0001ffffff00, 0x00ff0001ffff0000, 0x00ff0001ffff0100, 0x00ff0001ff0000ff, 0x00ff0001ff000000, 0x00ff0001ff0001ff, 0x00ff0001ff000101, 0x00ff0001ff01ff00,
  0x00ff0001ff0100ff, 0x00ff0001ff010100, 0x00ff000100ffffff, 0x00ff000100ffff01, 0x00ff000100ff0000, 0x00ff000100ff01ff, 0x00ff00010000ffff, 0x00ff00010000ff00,
  0x00ff00010000ff01, 0x00ff000100000000, 0x00ff000100000001, 0x00ff000100000100, 0x00ff00010001ff01, 0x00ff000100010000, 0x00ff0001000101ff, 0x00ff000101ffff00,
  0x00ff000101ff0000, 0x00ff000101ff0101, 0x00ff0001010000ff, 0x00ff000101000000, 0x00ff00010101ff00, 0x00ff0001010100ff, 0x00ff000101010001, 0x00ff01ffffff0000,
  0x00ff01ffff00ff00, 0x00ff01ffff000000, 0x00ff01ffff000101, 0x00ff01ffff010000, 0x00ff01ff00ffff01, 0x00ff01ff00ff0100, 0x00ff01ff0000ffff, 0x00ff01ff00000000,
  0x00ff01ff000001ff, 0x00ff01ff0001ff00, 0x00ff01ff000100ff, 0x00ff01ff00010001, 0x00ff01ff00010100, 0x00ff01ff01ff0000, 0x00ff01ff0100ff00, 0x00ff01ff010000ff,
  0x00ff01ff01000001, 0x00ff01ff01000100, 0x00ff01ff01010000, 0x00ff0100ffffff00, 0x00ff0100ffff0000, 0x00ff0100ffff0001, 0x00ff0100ffff0101, 0x00ff0100ff00ffff,
  0x00ff0100ff0000ff, 0x00ff0100ff000000, 0x00ff0100ff0001ff, 0x00ff0100ff01ff00, 0x00ff0100ff0100ff, 0x00ff0100ff010001, 0x00ff010000ffffff, 0x00ff010000ff0000,
  0x00ff010000ff0101, 0x00ff01000000ff00, 0x00ff01000000ff01, 0x00ff0100000000ff, 0x00ff010000000000, 0x00ff010000000001, 0x00ff010000000100, 0x00ff01000001ffff,
  0x00ff01000001ff01, 0x00ff010000010000, 0x00ff010000010001, 0x00ff010000010101, 0x00ff010001ff0001, 0x00ff010001ff0100, 0x00ff01000100ff01, 0x00ff010001000000,
  0x00ff010001000001, 0x00ff0100010001ff, 0x00ff01000101ff00, 0x00ff0100010100ff, 0x00ff010001010001, 0x00ff010001010100, 0x00ff0101ff000001, 0x00ff010100ff00ff,
  0x00ff010100ff0001, 0x00ff010100ff0100, 0x00ff010100000000, 0x00ff0101000001ff, 0x00ff010100000101, 0x00ff0101000100ff, 0x00ff010100010100, 0x00ff0101010000ff,
  0x00ff010101010000, 0x0000ffffffffff00, 0x0000ffffffff00ff, 0x0000ffffffff0000, 0x0000ffffffff0001, 0x0000ffffffff0100, 0x0000ffffff00ff01, 0x0000ffffff000000,
  0x0000ffffff000101, 0x0000ffffff01ff00, 0x0000ffffff0100ff, 0x0000ffffff010100, 0x0000ffff00ffffff, 0x0000ffff00ff0000, 0x0000ffff00ff01ff, 0x0000ffff0000ff00,
  0x0000ffff000000ff, 0x0000ffff00000000, 0x0000ffff00000001, 0x0000ffff00000100, 0x0000ffff00010000, 0x0000ffff000101ff, 0x0000ffff01ff0001, 0x0000ffff01ff0100,
  0x0000ffff01000000, 0x0000ffff010001ff, 0x0000ffff0101ffff, 0x0000ffff0101ff00, 0x0000ffff01010001, 0x0000ffff01010100, 0x0000ff00ffff0000, 0x0000ff00ffff01ff,
  0x0000ff00ffff0100, 0x0000ff00ffff0101, 0x0000ff00ff00ff00, 0x0000ff00ff0000ff, 0x0000ff00ff000000, 0x0000ff00ff000001, 0x0000ff00ff0001ff, 0x0000ff00ff000100,
  0x0000ff00ff01ffff, 0x0000ff00ff010000, 0x0000ff00ff010001, 0x0000ff00ff0101ff, 0x0000ff00ff010101, 0x0000ff0000ffff00, 0x0000ff0000ff00ff, 0x0000ff0000ff0000,
  0x0000ff0000ff0001, 0x0000ff0000ff0100, 0x0000ff000000ffff, 0x0000ff000000ff00, 0x0000ff000000ff01, 0x0000ff00000000ff, 0x0000ff0000000000, 0x0000ff0000000001,
  0x0000ff00000001ff, 0x0000ff0000000100, 0x0000ff0000000101, 0x0000ff000001ff00, 0x0000ff00000100ff, 0x0000ff0000010000, 0x0000ff0000010001, 0x0000ff0000010100,
  0x0000ff0001ffff01, 0x0000ff0001ff0000, 0x0000ff000100ff00, 0x0000ff00010000ff, 0x0000ff0001000000, 0x0000ff0001000001, 0x0000ff0001000100, 0x0000ff000101ffff,
  0x0000ff0001010000, 0x0000ff0001010101, 0x0000ff01ffffff00, 0x0000ff01ffff0001, 0x0000ff01ff00ff01, 0x0000ff01ff000000, 0x0000ff01ff000101, 0x0000ff01ff01ff00,
  0x0000ff01ff0100ff, 0x0000ff0100ffff01, 0x0000ff0100ff0000, 0x0000ff0100ff0101, 0x0000ff010000ff00, 0x0000ff01000000ff, 0x0000ff0100000000, 0x0000ff0100000001,
  0x0000ff0100000100, 0x0000ff010001ff01, 0x0000ff0100010000, 0x0000ff0101ff0000, 0x0000ff010100ffff, 0x0000ff010100ff01, 0x0000ff0101000000, 0x0000ff0101000100,
  0x0000ff0101000101, 0x0000ff01010100ff, 0x000000ffffff00ff, 0x000000ffffff0000, 0x000000ffff00ff00, 0x000000ffff0000ff, 0x000000ffff000000, 0x000000ffff000001,
  0x000000ffff0001ff, 0x000000ffff000100, 0x000000ffff01ff00, 0x000000ffff010000, 0x000000ffff0101ff, 0x000000ffff010101, 0x000000ff00ffff00, 0x000000ff00ff00ff,
  0x000000ff00ff0000, 0x000000ff00ff0001, 0x000000ff00ff0100, 0x000000ff00ff0101, 0x000000ff0000ffff, 0x000000ff0000ff00, 0x000000ff000000ff, 0x000000ff00000000,
  0x000000ff00000001, 0x000000ff000001ff, 0x000000ff00000100, 0x000000ff00000101, 0x000000ff0001ff00, 0x000000ff0001ff01, 0x000000ff000100ff, 0x000000ff00010000,
  0x000000ff00010001, 0x000000ff00010100, 0x000000ff01ffffff, 0x000000ff01ff01ff, 0x000000ff01ff0101, 0x000000ff0100ff00, 0x000000ff010000ff, 0x000000ff01000000,
  0x000000ff01000001, 0x000000ff01000100, 0x000000ff0101ff00, 0x000000ff010100ff, 0x000000ff01010000, 0x000000ff01010101, 0x00000000ffffff00, 0x00000000ffffff01,
  0x00000000ffff00ff, 0x00000000ffff0000, 0x00000000ffff0001, 0x00000000ffff0100, 0x00000000ff00ffff, 0x00000000ff00ff00, 0x00000000ff00ff01, 0x00000000ff0000ff,
  0x00000000ff000000, 0x00000000ff000001, 0x00000000ff000100, 0x00000000ff000101, 0x00000000ff01ff00, 0x00000000ff0100ff, 0x00000000ff010000, 0x00000000ff010001,
  0x00000000ff010100, 0x0000000000ffffff, 0x0000000000ffff00, 0x0000000000ffff01, 0x0000000000ff00ff, 0x0000000000ff0000, 0x0000000000ff0001, 0x0000000000ff01ff,
  0x0000000000ff0100, 0x000000000000ffff, 0x000000000000ff00, 0x000000000000ff01, 0x00000000000000ff, 0x0000000000000000, 0x0000000000000001, 0x00000000000001ff,
  0x0000000000000100, 0x0000000000000101, 0x000000000001ffff, 0x000000000001ff00, 0x00000000000100ff, 0x0000000000010000, 0x0000000000010001, 0x00000000000101ff,
  0x0000000000010100, 0x0000000000010101, 0x0000000001ffff00, 0x0000000001ff00ff, 0x0000000001ff0000, 0x0000000001ff0100, 0x0000000001ff0101, 0x000000000100ffff,
  0x000000000100ff00, 0x00000000010000ff, 0x0000000001000000, 0x0000000001000001, 0x00000000010001ff, 0x0000000001000100, 0x000000000101ff00, 0x00000000010100ff,
  0x0000000001010000, 0x0000000001010001, 0x0000000001010100, 0x00000001ffffffff, 0x00000001ffffff00, 0x00000001ffffff01, 0x00000001ffff00ff, 0x00000001ffff0001,
  0x00000001ffff01ff, 0x00000001ffff0100, 0x00000001ff00ff00, 0x00000001ff0000ff, 0x00000001ff000000, 0x00000001ff0001ff, 0x00000001ff000100, 0x00000001ff01ffff,
  0x00000001ff01ff00, 0x00000001ff01ff01, 0x00000001ff0100ff, 0x00000001ff010000, 0x00000001ff010001, 0x00000001ff0101ff, 0x00000001ff010100, 0x0000000100ffff00,
  0x0000000100ff0000, 0x0000000100ff0001, 0x0000000100ff01ff, 0x0000000100ff0100, 0x0000000100ff0101, 0x000000010000ffff, 0x000000010000ff00, 0x000000010000ff01,
  0x00000001000000ff, 0x0000000100000000, 0x0000000100000001, 0x00000001000001ff, 0x0000000100000100, 0x0000000100000101, 0x000000010001ff00, 0x00000001000100ff,
  0x0000000100010000, 0x0000000100010100, 0x0000000101ffff01, 0x0000000101ff0000, 0x0000000101ff0001, 0x0000000101ff01ff, 0x0000000101ff0100, 0x0000000101ff0101,
  0x000000010100ff00, 0x0000000101000000, 0x0000000101000101, 0x000000010101ff01, 0x0000000101010000, 0x0000000101010001, 0x00000001010101ff, 0x0000000101010100,
  0x000001ffffff00ff, 0x000001ffffff0000, 0x000001ffffff0001, 0x000001ffffff0100, 0x000001ffff00ffff, 0x000001ffff000000, 0x000001ffff0001ff, 0x000001ffff01ff00,
  0x000001ffff010101, 0x000001ff00ff0000, 0x000001ff00ff01ff, 0x000001ff00ff0101, 0x000001ff0000ff00, 0x000001ff000000ff, 0x000001ff00000000, 0x000001ff00000001,
  0x000001ff000001ff, 0x000001ff00000100, 0x000001ff0001ffff, 0x000001ff0001ff01, 0x000001ff000100ff, 0x000001ff00010000, 0x000001ff01ffff01, 0x000001ff01ff0100,
  0x000001ff0100ffff, 0x000001ff0100ff01, 0x000001ff01000000, 0x000001ff010001ff, 0x000001ff0101ff00, 0x000001ff01010100, 0x00000100ffffff00, 0x00000100ffffff01,
  0x00000100ffff0000, 0x00000100ffff0101, 0x00000100ff00ff00, 0x00000100ff0000ff, 0x00000100ff000000, 0x00000100ff000001, 0x00000100ff000100, 0x00000100ff010000,
  0x0000010000ffff00, 0x0000010000ff00ff, 0x0000010000ff0000, 0x0000010000ff0001, 0x0000010000ff0100, 0x000001000000ffff, 0x000001000000ff00, 0x000001000000ff01,
  0x00000100000000ff, 0x0000010000000000, 0x0000010000000001, 0x00000100000001ff, 0x0000010000000100, 0x0000010000000101, 0x000001000001ff00, 0x00000100000100ff,
  0x0000010000010000, 0x0000010000010001, 0x0000010000010100, 0x0000010001ffff00, 0x0000010001ff0000, 0x0000010001ff0100, 0x000001000100ff00, 0x00000100010000ff,
  0x0000010001000000, 0x0000010001000001, 0x00000100010001ff, 0x0000010001000100, 0x0000010001010000, 0x00000101ffff00ff, 0x00000101ffff01ff, 0x00000101ff000000,
  0x00000101ff000101, 0x00000101ff01ffff, 0x00000101ff010000, 0x00000101ff010001, 0x00000101ff010100, 0x0000010100ff0000, 0x0000010100ff01ff, 0x0000010100ff0100,
  0x000001010000ff00, 0x0000010100000000, 0x0000010100000001, 0x00000101000001ff, 0x0000010100000100, 0x000001010001ff01, 0x0000010100010000, 0x00000101000101ff,
  0x0000010100010101, 0x0000010101ffff00, 0x0000010101ff0101, 0x000001010100ff01, 0x0000010101000000, 0x0000010101000001, 0x00000101010001ff, 0x0000010101000101,
  0x000001010101ff00, 0x0001ffffffff0000, 0x0001ffffff0000ff, 0x0001ffffff000001, 0x0001ffffff000100, 0x0001ffffff010000, 0x0001ffff00ff00ff, 0x0001ffff0000ffff,
  0x0001ffff00000000, 0x0001ffff00000001, 0x0001ffff000001ff, 0x0001ffff00000101, 0x0001ffff0001ff00, 0x0001ffff000100ff, 0x0001ffff00010001, 0x0001ffff00010100,
  0x0001ffff01ffff00, 0x0001ffff01000001, 0x0001ffff01010000, 0x0001ff00ffffff00, 0x0001ff00ffff00ff, 0x0001ff00ffff0001, 0x0001ff00ffff0100, 0x0001ff00ff00ff01,
  0x0001ff00ff000000, 0x0001ff00ff01ff00, 0x0001ff00ff01ff01, 0x0001ff00ff010001, 0x0001ff00ff010100, 0x0001ff0000ff0000, 0x0001ff0000ff0100, 0x0001ff000000ff00,
  0x0001ff0000000000, 0x0001ff0000000001, 0x0001ff0000000100, 0x0001ff0000010000, 0x0001ff0000010001, 0x0001ff0000010101, 0x0001ff0001ff00ff, 0x0001ff0001ff0101,
  0x0001ff000100ff01, 0x0001ff0001000000, 0x0001ff000101ff00, 0x0001ff0001010001, 0x0001ff0001010100, 0x0001ff01ff00ff00, 0x0001ff01ff000001, 0x0001ff01ff000100,
  0x0001ff0100ffffff, 0x0001ff0100ffff00, 0x0001ff0100ff0001, 0x0001ff0100000000, 0x0001ff0100000001, 0x0001ff01000001ff, 0x0001ff010001ffff, 0x0001ff0101ff0000,
  0x0001ff010100ff00, 0x0001ff0101000001, 0x0001ff0101010000, 0x000100ffff00ff00, 0x000100ffff00ff01, 0x000100ffff000000, 0x000100ffff000001, 0x000100ffff000101,
  0x000100ffff01ff00, 0x000100ffff010001, 0x000100ffff010100, 0x000100ff00ffffff, 0x000100ff00ffff01, 0x000100ff00ff0000, 0x000100ff00ff01ff, 0x000100ff00ff0101,
  0x000100ff0000ff00, 0x000100ff000000ff, 0x000100ff00000000, 0x000100ff00000001, 0x000100ff00000100, 0x000100ff00000101, 0x000100ff0001ffff, 0x000100ff0001ff01,
  0x000100ff00010000, 0x000100ff01ff00ff, 0x000100ff01ff0000, 0x000100ff01ff0100, 0x000100ff0100ffff, 0x000100ff0100ff01, 0x000100ff010000ff, 0x000100ff01000000,
  0x000100ff01000001, 0x000100ff010001ff, 0x000100ff01000101, 0x000100ff0101ff00, 0x000100ff010100ff, 0x000100ff01010100, 0x00010000ffff0000, 0x00010000ffff01ff,
  0x00010000ffff0101, 0x00010000ff00ff00, 0x00010000ff000000, 0x00010000ff000001, 0x00010000ff000100, 0x0001000000ff00ff, 0x0001000000ff0000, 0x0001000000ff0001,
  0x0001000000ff0100, 0x000100000000ffff, 0x000100000000ff00, 0x00010000000000ff, 0x0001000000000000, 0x0001000000000001, 0x0001000000000100, 0x000100000001ff00,
  0x00010000000100ff, 0x0001000000010000, 0x0001000000010001, 0x0001000000010100, 0x0001000001ff0001, 0x0001000001ff0100, 0x0001000001ff0101, 0x000100000100ff00,
  0x0001000001000000, 0x0001000001000001, 0x0001000001000100, 0x0001000001000101, 0x000100000101ff01, 0x0001000001010000, 0x0001000001010001, 0x00010000010101ff,
  0x00010001ffffff01, 0x00010001ffff0100, 0x00010001ff000000, 0x00010001ff01ffff, 0x00010001ff010001, 0x00010001ff0101ff, 0x00010001ff010100, 0x0001000100ffffff,
  0x0001000100ff0000, 0x0001000100ff01ff, 0x0001000100ff0101, 0x000100010000ff00, 0x00010001000000ff, 0x0001000100000000, 0x0001000100000001, 0x00010001000001ff,
  0x0001000100000101, 0x000100010001ffff, 0x0001000100010000, 0x00010001000101ff, 0x0001000101ffffff, 0x0001000101ffff01, 0x0001000101ff0000, 0x0001000101ff0101,
  0x00010001010000ff, 0x0001000101000001, 0x00010001010001ff, 0x0001000101000100, 0x000100010101ffff, 0x00010001010100ff, 0x0001000101010001, 0x0001000101010101,
  0x000101ffff000001, 0x000101ffff000100, 0x000101ffff010000, 0x000101ff00ffff00, 0x000101ff0000ff01, 0x000101ff00000000, 0x000101ff00000101, 0x000101ff0001ff00,
  0x000101ff00010100, 0x000101ff01ff0000, 0x000101ff0100ff00, 0x000101ff010001ff, 0x000101ff01010001, 0x00010100ffffff00, 0x00010100ffff00ff, 0x00010100ff00ffff,
  0x00010100ff000000, 0x00010100ff01ff00, 0x00010100ff0100ff, 0x00010100ff010001, 0x00010100ff010100, 0x0001010000ffffff, 0x0001010000ffff00, 0x0001010000ff0000,
  0x0001010000ff0001, 0x0001010000ff01ff, 0x000101000000ff00, 0x00010100000000ff, 0x0001010000000000, 0x0001010000000001, 0x0001010000000100, 0x000101000001ffff,
  0x0001010000010000, 0x0001010000010101, 0x0001010001ffff01, 0x0001010001ff00ff, 0x0001010001ff0101, 0x0001010001000000, 0x000101000101ff00, 0x00010100010100ff,
  0x0001010001010000, 0x0001010001010100, 0x00010101ff00ff00, 0x00010101ff000001, 0x00010101ff0001ff, 0x0001010100ffff00, 0x0001010100ff00ff, 0x0001010100ff0100,
  0x000101010000ffff, 0x0001010100000000, 0x00010101000001ff, 0x0001010100000101, 0x00010101000100ff, 0x0001010100010000, 0x0001010100010100, 0x0001010101ff0001,
  0x00010101010000ff, 0x00010101010001ff, 0x0001010101000101, 0x0001010101010001, 0x01ffffffffffffff, 0x01ffffffffffff01, 0x01ffffffffff01ff, 0x01ffffffffff0101,
  0x01ffffffff01ffff, 0x01ffffffff01ff01, 0x01ffffffff0101ff, 0x01ffffffff010101, 0x01ffffff00ff0000, 0x01ffffff0000ffff, 0x01ffffff0000ff00, 0x01ffffff000000ff,
  0x01ffffff00000001, 0x01ffffff00000100, 0x01ffffff00010000, 0x01ffffff01ffffff, 0x01ffffff01ffff01, 0x01ffffff01ff01ff, 0x01ffffff01ff0101, 0x01ffffff01000000,
  0x01ffffff0101ffff, 0x01ffffff0101ff01, 0x01ffffff010101ff, 0x01ffffff01010101, 0x01ffff00ffff0000, 0x01ffff00ff00ff00, 0x01ffff00ff0000ff, 0x01ffff00ff000001,
  0x01ffff00ff000100, 0x01ffff00ff010000, 0x01ffff0000ffff00, 0x01ffff0000ff00ff, 0x01ffff0000ff0100, 0x01ffff000000ffff, 0x01ffff000000ff01, 0x01ffff0000000000,
  0x01ffff0000000001, 0x01ffff00000001ff, 0x01ffff0000000100, 0x01ffff00000100ff, 0x01ffff0000010001, 0x01ffff0000010100, 0x01ffff0001ff0000, 0x01ffff0001ff0100,
  0x01ffff00010000ff, 0x01ffff0001000001, 0x01ffff0001000100, 0x01ffff0001010000, 0x01ffff01ffffffff, 0x01ffff01ffffff01, 0x01ffff01ffff01ff, 0x01ffff01ffff0101,
  0x01ffff01ff000000, 0x01ffff01ff01ffff, 0x01ffff01ff01ff01, 0x01ffff01ff0101ff, 0x01ffff01ff010101, 0x01ffff010000ff00, 0x01ffff01000000ff, 0x01ffff0100000100,
  0x01ffff0100010000, 0x01ffff0101ffffff, 0x01ffff0101ffff01, 0x01ffff0101ff01ff, 0x01ffff0101ff0101, 0x01ffff0101000000, 0x01ffff010101ffff, 0x01ffff010101ff01,
  0x01ffff01010101ff, 0x01ffff0101010101, 0x01ff00ffff0000ff, 0x01ff00ffff000100, 0x01ff00ff00ffff00, 0x01ff00ff00ff00ff, 0x01ff00ff0000ff00, 0x01ff00ff00000000,
  0x01ff00ff00000101, 0x01ff00ff0001ff00, 0x01ff00ff000100ff, 0x01ff00ff00010100, 0x01ff00ff010000ff, 0x01ff00ff01000100, 0x01ff0000ffffff00, 0x01ff0000ffff0100,
  0x01ff0000ff00ff01, 0x01ff0000ff000000, 0x01ff0000ff000101, 0x01ff0000ff010001, 0x01ff0000ff010100, 0x01ff000000ffffff, 0x01ff000000ffff00, 0x01ff000000ff0000,
  0x01ff000000ff01ff, 0x01ff00000000ff00, 0x01ff0000000000ff, 0x01ff000000000000, 0x01ff000000000001, 0x01ff000000000100, 0x01ff000000000101, 0x01ff000000010000,
  0x01ff000000010001, 0x01ff0000000101ff, 0x01ff000000010101, 0x01ff000001ffff00, 0x01ff000001ff00ff, 0x01ff000001ff0001, 0x01ff000001ff0100, 0x01ff00000100ffff,
  0x01ff00000100ff01, 0x01ff000001000000, 0x01ff0000010001ff, 0x01ff000001010001, 0x01ff0001ff00ff00, 0x01ff0001ff000001, 0x01ff0001ff000100, 0x01ff0001ff010000,
  0x01ff000100ffff00, 0x01ff000100ff00ff, 0x01ff000100ff0100, 0x01ff000100ff0101, 0x01ff00010000ffff, 0x01ff000100000000, 0x01ff000100000100, 0x01ff000100000101,
  0x01ff00010001ff00, 0x01ff000100010001, 0x01ff000100010101, 0x01ff000101ff0000, 0x01ff00010100ff00, 0x01ff000101000101, 0x01ff0001010100ff, 0x01ff01ffffffffff,
  0x01ff01ffffffff01, 0x01ff01ffffff01ff, 0x01ff01ffffff0101, 0x01ff01ffff000000, 0x01ff01ffff01ffff, 0x01ff01ffff01ff01, 0x01ff01ffff0101ff, 0x01ff01ffff010101,
  0x01ff01ff00ffff00, 0x01ff01ff00ff0000, 0x01ff01ff0000ff00, 0x01ff01ff000000ff, 0x01ff01ff00000100, 0x01ff01ff00010000, 0x01ff01ff00010100, 0x01ff01ff01ffffff,
  0x01ff01ff01ffff01, 0x01ff01ff01ff01ff, 0x01ff01ff01ff0101, 0x01ff01ff01000000, 0x01ff01ff0101ffff, 0x01ff01ff0101ff01, 0x01ff01ff010101ff, 0x01ff01ff01010101,
  0x01ff0100ffff0000, 0x01ff0100ffff0001, 0x01ff0100ff00ff00, 0x01ff0100ff0000ff, 0x01ff0100ff000001, 0x01ff0100ff010000, 0x01ff010000ffff00, 0x01ff010000ff00ff,
  0x01ff010000ff0001, 0x01ff010000ff0100, 0x01ff01000000ffff, 0x01ff01000000ff01, 0x01ff010000000000, 0x01ff010000000101, 0x01ff01000001ff00, 0x01ff0100000100ff,
  0x01ff010001ff0000, 0x01ff010001000001, 0x01ff010001000100, 0x01ff010001010000, 0x01ff0101ffffffff, 0x01ff0101ffffff01, 0x01ff0101ffff01ff, 0x01ff0101ffff0101,
  0x01ff0101ff000000, 0x01ff0101ff01ffff, 0x01ff0101ff01ff01, 0x01ff0101ff0101ff, 0x01ff0101ff010101, 0x01ff010100ff0000, 0x01ff01010000ff00, 0x01ff0101000000ff,
  0x01ff010100000001, 0x01ff010101ffffff, 0x01ff010101ffff01, 0x01ff010101ff01ff, 0x01ff010101ff0101, 0x01ff010101000000, 0x01ff01010101ffff, 0x01ff01010101ff01,
  0x01ff0101010101ff, 0x01ff010101010101, 0x0100ffffffff0000, 0x0100ffffff00ff00, 0x0100ffffff000001, 0x0100ffffff0001ff, 0x0100ffffff000100, 0x0100ffffff010000,
  0x0100ffff00ffff00, 0x0100ffff00ff0001, 0x0100ffff00ff0100, 0x0100ffff00000000, 0x0100ffff000001ff, 0x0100ffff00000101, 0x0100ffff00010100, 0x0100ffff00010101,
  0x0100ffff01ff0000, 0x0100ffff0100ff00, 0x0100ffff010000ff, 0x0100ffff01000001, 0x0100ffff01000100, 0x0100ffff01010000, 0x0100ff00ffffff00, 0x0100ff00ffff00ff,
  0x0100ff00ffff0001, 0x0100ff00ffff0100, 0x0100ff00ff00ffff, 0x0100ff00ff000000, 0x0100ff00ff0001ff, 0x0100ff00ff000101, 0x0100ff00ff01ff00, 0x0100ff00ff0100ff,
  0x0100ff00ff010001, 0x0100ff00ff010100, 0x0100ff0000ffffff, 0x0100ff0000ff0000, 0x0100ff000000ffff, 0x0100ff000000ff00, 0x0100ff00000000ff, 0x0100ff0000000000,
  0x0100ff0000000001, 0x0100ff0000000100, 0x0100ff000001ff01, 0x0100ff0000010000, 0x0100ff0001ff00ff, 0x0100ff0001ff0001, 0x0100ff000100ff01, 0x0100ff0001000000,
  0x0100ff00010001ff, 0x0100ff000101ff00, 0x0100ff00010100ff, 0x0100ff0001010001, 0x0100ff0001010100, 0x0100ff01ffff0000, 0x0100ff01ff00ff00, 0x0100ff01ff0000ff,
  0x0100ff01ff000100, 0x0100ff01ff010000, 0x0100ff0100ff00ff, 0x0100ff0100ff0001, 0x0100ff0100ff0100, 0x0100ff010000ffff, 0x0100ff010000ff01, 0x0100ff0100000000,
  0x0100ff01000001ff, 0x0100ff0100010001, 0x0100ff0100010100, 0x0100ff0101ff0000, 0x0100ff01010000ff, 0x0100ff0101000001, 0x0100ff0101010100, 0x010000ffffffff00,
  0x010000ffffff00ff, 0x010000ffffff0001, 0x010000ffff00ffff, 0x010000ffff000000, 0x010000ffff0001ff, 0x010000ffff010001, 0x010000ff00ffffff, 0x010000ff00ff0101,
  0x010000ff0000ff00, 0x010000ff000000ff, 0x010000ff00000000, 0x010000ff00000001, 0x010000ff000001ff, 0x010000ff00000100, 0x010000ff0001ffff, 0x010000ff0001ff00,
  0x010000ff0001ff01, 0x010000ff00010000, 0x010000ff01ff00ff, 0x010000ff01ff0001, 0x010000ff0100ff01, 0x010000ff010000ff, 0x010000ff01000000, 0x010000ff010001ff,
  0x010000ff0101ff00, 0x010000ff01010100, 0x01000000ffffffff, 0x01000000ffff0000, 0x01000000ffff01ff, 0x01000000ffff0101, 0x01000000ff00ffff, 0x01000000ff00ff00,
  0x01000000ff0000ff, 0x01000000ff000000, 0x01000000ff000001, 0x01000000ff000100, 0x01000000ff01ff00, 0x01000000ff010000, 0x01000000ff010100, 0x01000000ff010101,
  0x0100000000ffff00, 0x0100000000ff00ff, 0x0100000000ff0000, 0x0100000000ff0001, 0x0100000000ff0100, 0x010000000000ffff, 0x010000000000ff00, 0x010000000000ff01,
  0x01000000000000ff, 0x0100000000000000, 0x0100000000000001, 0x01000000000001ff, 0x0100000000000100, 0x0100000000000101, 0x010000000001ff00, 0x01000000000100ff,
  0x0100000000010000, 0x0100000000010001, 0x0100000000010100, 0x0100000001ffff00, 0x0100000001ff0000, 0x0100000001ff01ff, 0x010000000100ff00, 0x010000000100ff01,
  0x01000000010000ff, 0x0100000001000000, 0x0100000001000001, 0x0100000001000100, 0x0100000001000101, 0x010000000101ffff, 0x010000000101ff01, 0x0100000001010000,
  0x01000000010101ff, 0x0100000001010101, 0x01000001ffffff00, 0x01000001ffff00ff, 0x01000001ff00ffff, 0x01000001ff000000, 0x01000001ff000100, 0x01000001ff01ffff,
  0x01000001ff010001, 0x01000001ff010100, 0x0100000100ff0000, 0x0100000100ff01ff, 0x0100000100ff0100, 0x010000010000ff00, 0x010000010000ff01, 0x0100000100000000,
  0x0100000100000001, 0x0100000100000100, 0x0100000100010000, 0x01000001000101ff, 0x0100000101ffff01, 0x0100000101ff00ff, 0x0100000101ff0100, 0x0100000101ff0101,
  0x010000010100ff01, 0x01000001010000ff, 0x0100000101000000, 0x01000001010100ff, 0x0100000101010001, 0x0100000101010100, 0x010001ffffff0000, 0x010001ffff000001,
  0x010001ffff000100, 0x010001ffff010000, 0x010001ff00ffff00, 0x010001ff00ff0001, 0x010001ff0000ffff, 0x010001ff0000ff01, 0x010001ff00000000, 0x010001ff00000001,
  0x010001ff00000101, 0x010001ff000100ff, 0x010001ff00010000, 0x010001ff01ff0000, 0x010001ff0100ff00, 0x010001ff01000001, 0x010001ff01000100, 0x010001ff01010000,
  0x01000100ffff00ff, 0x01000100ffff0001, 0x01000100ffff0100, 0x01000100ff00ffff, 0x01000100ff00ff01, 0x01000100ff000000, 0x01000100ff0001ff, 0x01000100ff000101,
  0x01000100ff01ffff, 0x01000100ff01ff00, 0x01000100ff0100ff, 0x01000100ff010001, 0x0100010000ffffff, 0x0100010000ffff01, 0x0100010000ff0000, 0x0100010000ff01ff,
  0x0100010000ff0101, 0x010001000000ff00, 0x01000100000000ff, 0x0100010000000000, 0x0100010000000001, 0x0100010000000100, 0x010001000001ff01, 0x0100010000010000,
  0x0100010000010001, 0x0100010000010101, 0x0100010001ffff00, 0x0100010001ff00ff, 0x010001000100ffff, 0x010001000100ff01, 0x0100010001000000, 0x0100010001000101,
  0x010001000101ff00, 0x0100010001010001, 0x01000101ffff0000, 0x01000101ff000000, 0x01000101ff010000, 0x0100010100ff00ff, 0x0100010100ff0001, 0x0100010100ff0100,
  0x010001010000ffff, 0x0100010100000000, 0x01000101000001ff, 0x010001010001ff00, 0x0100010101ff0000, 0x010001010100ff00, 0x01000101010000ff, 0x0100010101000000,
  0x0100010101000001, 0x0101ffffffffffff, 0x0101ffffffffff01, 0x0101ffffffff01ff, 0x0101ffffffff0101, 0x0101ffffff000000, 0x0101ffffff01ffff, 0x0101ffffff01ff01,
  0x0101ffffff0101ff, 0x0101ffffff010101, 0x0101ffff00ff0000, 0x0101ffff0000ff00, 0x0101ffff000000ff, 0x0101ffff00000001, 0x0101ffff00000100, 0x0101ffff01ffffff,
  0x0101ffff01ffff01, 0x0101ffff01ff01ff, 0x0101ffff01ff0101, 0x0101ffff01000000, 0x0101ffff0101ffff, 0x0101ffff0101ff01, 0x0101ffff010101ff, 0x0101ffff01010101,
  0x0101ff00ffff0000, 0x0101ff00ffff0100, 0x0101ff00ff00ff00, 0x0101ff00ff0000ff, 0x0101ff00ff000001, 0x0101ff00ff000100, 0x0101ff00ff000101, 0x0101ff0000ff0001,
  0x0101ff0000ff0100, 0x0101ff000000ff00, 0x0101ff0000000000, 0x0101ff00000001ff, 0x0101ff0000000101, 0x0101ff000001ff00, 0x0101ff00000100ff, 0x0101ff0001ff0000,
  0x0101ff000100ffff, 0x0101ff000100ff01, 0x0101ff0001000001, 0x0101ff0001000100, 0x0101ff01ffffff01, 0x0101ff01ffff01ff, 0x0101ff01ffff0101, 0x0101ff01ff00ffff,
  0x0101ff01ff000100, 0x0101ff01ff01ff01, 0x0101ff01ff0101ff, 0x0101ff01ff010101, 0x0101ff0100ff0000, 0x0101ff010000ff00, 0x0101ff0100000001, 0x0101ff0100000100,
  0x0101ff0100010000, 0x0101ff0101ffffff, 0x0101ff0101ffff01, 0x0101ff0101ff01ff, 0x0101ff0101ff0101, 0x0101ff0101000000, 0x0101ff010101ffff, 0x0101ff010101ff01,
  0x0101ff01010101ff, 0x0101ff0101010101, 0x010100ffff000100, 0x010100ffff010000, 0x010100ff00ffff00, 0x010100ff00ff00ff, 0x010100ff0000ffff, 0x010100ff000000ff,
  0x010100ff00000000, 0x010100ff000001ff, 0x010100ff00000101, 0x010100ff0001ff00, 0x010100ff00010000, 0x010100ff00010001, 0x010100ff000101ff, 0x010100ff00010100,
  0x010100ff01ff0000, 0x01010000ffff0001, 0x01010000ffff0100, 0x01010000ff00ffff, 0x01010000ff00ff01, 0x01010000ff000000, 0x01010000ff0001ff, 0x01010000ff010001,
  0x01010000ff010100, 0x0101000000ffff01, 0x0101000000ff0000, 0x010100000000ff00, 0x01010000000000ff, 0x0101000000000000, 0x0101000000000001, 0x0101000000000100,
  0x0101000000010000, 0x0101000000010101, 0x0101000001ffff00, 0x0101000001ff00ff, 0x0101000001ff0000, 0x0101000001ff0001, 0x0101000001ff0100, 0x010100000100ff01,
  0x0101000001000000, 0x01010000010001ff, 0x01010001ffff0000, 0x01010001ff00ff00, 0x01010001ff000001, 0x01010001ff000101, 0x01010001ff01ff00, 0x01010001ff010000,
  0x0101000100ff00ff, 0x0101000100ff0001, 0x0101000100ff0101, 0x010100010000ff01, 0x0101000100000000, 0x0101000100000001, 0x01010001000001ff, 0x010100010001ffff,
  0x010100010001ff01, 0x0101000101ff0001, 0x010100010100ffff, 0x0101000101000000, 0x0101000101000001, 0x0101000101000100, 0x010100010101ff00, 0x01010001010100ff,
  0x0101000101010001, 0x010101ffffffffff, 0x010101ffffffff01, 0x010101ffffff01ff, 0x010101ffffff0101, 0x010101ffff01ffff, 0x010101ffff01ff01, 0x010101ffff0101ff,
  0x010101ffff010101, 0x010101ff0000ff00, 0x010101ff000000ff, 0x010101ff00000001, 0x010101ff00000100, 0x010101ff01ffffff, 0x010101ff01ffff01, 0x010101ff01ff01ff,
  0x010101ff01ff0101, 0x010101ff01000000, 0x010101ff0101ffff, 0x010101ff0101ff01, 0x010101ff010101ff, 0x010101ff01010101, 0x01010100ffff0000, 0x01010100ff0000ff,
  0x01010100ff000100, 0x01010100ff01ff00, 0x01010100ff010000, 0x0101010000ffff00, 0x010101000000ffff, 0x0101010000000000, 0x0101010000000101, 0x010101000001ff00,
  0x0101010000010001, 0x0101010000010100, 0x010101000100ffff, 0x0101010001000001, 0x01010101ffffffff, 0x01010101ffffff01, 0x01010101ffff01ff, 0x01010101ffff0101,
  0x01010101ff01ffff, 0x01010101ff01ff01, 0x01010101ff0101ff, 0x01010101ff010101, 0x010101010000ff00, 0x01010101000000ff, 0x0101010100000001, 0x0101010101ffffff,
  0x0101010101ffff01, 0x0101010101ff01ff, 0x0101010101ff0101, 0x0101010101000000, 0x010101010101ffff, 0x010101010101ff01, 0x01010101010101ff, 0x0101010101010101,
]);

const IQ2_XXS_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 2, 5, 8, 10, 17, 20, 32,
  34, 40, 42, 65, 68, 80, 88, 97,
  100, 128, 130, 138, 162, 257, 260, 272,
  277, 320, 388, 408, 512, 514, 546, 642,
  1025, 1028, 1040, 1057, 1060, 1088, 1090, 1096,
  1120, 1153, 1156, 1168, 1188, 1280, 1282, 1288,
  1312, 1350, 1385, 1408, 1425, 1545, 1552, 1600,
  1668, 1700, 2048, 2053, 2056, 2068, 2088, 2113,
  2116, 2128, 2130, 2184, 2308, 2368, 2562, 2580,
  4097, 4100, 4112, 4129, 4160, 4192, 4228, 4240,
  4245, 4352, 4360, 4384, 4432, 4442, 4480, 4644,
  4677, 5120, 5128, 5152, 5157, 5193, 5248, 5400,
  5474, 5632, 5654, 6145, 6148, 6160, 6208, 6273,
  6400, 6405, 6560, 6737, 8192, 8194, 8202, 8260,
  8289, 8320, 8322, 8489, 8520, 8704, 8706, 9217,
  9220, 9232, 9280, 9302, 9472, 9537, 9572, 9872,
  10248, 10272, 10388, 10820, 16385, 16388, 16400, 16408,
  16417, 16420, 16448, 16456, 16470, 16480, 16513, 16516,
  16528, 16640, 16672, 16737, 16768, 16773, 16897, 16912,
  16968, 16982, 17000, 17408, 17416, 17440, 17536, 17561,
  17682, 17700, 17920, 18433, 18436, 18448, 18496, 18501,
  18688, 18776, 18785, 18818, 19013, 19088, 20480, 20488,
  20497, 20505, 20512, 20608, 20616, 20740, 20802, 20900,
  21137, 21648, 21650, 21770, 22017, 22100, 22528, 22545,
  22553, 22628, 22848, 23048, 24580, 24592, 24640, 24680,
  24832, 24917, 25112, 25184, 25600, 25605, 25872, 25874,
  25988, 26690, 32768, 32770, 32778, 32833, 32898, 33028,
  33048, 33088, 33297, 33793, 33796, 33808, 33813, 33856,
  33888, 34048, 34118, 34196, 34313, 34368, 34400, 34818,
  35076, 35345, 36868, 36880, 36900, 36928, 37025, 37142,
  37248, 37445, 37888, 37922, 37956, 38225, 39041, 39200,
  40962, 41040, 41093, 41225, 41472, 42008, 43088, 43268,
]);

const IQ2_XS_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 2, 5, 8, 10, 17, 20, 22,
  25, 32, 34, 37, 40, 65, 68, 70,
  73, 80, 82, 85, 88, 97, 100, 128,
  130, 133, 136, 145, 148, 153, 160, 257,
  260, 262, 265, 272, 274, 277, 280, 282,
  289, 292, 320, 322, 325, 328, 337, 340,
  352, 360, 385, 388, 400, 512, 514, 517,
  520, 529, 532, 544, 577, 580, 592, 597,
  640, 650, 1025, 1028, 1030, 1033, 1040, 1042,
  1045, 1048, 1057, 1060, 1088, 1090, 1093, 1096,
  1105, 1108, 1110, 1120, 1153, 1156, 1168, 1280,
  1282, 1285, 1288, 1297, 1300, 1312, 1345, 1348,
  1360, 1377, 1408, 1537, 1540, 1552, 1574, 1600,
  1602, 1668, 2048, 2050, 2053, 2056, 2058, 2065,
  2068, 2080, 2085, 2113, 2116, 2128, 2136, 2176,
  2208, 2218, 2305, 2308, 2320, 2368, 2433, 2441,
  2560, 2592, 2600, 2710, 2720, 4097, 4100, 4102,
  4105, 4112, 4114, 4117, 4120, 4129, 4132, 4160,
  4162, 4165, 4168, 4177, 4180, 4192, 4202, 4225,
  4228, 4240, 4352, 4354, 4357, 4360, 4369, 4372,
  4384, 4417, 4420, 4432, 4480, 4500, 4502, 4609,
  4612, 4614, 4624, 4672, 4704, 5120, 5122, 5125,
  5128, 5137, 5140, 5152, 5185, 5188, 5193, 5200,
  5220, 5248, 5377, 5380, 5392, 5440, 5632, 5652,
  5705, 6145, 6148, 6160, 6162, 6208, 6228, 6278,
  6400, 6405, 6502, 6737, 6825, 8192, 8194, 8197,
  8200, 8202, 8209, 8212, 8224, 8257, 8260, 8272,
  8320, 8352, 8449, 8452, 8464, 8512, 8520, 8549,
  8704, 8738, 8832, 8872, 9217, 9220, 9232, 9257,
  9280, 9472, 9537, 9554, 9625, 9729, 9754, 9894,
  10240, 10248, 10250, 10272, 10325, 10376, 10402, 10600,
  10640, 10760, 10784, 10882, 10888, 10890, 16385, 16388,
  16390, 16393, 16400, 16402, 16405, 16408, 16417, 16420,
  16448, 16450, 16453, 16456, 16458, 16465, 16468, 16480,
  16485, 16513, 16516, 16528, 16640, 16642, 16645, 16648,
  16657, 16660, 16672, 16705, 16708, 16720, 16768, 16773,
  16802, 16897, 16900, 16912, 16914, 16937, 16960, 17408,
  17410, 17413, 17416, 17425, 17428, 17433, 17440, 17473,
  17476, 17488, 17536, 17556, 17665, 17668, 17680, 17700,
  17728, 17818, 17920, 17930, 17988, 18000, 18433, 18436,
  18448, 18496, 18501, 18516, 18530, 18688, 18705, 18756,
  18768, 18793, 18948, 20480, 20482, 20485, 20488, 20497,
  20500, 20512, 20520, 20545, 20548, 20560, 20608, 20737,
  20740, 20752, 20757, 20800, 20802, 20992, 21060, 21162,
  21505, 21508, 21520, 21537, 21568, 21600, 21633, 21665,
  21760, 21768, 21888, 21896, 22049, 22120, 22177, 22528,
  22548, 22593, 22608, 22681, 22810, 22848, 22850, 23173,
  24577, 24580, 24592, 24640, 24660, 24674, 24710, 24745,
  24832, 25124, 25162, 25234, 25600, 25622, 25872, 25920,
  25925, 26020, 26625, 26730, 26917, 27142, 27220, 27234,
  32768, 32770, 32773, 32776, 32785, 32788, 32800, 32810,
  32833, 32836, 32848, 32896, 32898, 32936, 32938, 33025,
  33028, 33030, 33040, 33088, 33105, 33113, 33280, 33312,
  33408, 33410, 33440, 33448, 33793, 33796, 33808, 33810,
  33813, 33856, 33888, 33929, 34048, 34116, 34213, 34328,
  34410, 34816, 34824, 34853, 34906, 34944, 34946, 34984,
  35078, 35362, 35456, 35464, 35478, 35496, 36865, 36868,
  36880, 36928, 36950, 36996, 37120, 37154, 37220, 37462,
  37513, 37888, 37893, 37956, 37968, 37976, 38185, 38288,
  38290, 38465, 38993, 39078, 39241, 39445, 39520, 40960,
  40962, 40968, 40970, 40992, 41002, 41120, 41297, 41305,
  41382, 41472, 41474, 41480, 41514, 41600, 41632, 42048,
  42133, 42597, 42648, 43018, 43040, 43042, 43048, 43168,
  43176, 43268, 43396, 43398, 43560, 43562, 43665, 43690,
]);

const IQ2_S_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 2, 5, 8, 10, 17, 20, 22,
  25, 32, 34, 37, 40, 65, 68, 70,
  73, 80, 82, 85, 88, 97, 100, 102,
  105, 128, 130, 133, 136, 145, 148, 160,
  165, 170, 257, 260, 262, 265, 272, 274,
  277, 280, 289, 292, 320, 322, 325, 328,
  337, 340, 342, 345, 352, 357, 360, 385,
  388, 400, 402, 405, 417, 420, 512, 514,
  517, 520, 529, 532, 544, 554, 577, 580,
  582, 585, 592, 597, 640, 645, 650, 660,
  674, 1025, 1028, 1030, 1033, 1040, 1042, 1045,
  1048, 1057, 1060, 1062, 1065, 1088, 1090, 1093,
  1096, 1098, 1105, 1108, 1110, 1113, 1120, 1122,
  1125, 1153, 1156, 1158, 1161, 1168, 1173, 1176,
  1185, 1188, 1280, 1282, 1285, 1288, 1290, 1297,
  1300, 1302, 1305, 1312, 1317, 1320, 1345, 1348,
  1350, 1353, 1360, 1362, 1365, 1368, 1377, 1380,
  1408, 1410, 1413, 1416, 1425, 1428, 1440, 1537,
  1540, 1542, 1545, 1552, 1557, 1600, 1605, 1608,
  1617, 1620, 1632, 1665, 1668, 1680, 2048, 2050,
  2053, 2056, 2065, 2068, 2070, 2073, 2080, 2085,
  2090, 2113, 2116, 2118, 2121, 2128, 2130, 2133,
  2136, 2145, 2148, 2176, 2181, 2196, 2218, 2305,
  2308, 2320, 2322, 2325, 2328, 2337, 2368, 2373,
  2376, 2385, 2388, 2400, 2433, 2448, 2560, 2577,
  2580, 2594, 2600, 2602, 2640, 2713, 4097, 4100,
  4102, 4105, 4112, 4114, 4117, 4120, 4129, 4132,
  4134, 4160, 4162, 4165, 4168, 4177, 4180, 4182,
  4185, 4192, 4194, 4197, 4200, 4225, 4228, 4230,
  4240, 4245, 4248, 4257, 4260, 4352, 4354, 4357,
  4360, 4362, 4369, 4372, 4374, 4377, 4384, 4386,
  4389, 4392, 4417, 4420, 4422, 4425, 4432, 4434,
  4437, 4440, 4449, 4452, 4480, 4482, 4485, 4488,
  4497, 4500, 4609, 4612, 4617, 4624, 4629, 4641,
  4644, 4672, 4677, 4689, 4692, 4737, 4740, 4752,
  5120, 5122, 5125, 5128, 5137, 5140, 5142, 5145,
  5152, 5157, 5160, 5185, 5188, 5190, 5193, 5200,
  5202, 5205, 5208, 5217, 5220, 5248, 5250, 5253,
  5256, 5265, 5268, 5280, 5377, 5380, 5382, 5385,
  5392, 5394, 5397, 5400, 5409, 5412, 5440, 5442,
  5445, 5448, 5457, 5460, 5472, 5505, 5508, 5520,
  5632, 5637, 5640, 5649, 5652, 5664, 5697, 5700,
  5712, 5760, 5802, 6145, 6148, 6150, 6153, 6160,
  6165, 6168, 6177, 6208, 6210, 6213, 6216, 6225,
  6228, 6240, 6273, 6276, 6400, 6402, 6405, 6408,
  6417, 6420, 6432, 6465, 6468, 6480, 6505, 6562,
  6660, 6672, 6720, 6742, 8192, 8194, 8197, 8200,
  8209, 8212, 8214, 8217, 8224, 8229, 8234, 8257,
  8260, 8272, 8274, 8277, 8292, 8320, 8330, 8340,
  8362, 8449, 8452, 8464, 8466, 8469, 8481, 8512,
  8514, 8517, 8529, 8532, 8544, 8577, 8580, 8592,
  8704, 8714, 8738, 8744, 8746, 8772, 8784, 8840,
  8842, 8872, 9217, 9220, 9222, 9225, 9232, 9237,
  9240, 9249, 9252, 9280, 9282, 9285, 9288, 9297,
  9300, 9312, 9345, 9348, 9360, 9472, 9477, 9480,
  9489, 9492, 9504, 9537, 9540, 9552, 9574, 9600,
  9729, 9732, 9744, 9792, 9817, 10240, 10245, 10257,
  10260, 10305, 10308, 10320, 10378, 10410, 10497, 10500,
  10512, 10645, 10762, 10786, 10852, 10888, 10890, 16385,
  16388, 16390, 16393, 16400, 16402, 16405, 16408, 16410,
  16417, 16420, 16422, 16448, 16450, 16453, 16456, 16458,
  16465, 16468, 16470, 16473, 16480, 16482, 16485, 16513,
  16516, 16528, 16533, 16536, 16545, 16548, 16640, 16642,
  16645, 16648, 16657, 16660, 16662, 16665, 16672, 16674,
  16677, 16705, 16708, 16710, 16713, 16720, 16722, 16725,
  16728, 16737, 16740, 16768, 16770, 16773, 16776, 16785,
  16788, 16800, 16897, 16900, 16912, 16914, 16917, 16920,
  16932, 16960, 16965, 16968, 16977, 16980, 16992, 17025,
  17028, 17408, 17410, 17413, 17416, 17418, 17425, 17428,
  17430, 17433, 17440, 17442, 17445, 17448, 17473, 17476,
  17478, 17481, 17488, 17490, 17493, 17496, 17505, 17508,
  17536, 17538, 17541, 17544, 17553, 17556, 17568, 17665,
  17668, 17670, 17673, 17680, 17682, 17685, 17688, 17697,
  17700, 17728, 17730, 17733, 17736, 17745, 17748, 17760,
  17770, 17793, 17796, 17808, 17920, 17922, 17925, 17928,
  17937, 17940, 17952, 17985, 17988, 18000, 18048, 18085,
  18433, 18436, 18441, 18448, 18450, 18453, 18456, 18465,
  18468, 18496, 18498, 18501, 18504, 18513, 18516, 18528,
  18564, 18576, 18688, 18690, 18693, 18696, 18705, 18708,
  18720, 18753, 18756, 18768, 18816, 18838, 18945, 18948,
  18960, 19008, 20480, 20482, 20485, 20488, 20497, 20500,
  20502, 20505, 20512, 20514, 20517, 20520, 20545, 20548,
  20550, 20553, 20560, 20562, 20565, 20568, 20577, 20580,
  20608, 20610, 20613, 20616, 20625, 20628, 20737, 20740,
  20742, 20745, 20752, 20754, 20757, 20760, 20769, 20772,
  20800, 20802, 20805, 20808, 20817, 20820, 20832, 20865,
  20868, 20880, 20992, 20997, 21000, 21009, 21012, 21024,
  21057, 21060, 21072, 21097, 21120, 21505, 21508, 21510,
  21513, 21520, 21522, 21525, 21528, 21537, 21540, 21568,
  21570, 21573, 21576, 21585, 21588, 21600, 21633, 21636,
  21648, 21760, 21762, 21765, 21768, 21777, 21780, 21792,
  21825, 21828, 21840, 21888, 22017, 22020, 22032, 22054,
  22080, 22528, 22530, 22533, 22536, 22545, 22548, 22560,
  22593, 22596, 22608, 22618, 22656, 22785, 22788, 22800,
  22848, 23040, 23065, 23173, 23208, 24577, 24580, 24582,
  24592, 24594, 24597, 24600, 24609, 24612, 24640, 24645,
  24648, 24657, 24660, 24672, 24708, 24720, 24832, 24834,
  24837, 24840, 24849, 24852, 24864, 24897, 24900, 24912,
  24960, 24985, 25092, 25104, 25152, 25174, 25249, 25600,
  25605, 25608, 25617, 25620, 25632, 25665, 25668, 25680,
  25728, 25857, 25860, 25872, 25920, 25930, 25960, 26002,
  26112, 26260, 26625, 26628, 26640, 26725, 26776, 26880,
  26922, 27202, 27297, 32768, 32770, 32773, 32776, 32785,
  32788, 32793, 32800, 32805, 32833, 32836, 32848, 32850,
  32853, 32856, 32865, 32896, 32901, 32913, 32916, 33025,
  33028, 33033, 33040, 33042, 33045, 33048, 33057, 33060,
  33088, 33090, 33093, 33096, 33105, 33108, 33153, 33156,
  33168, 33193, 33280, 33285, 33290, 33297, 33300, 33345,
  33348, 33360, 33793, 33796, 33798, 33801, 33808, 33810,
  33813, 33816, 33825, 33856, 33858, 33861, 33864, 33873,
  33876, 33888, 33921, 33924, 33936, 34048, 34050, 34053,
  34056, 34065, 34068, 34080, 34113, 34116, 34128, 34176,
  34186, 34305, 34308, 34320, 34345, 34368, 34816, 34821,
  34833, 34836, 34881, 34884, 34896, 34978, 35073, 35076,
  35136, 35173, 35362, 35416, 35418, 35458, 35490, 36865,
  36868, 36873, 36880, 36882, 36885, 36888, 36900, 36928,
  36930, 36933, 36936, 36945, 36948, 36960, 36993, 36996,
  37008, 37120, 37125, 37137, 37140, 37185, 37188, 37200,
  37210, 37377, 37380, 37392, 37440, 37542, 37888, 37890,
  37893, 37896, 37905, 37908, 37920, 37953, 37956, 37968,
  38016, 38038, 38145, 38148, 38160, 38208, 38296, 38305,
  38400, 38470, 38500, 38913, 38916, 38928, 38950, 38976,
  39081, 39168, 39241, 39250, 39568, 40960, 40965, 40970,
  40980, 40994, 41002, 41025, 41028, 41040, 41122, 41130,
  41280, 41317, 41474, 41482, 41506, 41512, 41514, 41602,
  41608, 41610, 41640, 41985, 41988, 42000, 42048, 42121,
  42148, 42240, 42265, 42577, 43018, 43048, 43170, 43348,
  43398, 43528, 43530, 43552, 43554, 43560, 43656, 43690,
]);

const IQ1_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 2, 5, 8, 10, 17, 21, 32,
  34, 40, 42, 69, 81, 84, 86, 101,
  128, 130, 136, 138, 149, 160, 162, 168,
  170, 260, 261, 273, 276, 278, 281, 282,
  293, 321, 326, 329, 338, 341, 346, 353,
  356, 358, 360, 389, 401, 404, 406, 421,
  512, 514, 520, 522, 533, 544, 546, 552,
  554, 581, 593, 601, 612, 617, 640, 642,
  648, 650, 657, 661, 665, 672, 674, 680,
  682, 1041, 1044, 1046, 1061, 1089, 1097, 1109,
  1114, 1124, 1125, 1169, 1177, 1189, 1281, 1284,
  1285, 1286, 1301, 1304, 1306, 1321, 1344, 1349,
  1354, 1360, 1361, 1364, 1365, 1366, 1369, 1376,
  1378, 1381, 1384, 1386, 1409, 1425, 1429, 1432,
  1434, 1441, 1444, 1445, 1446, 1449, 1556, 1561,
  1601, 1604, 1616, 1618, 1621, 1624, 1632, 1633,
  1638, 1641, 1669, 1681, 1684, 1689, 2048, 2050,
  2056, 2058, 2069, 2080, 2082, 2088, 2090, 2117,
  2129, 2134, 2149, 2176, 2178, 2184, 2186, 2197,
  2208, 2210, 2216, 2218, 2309, 2321, 2324, 2329,
  2340, 2341, 2369, 2384, 2385, 2389, 2401, 2404,
  2409, 2449, 2452, 2454, 2457, 2469, 2560, 2562,
  2568, 2570, 2581, 2592, 2594, 2600, 2602, 2629,
  2641, 2649, 2657, 2661, 2688, 2690, 2693, 2696,
  2698, 2709, 2720, 2722, 2728, 2730, 4112, 4113,
  4116, 4121, 4132, 4133, 4161, 4164, 4176, 4181,
  4184, 4193, 4196, 4197, 4201, 4241, 4244, 4246,
  4257, 4261, 4353, 4356, 4358, 4361, 4368, 4370,
  4373, 4376, 4385, 4388, 4393, 4421, 4426, 4432,
  4433, 4434, 4436, 4437, 4438, 4441, 4448, 4453,
  4484, 4498, 4501, 4513, 4516, 4625, 4628, 4630,
  4645, 4672, 4678, 4681, 4690, 4693, 4696, 4698,
  4708, 4710, 4741, 4753, 4756, 4758, 4773, 5121,
  5126, 5129, 5140, 5141, 5144, 5145, 5153, 5158,
  5185, 5189, 5190, 5192, 5194, 5201, 5204, 5205,
  5206, 5209, 5218, 5221, 5224, 5252, 5257, 5264,
  5268, 5269, 5272, 5273, 5274, 5281, 5284, 5285,
  5289, 5378, 5381, 5386, 5393, 5396, 5397, 5398,
  5401, 5408, 5410, 5413, 5416, 5418, 5441, 5444,
  5445, 5446, 5457, 5458, 5460, 5461, 5462, 5465,
  5466, 5473, 5476, 5477, 5478, 5481, 5504, 5506,
  5508, 5509, 5512, 5514, 5520, 5521, 5524, 5525,
  5526, 5529, 5530, 5536, 5538, 5541, 5633, 5636,
  5637, 5638, 5653, 5654, 5656, 5658, 5665, 5670,
  5696, 5698, 5700, 5701, 5704, 5706, 5713, 5717,
  5718, 5720, 5721, 5729, 5732, 5733, 5736, 5737,
  5738, 5766, 5770, 5778, 5781, 5796, 5801, 6161,
  6166, 6181, 6209, 6212, 6214, 6217, 6224, 6229,
  6232, 6234, 6240, 6241, 6244, 6246, 6249, 6277,
  6289, 6292, 6309, 6416, 6418, 6421, 6426, 6433,
  6437, 6466, 6468, 6469, 6472, 6481, 6484, 6485,
  6486, 6489, 6490, 6496, 6501, 6506, 6537, 6545,
  6546, 6549, 6552, 6561, 6566, 6569, 6665, 6678,
  6692, 6694, 6724, 6726, 6729, 6736, 6738, 6741,
  6744, 6753, 6758, 6761, 6789, 6801, 6806, 6810,
  8192, 8194, 8200, 8202, 8213, 8224, 8226, 8229,
  8232, 8234, 8261, 8273, 8281, 8289, 8293, 8320,
  8322, 8328, 8330, 8341, 8352, 8354, 8357, 8360,
  8362, 8453, 8465, 8468, 8473, 8485, 8514, 8516,
  8521, 8533, 8536, 8538, 8545, 8548, 8549, 8550,
  8581, 8592, 8598, 8601, 8613, 8705, 8712, 8714,
  8721, 8725, 8736, 8738, 8744, 8746, 8773, 8785,
  8790, 8793, 8805, 8833, 8840, 8842, 8849, 8853,
  8864, 8866, 8872, 8874, 9221, 9236, 9238, 9241,
  9253, 9284, 9285, 9286, 9289, 9298, 9301, 9304,
  9306, 9318, 9349, 9361, 9364, 9369, 9377, 9381,
  9481, 9493, 9505, 9513, 9536, 9541, 9544, 9553,
  9556, 9557, 9561, 9570, 9573, 9576, 9609, 9616,
  9620, 9621, 9624, 9626, 9633, 9636, 9638, 9641,
  9733, 9744, 9746, 9753, 9765, 9793, 9801, 9813,
  9824, 9825, 9833, 9860, 9862, 9872, 9882, 10240,
  10242, 10248, 10250, 10261, 10272, 10274, 10280, 10282,
  10309, 10321, 10324, 10341, 10368, 10370, 10376, 10378,
  10400, 10402, 10408, 10410, 10505, 10513, 10516, 10521,
  10533, 10566, 10569, 10578, 10581, 10593, 10596, 10598,
  10601, 10629, 10640, 10646, 10649, 10660, 10661, 10752,
  10754, 10760, 10762, 10784, 10786, 10792, 10794, 10821,
  10833, 10838, 10841, 10853, 10880, 10882, 10888, 10890,
  10901, 10912, 10914, 10920, 10922, 16389, 16401, 16406,
  16421, 16457, 16466, 16469, 16472, 16474, 16481, 16484,
  16486, 16532, 16537, 16545, 16550, 16640, 16641, 16644,
  16646, 16649, 16658, 16661, 16662, 16664, 16666, 16673,
  16678, 16681, 16709, 16712, 16714, 16721, 16724, 16725,
  16726, 16729, 16730, 16741, 16744, 16746, 16769, 16772,
  16774, 16784, 16786, 16789, 16800, 16801, 16802, 16901,
  16913, 16916, 16918, 16933, 16961, 16978, 16981, 16986,
  16996, 17001, 17033, 17044, 17061, 17409, 17429, 17433,
  17449, 17477, 17480, 17482, 17489, 17492, 17493, 17494,
  17505, 17506, 17509, 17512, 17514, 17537, 17542, 17545,
  17552, 17554, 17557, 17568, 17569, 17577, 17665, 17666,
  17669, 17674, 17681, 17684, 17685, 17686, 17689, 17696,
  17701, 17706, 17729, 17732, 17733, 17734, 17737, 17744,
  17745, 17748, 17749, 17750, 17752, 17753, 17761, 17764,
  17765, 17766, 17769, 17794, 17796, 17797, 17800, 17809,
  17812, 17813, 17814, 17817, 17818, 17829, 17832, 17834,
  17921, 17925, 17929, 17940, 17941, 17944, 17946, 17953,
  17956, 17961, 17984, 17986, 17989, 17992, 18000, 18001,
  18002, 18005, 18006, 18009, 18018, 18021, 18024, 18049,
  18053, 18058, 18068, 18069, 18081, 18084, 18086, 18437,
  18449, 18453, 18458, 18469, 18498, 18505, 18512, 18517,
  18520, 18529, 18532, 18534, 18537, 18565, 18577, 18580,
  18582, 18585, 18597, 18689, 18693, 18694, 18698, 18704,
  18708, 18709, 18712, 18721, 18724, 18726, 18752, 18757,
  18762, 18769, 18770, 18772, 18773, 18774, 18777, 18784,
  18786, 18789, 18790, 18794, 18822, 18825, 18834, 18837,
  18838, 18840, 18849, 18852, 18854, 18857, 18966, 19012,
  19014, 19017, 19029, 19032, 19034, 19044, 19049, 19092,
  19109, 20481, 20484, 20485, 20486, 20489, 20498, 20501,
  20506, 20513, 20516, 20521, 20544, 20549, 20552, 20561,
  20564, 20565, 20566, 20569, 20581, 20584, 20614, 20617,
  20629, 20632, 20640, 20641, 20646, 20649, 20741, 20744,
  20745, 20746, 20753, 20756, 20757, 20758, 20760, 20761,
  20768, 20773, 20774, 20776, 20778, 20801, 20804, 20805,
  20806, 20809, 20816, 20817, 20818, 20820, 20821, 20822,
  20824, 20825, 20826, 20833, 20836, 20837, 20838, 20841,
  20866, 20869, 20881, 20884, 20885, 20886, 20889, 20896,
  20901, 20906, 20993, 20998, 21010, 21013, 21018, 21025,
  21028, 21058, 21061, 21066, 21073, 21076, 21077, 21078,
  21081, 21090, 21093, 21125, 21136, 21138, 21141, 21145,
  21146, 21156, 21508, 21509, 21521, 21524, 21525, 21526,
  21528, 21529, 21537, 21541, 21544, 21546, 21569, 21572,
  21573, 21574, 21577, 21578, 21584, 21585, 21588, 21589,
  21590, 21592, 21593, 21594, 21601, 21602, 21604, 21605,
  21606, 21609, 21632, 21640, 21642, 21649, 21652, 21653,
  21654, 21657, 21665, 21668, 21669, 21674, 21761, 21762,
  21764, 21765, 21766, 21769, 21776, 21777, 21778, 21780,
  21781, 21782, 21785, 21786, 21793, 21796, 21797, 21798,
  21801, 21824, 21825, 21826, 21828, 21829, 21830, 21832,
  21833, 21840, 21841, 21842, 21844, 21845, 21846, 21848,
  21849, 21850, 21856, 21857, 21860, 21861, 21862, 21864,
  21865, 21866, 21889, 21892, 21893, 21897, 21898, 21904,
  21905, 21908, 21909, 21910, 21912, 21913, 21921, 21924,
  21925, 21926, 21929, 22016, 22017, 22018, 22020, 22022,
  22024, 22025, 22033, 22036, 22037, 22040, 22041, 22048,
  22049, 22050, 22052, 22053, 22054, 22056, 22057, 22081,
  22085, 22086, 22088, 22089, 22090, 22096, 22097, 22098,
  22100, 22101, 22102, 22104, 22105, 22106, 22113, 22116,
  22117, 22121, 22146, 22149, 22150, 22152, 22153, 22154,
  22161, 22165, 22170, 22178, 22181, 22182, 22184, 22185,
  22532, 22533, 22534, 22537, 22544, 22549, 22552, 22561,
  22570, 22597, 22600, 22602, 22609, 22612, 22613, 22614,
  22616, 22617, 22624, 22626, 22628, 22629, 22658, 22665,
  22672, 22674, 22677, 22680, 22689, 22697, 22785, 22786,
  22789, 22794, 22801, 22804, 22805, 22806, 22809, 22821,
  22849, 22852, 22853, 22854, 22857, 22864, 22865, 22866,
  22868, 22869, 22870, 22872, 22873, 22874, 22881, 22884,
  22885, 22886, 22889, 22913, 22917, 22921, 22929, 22932,
  22933, 22934, 22936, 22937, 22949, 23044, 23048, 23061,
  23066, 23072, 23077, 23078, 23081, 23109, 23112, 23113,
  23121, 23125, 23126, 23128, 23129, 23138, 23141, 23144,
  23146, 23169, 23178, 23186, 23189, 23190, 23192, 23194,
  23201, 24581, 24596, 24598, 24601, 24613, 24644, 24656,
  24661, 24662, 24664, 24666, 24673, 24676, 24678, 24681,
  24705, 24726, 24741, 24833, 24836, 24838, 24841, 24850,
  24853, 24865, 24866, 24870, 24873, 24901, 24905, 24913,
  24917, 24918, 24921, 24933, 24934, 24938, 24964, 24970,
  24978, 24981, 24993, 24998, 25001, 25105, 25110, 25113,
  25152, 25153, 25158, 25173, 25174, 25176, 25184, 25221,
  25233, 25238, 25253, 25617, 25618, 25621, 25622, 25626,
  25633, 25638, 25641, 25664, 25666, 25669, 25672, 25674,
  25681, 25684, 25685, 25686, 25689, 25690, 25696, 25698,
  25701, 25732, 25733, 25737, 25744, 25746, 25748, 25749,
  25750, 25752, 25754, 25761, 25764, 25769, 25861, 25864,
  25866, 25873, 25877, 25878, 25881, 25924, 25925, 25926,
  25929, 25936, 25937, 25940, 25941, 25942, 25945, 25953,
  25956, 25957, 25958, 25961, 25990, 25993, 25994, 26001,
  26005, 26006, 26009, 26010, 26018, 26021, 26022, 26024,
  26114, 26121, 26133, 26144, 26150, 26152, 26153, 26176,
  26181, 26184, 26186, 26193, 26196, 26197, 26198, 26200,
  26202, 26208, 26213, 26216, 26240, 26242, 26245, 26250,
  26260, 26262, 26264, 26265, 26272, 26276, 26278, 26282,
  26646, 26649, 26661, 26689, 26706, 26709, 26714, 26721,
  26729, 26757, 26769, 26776, 26790, 26881, 26884, 26896,
  26901, 26913, 26916, 26918, 26921, 26944, 26945, 26949,
  26950, 26952, 26961, 26964, 26965, 26966, 26969, 26976,
  26981, 26986, 27010, 27012, 27018, 27029, 27041, 27044,
  27045, 27049, 27153, 27158, 27160, 27201, 27204, 27209,
  27216, 27221, 27224, 27226, 27236, 27237, 27241, 27270,
  27284, 27288, 27290, 27302, 32768, 32770, 32776, 32778,
  32800, 32802, 32808, 32810, 32837, 32848, 32849, 32852,
  32854, 32857, 32869, 32896, 32898, 32904, 32906, 32917,
  32928, 32930, 32936, 32938, 33029, 33041, 33044, 33046,
  33049, 33061, 33089, 33092, 33097, 33104, 33106, 33109,
  33110, 33112, 33113, 33124, 33126, 33129, 33157, 33161,
  33172, 33174, 33177, 33189, 33280, 33282, 33288, 33290,
  33301, 33312, 33314, 33320, 33322, 33361, 33364, 33369,
  33381, 33408, 33410, 33416, 33418, 33429, 33440, 33442,
  33448, 33450, 33812, 33817, 33857, 33860, 33873, 33877,
  33882, 33889, 33892, 33897, 33940, 33945, 34049, 34057,
  34066, 34069, 34074, 34086, 34089, 34112, 34113, 34117,
  34120, 34129, 34132, 34133, 34134, 34137, 34138, 34149,
  34150, 34152, 34154, 34177, 34180, 34182, 34185, 34192,
  34194, 34197, 34200, 34214, 34321, 34326, 34329, 34341,
  34369, 34372, 34377, 34378, 34384, 34389, 34393, 34394,
  34401, 34406, 34410, 34437, 34449, 34458, 34468, 34816,
  34818, 34824, 34826, 34837, 34848, 34850, 34856, 34858,
  34881, 34885, 34897, 34900, 34905, 34917, 34921, 34944,
  34946, 34952, 34954, 34965, 34976, 34978, 34984, 34986,
  35077, 35078, 35089, 35092, 35094, 35109, 35137, 35140,
  35142, 35145, 35152, 35154, 35157, 35162, 35169, 35172,
  35205, 35222, 35225, 35237, 35328, 35330, 35336, 35338,
  35349, 35360, 35362, 35368, 35370, 35397, 35409, 35412,
  35414, 35456, 35458, 35464, 35466, 35477, 35488, 35490,
  35496, 35498, 36869, 36881, 36886, 36888, 36889, 36901,
  36929, 36934, 36937, 36949, 36952, 36954, 36969, 36970,
  36997, 37009, 37012, 37014, 37017, 37029, 37121, 37124,
  37126, 37129, 37136, 37141, 37144, 37146, 37153, 37156,
  37158, 37161, 37184, 37189, 37200, 37201, 37204, 37205,
  37206, 37209, 37218, 37221, 37252, 37254, 37266, 37269,
  37272, 37281, 37284, 37286, 37289, 37381, 37393, 37396,
  37401, 37413, 37444, 37446, 37449, 37456, 37458, 37461,
  37464, 37478, 37481, 37509, 37524, 37526, 37545, 37889,
  37892, 37894, 37904, 37909, 37912, 37926, 37952, 37962,
  37969, 37972, 37973, 37974, 37976, 37977, 37984, 37985,
  37986, 37989, 38020, 38022, 38034, 38036, 38037, 38040,
  38049, 38057, 38144, 38149, 38152, 38154, 38160, 38161,
  38164, 38165, 38166, 38169, 38177, 38181, 38185, 38186,
  38209, 38212, 38213, 38214, 38217, 38224, 38225, 38226,
  38228, 38229, 38230, 38232, 38233, 38234, 38241, 38244,
  38245, 38246, 38249, 38273, 38277, 38280, 38289, 38290,
  38292, 38293, 38294, 38297, 38298, 38304, 38306, 38309,
  38312, 38314, 38401, 38404, 38416, 38421, 38425, 38432,
  38438, 38441, 38469, 38472, 38473, 38481, 38482, 38485,
  38486, 38489, 38501, 38504, 38530, 38532, 38537, 38538,
  38546, 38548, 38549, 38564, 38566, 38569, 38917, 38934,
  38937, 38949, 38977, 38982, 38992, 38994, 38997, 38998,
  39002, 39012, 39013, 39045, 39057, 39062, 39065, 39077,
  39172, 39174, 39177, 39184, 39186, 39189, 39192, 39194,
  39200, 39201, 39204, 39206, 39232, 39234, 39237, 39240,
  39242, 39249, 39252, 39253, 39254, 39257, 39266, 39269,
  39270, 39274, 39297, 39300, 39312, 39314, 39317, 39322,
  39329, 39334, 39429, 39445, 39461, 39492, 39494, 39497,
  39504, 39509, 39512, 39521, 39557, 39569, 39572, 39573,
  39574, 40960, 40962, 40968, 40970, 40981, 40992, 40994,
  41000, 41002, 41029, 41041, 41044, 41046, 41049, 41088,
  41090, 41096, 41098, 41109, 41120, 41122, 41128, 41130,
  41221, 41225, 41233, 41236, 41238, 41241, 41242, 41286,
  41289, 41297, 41301, 41304, 41306, 41313, 41316, 41349,
  41360, 41362, 41366, 41369, 41474, 41480, 41482, 41488,
  41497, 41506, 41512, 41514, 41541, 41553, 41558, 41561,
  41573, 41600, 41602, 41608, 41610, 41621, 41632, 41634,
  41640, 41642, 42009, 42021, 42049, 42052, 42064, 42068,
  42069, 42072, 42074, 42081, 42085, 42086, 42088, 42089,
  42117, 42246, 42249, 42256, 42258, 42261, 42264, 42278,
  42281, 42306, 42309, 42321, 42324, 42325, 42326, 42329,
  42341, 42346, 42369, 42372, 42373, 42374, 42377, 42386,
  42389, 42392, 42501, 42513, 42518, 42522, 42529, 42533,
  42564, 42566, 42570, 42578, 42581, 42582, 42584, 42592,
  42594, 42630, 42640, 42645, 42646, 42649, 42657, 42660,
  42662, 43008, 43010, 43016, 43018, 43040, 43042, 43048,
  43050, 43089, 43092, 43094, 43097, 43136, 43138, 43144,
  43146, 43157, 43168, 43170, 43176, 43178, 43269, 43284,
  43289, 43297, 43301, 43329, 43344, 43349, 43354, 43361,
  43366, 43369, 43408, 43414, 43520, 43522, 43528, 43530,
  43552, 43554, 43560, 43562, 43601, 43604, 43606, 43648,
  43650, 43656, 43658, 43669, 43680, 43682, 43688, 43690,
]);

const IQ3_XXS_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 2, 4, 9, 11, 15, 16, 18,
  25, 34, 59, 61, 65, 67, 72, 74,
  81, 85, 88, 90, 97, 108, 120, 128,
  130, 132, 137, 144, 146, 153, 155, 159,
  169, 175, 189, 193, 199, 200, 202, 213,
  248, 267, 287, 292, 303, 315, 317, 321,
  327, 346, 362, 413, 436, 456, 460, 462,
  483, 497, 513, 515, 520, 522, 529, 531,
  536, 538, 540, 551, 552, 576, 578, 585,
  592, 594, 641, 643, 648, 650, 657, 664,
  698, 704, 706, 720, 729, 742, 758, 769,
  773, 808, 848, 852, 870, 889, 901, 978,
  992, 1024, 1026, 1033, 1035, 1040, 1042, 1046,
  1049, 1058, 1089, 1091, 1093, 1096, 1098, 1105,
  1112, 1139, 1143, 1144, 1152, 1154, 1161, 1167,
  1168, 1170, 1183, 1184, 1197, 1217, 1224, 1228,
  1272, 1276, 1309, 1323, 1347, 1367, 1377, 1404,
  1473, 1475, 1486, 1509, 1537, 1544, 1546, 1553,
  1555, 1576, 1589, 1594, 1600, 1602, 1616, 1625,
  1636, 1638, 1665, 1667, 1672, 1685, 1706, 1722,
  1737, 1755, 1816, 1831, 1850, 1856, 1862, 1874,
  1901, 1932, 1950, 1971, 2011, 2032, 2052, 2063,
  2077, 2079, 2091, 2095, 2172, 2192, 2207, 2208,
  2224, 2230, 2247, 2277, 2308, 2345, 2356, 2389,
  2403, 2424, 2501, 2504, 2506, 2520, 2570, 2593,
  2616, 2624, 2630, 2646, 2669, 2700, 2714, 2746,
  2754, 2795, 2824, 2835, 2839, 2874, 2882, 2905,
  2984, 3028, 3042, 3092, 3108, 3110, 3124, 3153,
  3185, 3215, 3252, 3288, 3294, 3364, 3397, 3434,
  3483, 3523, 3537, 3587, 3589, 3591, 3592, 3610,
  3626, 3670, 3680, 3722, 3749, 3754, 3776, 3789,
  3803, 3824, 3857, 3873, 3904, 3906, 3924, 3992,
]);

const IQ3_S_PATTERNS: StaticArray<u16> = StaticArray.fromArray<u16>([
  0, 1, 2, 5, 7, 8, 9, 10,
  12, 14, 16, 17, 21, 27, 32, 34,
  37, 39, 41, 43, 48, 50, 57, 60,
  63, 64, 65, 66, 68, 72, 73, 77,
  80, 83, 87, 89, 93, 100, 113, 117,
  122, 128, 129, 133, 135, 136, 139, 142,
  145, 149, 152, 156, 162, 165, 167, 169,
  171, 184, 187, 195, 201, 205, 208, 210,
  217, 219, 222, 228, 232, 234, 247, 249,
  253, 256, 267, 271, 273, 276, 282, 288,
  291, 297, 312, 322, 324, 336, 338, 342,
  347, 353, 357, 359, 374, 379, 390, 393,
  395, 409, 426, 441, 448, 450, 452, 464,
  466, 470, 475, 488, 492, 512, 513, 514,
  516, 520, 521, 523, 525, 527, 528, 530,
  537, 540, 542, 556, 558, 561, 570, 576,
  577, 579, 582, 584, 588, 593, 600, 603,
  609, 616, 618, 632, 638, 640, 650, 653,
  655, 656, 660, 666, 672, 675, 685, 688,
  698, 705, 708, 711, 712, 715, 721, 727,
  728, 732, 737, 754, 760, 771, 773, 778,
  780, 793, 795, 802, 806, 808, 812, 833,
  840, 843, 849, 856, 858, 873, 912, 916,
  919, 932, 934, 961, 963, 968, 970, 977,
  989, 993, 1010, 1016, 1024, 1025, 1027, 1029,
  1031, 1032, 1034, 1036, 1038, 1041, 1043, 1047,
  1048, 1050, 1057, 1059, 1061, 1064, 1066, 1079,
  1080, 1083, 1085, 1088, 1090, 1096, 1099, 1103,
  1106, 1109, 1113, 1116, 1122, 1129, 1153, 1156,
  1159, 1169, 1171, 1176, 1183, 1185, 1195, 1199,
  1209, 1212, 1216, 1218, 1221, 1225, 1234, 1236,
  1241, 1243, 1250, 1256, 1270, 1281, 1287, 1296,
  1299, 1306, 1309, 1313, 1338, 1341, 1348, 1353,
  1362, 1375, 1376, 1387, 1400, 1408, 1410, 1415,
  1425, 1453, 1457, 1477, 1481, 1494, 1496, 1507,
  1512, 1538, 1545, 1547, 1549, 1551, 1554, 1561,
  1563, 1565, 1570, 1572, 1575, 1577, 1587, 1593,
  1601, 1603, 1605, 1612, 1617, 1619, 1632, 1648,
  1658, 1662, 1664, 1674, 1680, 1690, 1692, 1704,
  1729, 1736, 1740, 1745, 1747, 1751, 1752, 1761,
  1763, 1767, 1773, 1787, 1795, 1801, 1806, 1810,
  1817, 1834, 1840, 1844, 1857, 1864, 1866, 1877,
  1882, 1892, 1902, 1915, 1934, 1953, 1985, 1987,
  2000, 2002, 2013, 2048, 2052, 2058, 2064, 2068,
  2071, 2074, 2081, 2088, 2104, 2114, 2119, 2121,
  2123, 2130, 2136, 2141, 2147, 2153, 2157, 2177,
  2179, 2184, 2189, 2193, 2203, 2208, 2223, 2226,
  2232, 2244, 2249, 2251, 2256, 2258, 2265, 2269,
  2304, 2306, 2324, 2335, 2336, 2361, 2373, 2375,
  2385, 2418, 2443, 2460, 2480, 2504, 2509, 2520,
  2531, 2537, 2562, 2568, 2572, 2578, 2592, 2596,
  2599, 2602, 2614, 2620, 2625, 2627, 2629, 2634,
  2641, 2650, 2682, 2688, 2697, 2707, 2712, 2718,
  2731, 2754, 2759, 2760, 2775, 2788, 2793, 2805,
  2811, 2817, 2820, 2832, 2842, 2854, 2890, 2902,
  2921, 2923, 2978, 3010, 3012, 3026, 3081, 3083,
  3085, 3097, 3099, 3120, 3136, 3152, 3159, 3188,
  3210, 3228, 3234, 3245, 3250, 3256, 3264, 3276,
  3281, 3296, 3349, 3363, 3378, 3392, 3395, 3420,
  3440, 3461, 3488, 3529, 3531, 3584, 3588, 3591,
  3600, 3602, 3614, 3616, 3628, 3634, 3650, 3657,
  3668, 3683, 3685, 3713, 3716, 3720, 3726, 3729,
  3736, 3753, 3778, 3802, 3805, 3819, 3841, 3845,
  3851, 3856, 3880, 3922, 3938, 3970, 3993, 4032,
]);

function iqSignBits(index: u32): u32 {
  let parity = index;
  parity ^= parity >>> 4;
  parity ^= parity >>> 2;
  parity ^= parity >>> 1;
  return index | ((parity & 1) << 7);
}

function iq2XxsGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ2_XXS_LUT[i32(index)]);
  return f32((u32(packed >> i32(lane * 8))) & 0xff);
}

function iq2XsGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ2_XS_LUT[i32(index)]);
  return f32((u32(packed >> i32(lane * 8))) & 0xff);
}

function iq2SGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ2_S_LUT[i32(index)]);
  return f32((u32(packed >> i32(lane * 8))) & 0xff);
}

function iq3XxsGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ3_XXS_LUT[i32(index)]);
  return f32((packed >>> i32(lane * 8)) & 0xff);
}

function iq3SGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ3_S_LUT[i32(index)]);
  return f32((packed >>> i32(lane * 8)) & 0xff);
}

function iq1SGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ1_S_LUT[i32(index)]);
  const byteValue = u32(packed >> i32(lane * 8)) & 0xff;
  return f32(byteValue < 128 ? i32(byteValue) : i32(byteValue) - 256);
}

function iqSignFactor(signIndex: u32, lane: u32): f32 {
  const signs = iqSignBits(signIndex);
  return (signs & (u32(1) << i32(lane))) != 0 ? -1.0 : 1.0;
}

function iqPatternDigit(patterns: StaticArray<u16>, index: u32, lane: u32, bitsPerDigit: u32): u32 {
  const pattern = u32(unchecked(patterns[i32(index)]));
  const mask = (u32(1) << i32(bitsPerDigit)) - 1;
  return (pattern >> i32(lane * bitsPerDigit)) & mask;
}

function iqPatternDistance(
  patterns: StaticArray<u16>,
  index: u32,
  targetPattern: u32,
  count: u32,
  bitsPerDigit: u32,
): u32 {
  const pattern = u32(unchecked(patterns[i32(index)]));
  const mask = (u32(1) << i32(bitsPerDigit)) - 1;
  let distance: u32 = 0;
  for (let lane: u32 = 0; lane < count; lane++) {
    const shift = i32(lane * bitsPerDigit);
    const difference = i32((pattern >> shift) & mask) - i32((targetPattern >> shift) & mask);
    distance += u32(difference * difference);
  }
  return distance;
}

function findIQLatticePattern(
  patterns: StaticArray<u16>,
  gridSize: u32,
  count: u32,
  bitsPerDigit: u32,
  neighbourRings: u32,
  targetPattern: u32,
  values: StaticArray<f32>,
  valueStart: u32,
  searchWeights: StaticArray<f32>,
  weightStart: u32,
  scale: f32,
): u32 {
  let lower: i32 = 0;
  let upper = i32(gridSize);
  while (lower < upper) {
    const middle = (lower + upper) >> 1;
    const pattern = u32(unchecked(patterns[middle]));
    if (pattern < targetPattern) lower = middle + 1;
    else upper = middle;
  }
  if (u32(lower) < gridSize && u32(unchecked(patterns[lower])) == targetPattern) {
    return u32(lower);
  }

  let previousDistance: i32 = -1;
  let bestIndex: u32 = 0;
  let bestError: f32 = 3.4028235e38;
  for (let ring: u32 = 0; ring < neighbourRings; ring++) {
    let nextDistance: u32 = 0xffffffff;
    for (let candidate: u32 = 0; candidate < gridSize; candidate++) {
      const distance = iqPatternDistance(patterns, candidate, targetPattern, count, bitsPerDigit);
      if ((previousDistance < 0 || distance > u32(previousDistance)) && distance < nextDistance) {
        nextDistance = distance;
      }
    }
    for (let candidate: u32 = 0; candidate < gridSize; candidate++) {
      if (iqPatternDistance(patterns, candidate, targetPattern, count, bitsPerDigit) != nextDistance) continue;
      let error: f32 = 0.0;
      for (let lane: u32 = 0; lane < count; lane++) {
        const digit = iqPatternDigit(patterns, candidate, lane, bitsPerDigit);
        const quant = f32((digit << 1) + 1);
        const difference = scale * quant - values[i32(valueStart + lane)];
        error += searchWeights[i32(weightStart + lane)] * difference * difference;
      }
      if (error < bestError) {
        bestError = error;
        bestIndex = candidate;
      }
    }
    previousDistance = i32(nextDistance);
  }
  return bestIndex;
}

function makeQpQuants(
  values: StaticArray<f32>,
  weights: StaticArray<f32>,
  count: u32,
  maxLevel: i32,
  levels: StaticArray<u8>,
): f32 {
  let maximum: f32 = 0.0;
  for (let lane: u32 = 0; lane < count; lane++) {
    if (values[i32(lane)] > maximum) maximum = values[i32(lane)];
  }
  if (maximum < K_GROUP_MAX_EPS) {
    for (let lane: u32 = 0; lane < count; lane++) levels[i32(lane)] = 0;
    return 0.0;
  }

  let inverseScale = f32(maxLevel) / maximum;
  let scale: f32 = f32(1.0) / inverseScale;
  let bestError: f32 = 0.0;
  for (let lane: u32 = 0; lane < count; lane++) {
    const quant = roundNearestEven(inverseScale * values[i32(lane)]);
    levels[i32(lane)] = u8(quant);
    const difference: f32 = values[i32(lane)] - scale * f32(quant);
    bestError += weights[i32(lane)] * difference * difference;
  }

  for (let step: i32 = -4; step <= 4; step++) {
    if (step == 0) continue;
    const candidateInverse = (f32(maxLevel) + f32(step) * 0.1) / maximum;
    const candidateScale: f32 = f32(1.0) / candidateInverse;
    let error: f32 = 0.0;
    for (let lane: u32 = 0; lane < count; lane++) {
      let quant = roundNearestEven(candidateInverse * values[i32(lane)]);
      if (quant > maxLevel) quant = maxLevel;
      const difference: f32 = values[i32(lane)] - candidateScale * f32(quant);
      error += weights[i32(lane)] * difference * difference;
    }
    if (error < bestError) {
      bestError = error;
      inverseScale = candidateInverse;
    }
  }

  let sumLx: f32 = 0.0;
  let sumL2: f32 = 0.0;
  for (let lane: u32 = 0; lane < count; lane++) {
    let quant = roundNearestEven(inverseScale * values[i32(lane)]);
    if (quant > maxLevel) quant = maxLevel;
    levels[i32(lane)] = u8(quant);
    sumLx += weights[i32(lane)] * values[i32(lane)] * f32(quant);
    sumL2 += weights[i32(lane)] * f32(quant * quant);
  }

  for (let attempt: u32 = 0; attempt < 5; attempt++) {
    let changed: u32 = 0;
    for (let lane: u32 = 0; lane < count; lane++) {
      const weight = weights[i32(lane)];
      const value = values[i32(lane)];
      const current = i32(levels[i32(lane)]);
      const leftLx = sumLx - weight * value * f32(current);
      const leftL2 = sumL2 - weight * f32(current * current);
      if (leftLx > 0.0 && leftL2 > 0.0) {
        let next = roundNearestEven(value * leftL2 / leftLx);
        if (next > maxLevel) next = maxLevel;
        if (next != current) {
          const candidateLx = leftLx + weight * value * f32(next);
          const candidateL2 = leftL2 + weight * f32(next * next);
          if (candidateLx * candidateLx * sumL2 > sumLx * sumLx * candidateL2) {
            levels[i32(lane)] = u8(next);
            sumLx = candidateLx;
            sumL2 = candidateL2;
            changed++;
          }
        }
      }
    }
    if (changed == 0) break;
  }
  return sumL2 > 0.0 ? sumLx / sumL2 : 0.0;
}

const IQ1_POINTS_PLUS: StaticArray<f32> = StaticArray.fromArray<f32>([-0.875, 0.125, 1.125]);
const IQ1_POINTS_MINUS: StaticArray<f32> = StaticArray.fromArray<f32>([-1.125, -0.125, 0.875]);

function iq1Point(shift: i32, level: u32): f32 {
  return shift > 0
    ? unchecked(IQ1_POINTS_PLUS[i32(level)])
    : unchecked(IQ1_POINTS_MINUS[i32(level)]);
}

function findExactIQ1Pattern(targetPattern: u32): i32 {
  let lower: i32 = 0;
  let upper: i32 = 2048;
  while (lower < upper) {
    const middle = (lower + upper) >> 1;
    const pattern = u32(unchecked(IQ1_PATTERNS[middle]));
    if (pattern < targetPattern) lower = middle + 1;
    else upper = middle;
  }
  return u32(lower) < 2048 && u32(unchecked(IQ1_PATTERNS[lower])) == targetPattern ? lower : -1;
}

function findIQ1LatticePattern(
  targetPattern: u32,
  src: FloatPtr,
  srcStart: u32,
  weights: StaticArray<f32>,
  weightStart: u32,
  scale: f32,
  shift: i32,
): u32 {
  const exactIndex = findExactIQ1Pattern(targetPattern);
  if (exactIndex >= 0) return u32(exactIndex);

  let previousDistance: i32 = -1;
  let bestIndex: u32 = 0;
  let bestError: f32 = 3.4028235e38;
  for (let ring: u32 = 0; ring < 3; ring++) {
    let nextDistance: u32 = 0xffffffff;
    for (let candidate: u32 = 0; candidate < 2048; candidate++) {
      const distance = iqPatternDistance(IQ1_PATTERNS, candidate, targetPattern, 8, 2);
      if ((previousDistance < 0 || distance > u32(previousDistance)) && distance < nextDistance) {
        nextDistance = distance;
      }
    }
    for (let candidate: u32 = 0; candidate < 2048; candidate++) {
      if (iqPatternDistance(IQ1_PATTERNS, candidate, targetPattern, 8, 2) != nextDistance) continue;
      let error: f32 = 0.0;
      for (let lane: u32 = 0; lane < 8; lane++) {
        const level = iqPatternDigit(IQ1_PATTERNS, candidate, lane, 2);
        const quant = scale * iq1Point(shift, level);
        const difference = quant - readF32(src, srcStart + lane);
        error += weights[i32(weightStart + lane)] * difference * difference;
      }
      if (error < bestError) {
        bestError = error;
        bestIndex = candidate;
      }
    }
    previousDistance = i32(nextDistance);
  }
  return bestIndex;
}

function quantizeIq1SGroup(
  src: FloatPtr,
  srcStart: u32,
  weights: StaticArray<f32>,
  order: StaticArray<u32>,
  sumX: StaticArray<f32>,
  sumW: StaticArray<f32>,
  levels: StaticArray<u8>,
  indices: StaticArray<u16>,
  shiftResult: StaticArray<i32>,
  shiftIndex: u32,
): f32 {
  let sumSquares: f32 = 0.0;
  for (let lane: u32 = 0; lane < 32; lane++) {
    const value = readF32(src, srcStart + lane);
    sumSquares += value * value;
  }
  if (sumSquares < 1.0e-14) {
    shiftResult[i32(shiftIndex)] = 1;
    for (let subBlock: u32 = 0; subBlock < 4; subBlock++) indices[i32(subBlock)] = 1029;
    return 0.0;
  }

  for (let lane: u32 = 0; lane < 32; lane++) order[i32(lane)] = lane;
  for (let position: i32 = 1; position < 32; position++) {
    const selected = order[position];
    const selectedValue = readF32(src, srcStart + selected);
    let cursor = position - 1;
    while (cursor >= 0 && readF32(src, srcStart + order[cursor]) > selectedValue) {
      order[cursor + 1] = order[cursor];
      cursor--;
    }
    order[cursor + 1] = selected;
  }

  sumX[0] = 0.0;
  sumW[0] = 0.0;
  for (let position: u32 = 0; position < 32; position++) {
    const lane = order[i32(position)];
    const value = readF32(src, srcStart + lane);
    sumX[i32(position + 1)] = sumX[i32(position)] + weights[i32(lane)] * value;
    sumW[i32(position + 1)] = sumW[i32(position)] + weights[i32(lane)];
  }

  let bestScore: f32 = -1.17549435e-38;
  let bestScale: f32 = 0.0;
  let bestFirst: u32 = 0;
  let bestSecond: u32 = 0;
  let bestShift: i32 = 1;
  for (let first: u32 = 0; first <= 32; first++) {
    for (let second: u32 = first; second <= 32; second++) {
      for (let shiftIndex: u32 = 0; shiftIndex < 2; shiftIndex++) {
        const shift = shiftIndex == 0 ? 1 : -1;
        const point0 = iq1Point(shift, 0);
        const point1 = iq1Point(shift, 1);
        const point2 = iq1Point(shift, 2);
        const x0 = sumX[i32(first)] - sumX[0];
        const x1 = sumX[i32(second)] - sumX[i32(first)];
        const x2 = sumX[32] - sumX[i32(second)];
        const w0 = sumW[i32(first)] - sumW[0];
        const w1 = sumW[i32(second)] - sumW[i32(first)];
        const w2 = sumW[32] - sumW[i32(second)];
        const sumQx = x0 * point0 + x1 * point1 + x2 * point2;
        const sumQ2 = w0 * point0 * point0 + w1 * point1 * point1 + w2 * point2 * point2;
        if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
          bestScale = sumQx / sumQ2;
          bestScore = bestScale * sumQx;
          bestFirst = first;
          bestSecond = second;
          bestShift = shift;
        }
      }
    }
  }

  for (let position: u32 = 0; position < 32; position++) {
    const level = position < bestFirst ? 0 : position < bestSecond ? 1 : 2;
    levels[i32(order[i32(position)])] = u8(level);
  }
  if (bestScale < 0.0) {
    bestScale = -bestScale;
    bestShift = -bestShift;
    for (let lane: u32 = 0; lane < 32; lane++) levels[i32(lane)] = u8(2 - levels[i32(lane)]);
  }

  let sumQx: f32 = 0.0;
  let sumQ2: f32 = 0.0;
  let allOnGrid = true;
  for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
    let targetPattern: u32 = 0;
    const valueStart = subBlock * 8;
    for (let lane: u32 = 0; lane < 8; lane++) {
      targetPattern |= u32(levels[i32(valueStart + lane)]) << i32(lane * 2);
    }
    const exactIndex = findExactIQ1Pattern(targetPattern);
    if (exactIndex < 0) allOnGrid = false;
    const gridIndex = exactIndex >= 0
      ? u32(exactIndex)
      : findIQ1LatticePattern(targetPattern, src, srcStart + valueStart,
        weights, valueStart, bestScale, bestShift);
    indices[i32(subBlock)] = u16(gridIndex);
    for (let lane: u32 = 0; lane < 8; lane++) {
      const category = iqPatternDigit(IQ1_PATTERNS, gridIndex, lane, 2);
      if (exactIndex < 0) levels[i32(valueStart + lane)] = u8(category);
      const quant = iq1Point(bestShift, category);
      const value = readF32(src, srcStart + valueStart + lane);
      const weight = weights[i32(valueStart + lane)];
      sumQx += weight * value * quant;
      sumQ2 += weight * quant * quant;
    }
  }
  shiftResult[i32(shiftIndex)] = bestShift;
  return !allOnGrid && sumQx > 0.0 && sumQ2 > 0.0 ? sumQx / sumQ2 : bestScale;
}

function quantizeIq1MGroup(
  src: FloatPtr,
  srcStart: u32,
  weights: StaticArray<f32>,
  order: StaticArray<u32>,
  levels: StaticArray<u8>,
  indices: StaticArray<u16>,
  choiceResult: StaticArray<i32>,
): f32 {
  let sumSquares: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    sumSquares += value * value;
  }
  if (sumSquares < 1.0e-14) {
    choiceResult[0] = 0;
    indices[0] = 1029;
    indices[1] = 1029;
    return 0.0;
  }

  for (let lane: u32 = 0; lane < 16; lane++) order[i32(lane)] = lane;
  for (let position: i32 = 1; position < 16; position++) {
    const selected = order[position];
    const selectedValue = readF32(src, srcStart + selected);
    let cursor = position - 1;
    while (cursor >= 0 && readF32(src, srcStart + order[cursor]) > selectedValue) {
      order[cursor + 1] = order[cursor];
      cursor--;
    }
    order[cursor + 1] = selected;
  }

  let bestScore: f32 = 0.0;
  let bestScale: f32 = 0.0;
  let bestFirst: u32 = 0;
  let bestSecond: u32 = 0;
  let bestChoice: i32 = 0;
  for (let first: u32 = 0; first <= 16; first++) {
    for (let second: u32 = first; second <= 16; second++) {
      for (let choice: i32 = 0; choice < 4; choice++) {
        let sumQx: f32 = 0.0;
        let sumQ2: f32 = 0.0;
        for (let position: u32 = 0; position < 16; position++) {
          const lane = order[i32(position)];
          const level = position < first ? 0 : position < second ? 1 : 2;
          const shift = lane < 8
            ? (choice < 2 ? 1 : -1)
            : ((choice & 1) == 0 ? 1 : -1);
          const quant = iq1Point(shift, u32(level));
          const value = readF32(src, srcStart + lane);
          const weight = weights[i32(lane)];
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
        if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
          bestScale = sumQx / sumQ2;
          bestScore = bestScale * sumQx;
          bestFirst = first;
          bestSecond = second;
          bestChoice = choice;
        }
      }
    }
  }

  for (let position: u32 = 0; position < 16; position++) {
    const level = position < bestFirst ? 0 : position < bestSecond ? 1 : 2;
    levels[i32(order[i32(position)])] = u8(level);
  }
  if (bestScale < 0.0) {
    bestScale = -bestScale;
    bestChoice = 3 - bestChoice;
    for (let lane: u32 = 0; lane < 16; lane++) levels[i32(lane)] = u8(2 - levels[i32(lane)]);
  }

  let allOnGrid = true;
  for (let subBlock: u32 = 0; subBlock < 2; subBlock++) {
    const shift = subBlock == 0
      ? (bestChoice < 2 ? 1 : -1)
      : ((bestChoice & 1) == 0 ? 1 : -1);
    const valueStart = subBlock * 8;
    let targetPattern: u32 = 0;
    for (let lane: u32 = 0; lane < 8; lane++) {
      targetPattern |= u32(levels[i32(valueStart + lane)]) << i32(lane * 2);
    }
    const exactIndex = findExactIQ1Pattern(targetPattern);
    if (exactIndex < 0) allOnGrid = false;
    const gridIndex = exactIndex >= 0
      ? u32(exactIndex)
      : findIQ1LatticePattern(targetPattern, src, srcStart + valueStart,
        weights, valueStart, bestScale, shift);
    indices[i32(subBlock)] = u16(gridIndex);
    for (let lane: u32 = 0; lane < 8; lane++) {
      const category = iqPatternDigit(IQ1_PATTERNS, gridIndex, lane, 2);
      if (exactIndex < 0) levels[i32(valueStart + lane)] = u8(category);
    }
  }

  if (!allOnGrid) {
    let bestScore: f32 = 0.0;
    let sumQx0: f32 = 0.0;
    let sumQx1: f32 = 0.0;
    let sumQx2: f32 = 0.0;
    let sumQx3: f32 = 0.0;
    let sumQ20: f32 = 0.0;
    let sumQ21: f32 = 0.0;
    let sumQ22: f32 = 0.0;
    let sumQ23: f32 = 0.0;
    for (let lane: u32 = 0; lane < 16; lane++) {
      const value = readF32(src, srcStart + lane);
      const weight = weights[i32(lane)];
      const qPlus = iq1Point(1, levels[i32(lane)]);
      const qMinus = iq1Point(-1, levels[i32(lane)]);
      sumQx0 += weight * value * qPlus;
      sumQ20 += weight * qPlus * qPlus;
      sumQx3 += weight * value * qMinus;
      sumQ23 += weight * qMinus * qMinus;
      if (lane < 8) {
        sumQx1 += weight * value * qPlus;
        sumQ21 += weight * qPlus * qPlus;
        sumQx2 += weight * value * qMinus;
        sumQ22 += weight * qMinus * qMinus;
      } else {
        sumQx1 += weight * value * qMinus;
        sumQ21 += weight * qMinus * qMinus;
        sumQx2 += weight * value * qPlus;
        sumQ22 += weight * qPlus * qPlus;
      }
    }
    for (let candidate: i32 = 0; candidate < 4; candidate++) {
      const sumQx = candidate == 0 ? sumQx0 : candidate == 1 ? sumQx1 : candidate == 2 ? sumQx2 : sumQx3;
      const sumQ2 = candidate == 0 ? sumQ20 : candidate == 1 ? sumQ21 : candidate == 2 ? sumQ22 : sumQ23;
      if (sumQx > 0.0 && sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        bestScale = sumQx / sumQ2;
        bestScore = bestScale * sumQx;
        bestChoice = candidate;
      }
    }
  }
  choiceResult[0] = bestChoice;
  return bestScale;
}

export function quantize_iq1_s(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const weights = new StaticArray<f32>(32);
  const order = new StaticArray<u32>(32);
  const sumX = new StaticArray<f32>(33);
  const sumW = new StaticArray<f32>(33);
  const levels = new StaticArray<u8>(32);
  const indices = new StaticArray<u16>(32);
  const shifts = new StaticArray<i32>(8);
  const scales = new StaticArray<f32>(8);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, srcStart + element);
      sumSquares += value * value;
    }
    const sigma2: f32 = 2.0 * sumSquares / 256.0;
    let maxScale: f32 = 0.0;
    for (let group: u32 = 0; group < 8; group++) {
      const groupStart = srcStart + group * 32;
      for (let lane: u32 = 0; lane < 32; lane++) {
        const value = readF32(src, groupStart + lane);
        weights[i32(lane)] = sqrtF32(sigma2 + value * value);
      }
      const scale = quantizeIq1SGroup(src, groupStart, weights, order, sumX, sumW, levels,
        indices, shifts, group);
      scales[i32(group)] = scale;
      if (scale > maxScale) maxScale = scale;
      let gridHighBits: u32 = 0;
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const gridIndex = u32(indices[i32(subBlock)]);
        store<u8>(dst + usize(block * 50 + 2 + group * 4 + subBlock), u8(gridIndex));
        gridHighBits |= ((gridIndex >> 8) & 7) << i32(subBlock * 3);
      }
      store<u16>(dst + usize(block * 50 + 34 + group * 2), u16(gridHighBits));
    }

    const d = maxScale / 15.0;
    const inverseScale: f32 = maxScale > 0.0 ? 1.0 / d : 0.0;
    store<u16>(dst + usize(block * 50), f32ToFp16(d));
    for (let group: u32 = 0; group < 8; group++) {
      const scaleCode = maxScale > 0.0
        ? clampQuant(roundNearestEven(0.5 * (inverseScale * scales[i32(group)] - 1.0)), 0, 7)
        : 0;
      let qh = u32(load<u16>(dst + usize(block * 50 + 34 + group * 2))) | (u32(scaleCode) << 12);
      if (shifts[i32(group)] < 0) qh |= 0x8000;
      store<u16>(dst + usize(block * 50 + 34 + group * 2), u16(qh));
    }
  }
}

export function quantize_iq1_m(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const weights = new StaticArray<f32>(16);
  const order = new StaticArray<u32>(16);
  const levels = new StaticArray<u8>(16);
  const indices = new StaticArray<u16>(2);
  const choiceResult = new StaticArray<i32>(1);
  const groupScales = new StaticArray<f32>(16);
  const choices = new StaticArray<i32>(16);
  const allSigma2 = new StaticArray<f32>(8);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    let maxScale: f32 = 0.0;
    for (let group32: u32 = 0; group32 < 8; group32++) {
      let sumSquares: f32 = 0.0;
      for (let lane: u32 = 0; lane < 32; lane++) {
        const value = readF32(src, srcStart + group32 * 32 + lane);
        sumSquares += value * value;
      }
      allSigma2[i32(group32)] = 1.5 * sumSquares / 32.0;
    }

    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      const sigma2 = allSigma2[i32(group / 2)];
      let sumSquares: f32 = 0.0;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        sumSquares += value * value;
        weights[i32(lane)] = sqrtF32(sigma2 + value * value);
      }
      let scale: f32;
      if (sumSquares < 1.0e-14) {
        scale = 0.0;
        choiceResult[0] = 0;
        indices[0] = 1029;
        indices[1] = 1029;
      } else {
        scale = quantizeIq1MGroup(src, groupStart, weights, order, levels, indices, choiceResult);
      }
      groupScales[i32(group)] = scale;
      choices[i32(group)] = choiceResult[0];
      if (scale > maxScale) maxScale = scale;
      store<u8>(dst + usize(block * 56 + group * 2), u8(indices[0]));
      store<u8>(dst + usize(block * 56 + group * 2 + 1), u8(indices[1]));
      let qh = ((u32(indices[0]) >> 8) & 7) | (((u32(indices[1]) >> 8) & 7) << 4);
      if (choiceResult[0] >= 2) qh |= 0x08;
      if ((choiceResult[0] & 1) != 0) qh |= 0x80;
      store<u8>(dst + usize(block * 56 + 32 + group), u8(qh));
    }

    const baseScale = maxScale / 15.0;
    const inverseBaseScale: f32 = maxScale > 0.0 ? 1.0 / baseScale : 0.0;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    const blockDst = dst + usize(block * 56);
    for (let byte: u32 = 0; byte < 8; byte++) store<u8>(blockDst + usize(48 + byte), 0);

    for (let group: u32 = 0; group < 16; group++) {
      const scaleCode = maxScale > 0.0
        ? clampQuant(roundNearestEven(0.5 * (inverseBaseScale * groupScales[i32(group)] - 1.0)), 0, 7)
        : 0;
      const scaleWordOffset = 48 + (group / 4) * 2;
      const oldWord = u32(load<u16>(blockDst + usize(scaleWordOffset)));
      store<u16>(blockDst + usize(scaleWordOffset), u16(oldWord | (u32(scaleCode) << i32((group % 4) * 3))));

      const sigma2 = allSigma2[i32(group / 2)];
      const groupStart = srcStart + group * 16;
      const choice = choices[i32(group)];
      for (let subBlock: u32 = 0; subBlock < 2; subBlock++) {
        const shift = subBlock == 0
          ? (choice < 2 ? 1 : -1)
          : ((choice & 1) == 0 ? 1 : -1);
        const gridLow = u32(load<u8>(blockDst + usize(group * 2 + subBlock)));
        const qh = u32(load<u8>(blockDst + usize(32 + group)));
        const gridIndex = gridLow | (((qh >> i32(subBlock * 4)) & 7) << 8);
        const localScale = f32((scaleCode << 1) + 1);
        for (let lane: u32 = 0; lane < 8; lane++) {
          const category = iqPatternDigit(IQ1_PATTERNS, gridIndex, lane, 2);
          const quant = iq1Point(shift, category) * localScale;
          const value = readF32(src, groupStart + subBlock * 8 + lane);
          const weight = sqrtF32(sigma2 + value * value);
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
      }
    }

    const d = sumQ2 > 0.0 ? sumQx / sumQ2 : baseScale;
    const scaleBits = u32(f32ToFp16(d));
    const scaleWord0 = u32(load<u16>(blockDst + 48)) | ((scaleBits & 0x000f) << 12);
    const scaleWord1 = u32(load<u16>(blockDst + 50)) | ((scaleBits & 0x00f0) << 8);
    const scaleWord2 = u32(load<u16>(blockDst + 52)) | ((scaleBits & 0x0f00) << 4);
    const scaleWord3 = u32(load<u16>(blockDst + 54)) | (scaleBits & 0xf000);
    store<u16>(blockDst + 48, u16(scaleWord0));
    store<u16>(blockDst + 50, u16(scaleWord1));
    store<u16>(blockDst + 52, u16(scaleWord2));
    store<u16>(blockDst + 54, u16(scaleWord3));
  }
}

function quantizeIq3SuperBlock(
  src: FloatPtr,
  dst: BytePtr,
  srcStart: u32,
  isXxs: bool,
  patterns: StaticArray<u16>,
  gridSize: u32,
  neighbourRings: u32,
  blockByteSize: u32,
  values: StaticArray<f32>,
  weights: StaticArray<f32>,
  searchWeights: StaticArray<f32>,
  signCodes: StaticArray<u8>,
  gridIndices: StaticArray<u16>,
  candidateIndices: StaticArray<u16>,
  onGrid: StaticArray<u8>,
  onGridAux: StaticArray<u8>,
  groupScales: StaticArray<f32>,
): void {
  let sumSquares: f32 = 0.0;
  for (let element: u32 = 0; element < 256; element++) {
    const value = readF32(src, srcStart + element);
    sumSquares += value * value;
  }
  const sigma2 = 2.0 * sumSquares / 256.0;
  let maxScale: f32 = 0.0;

  for (let group: u32 = 0; group < 8; group++) {
    const groupStart = srcStart + group * 32;
    const signStart = group * 4;
    for (let signGroup: u32 = 0; signGroup < 4; signGroup++) signCodes[i32(signStart + signGroup)] = 0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, groupStart + lane);
      const square = value * value;
      weights[i32(lane)] = square;
      searchWeights[i32(lane)] = sqrtF32(square);
      if (value < 0.0) {
        values[i32(lane)] = -value;
        const signGroup = lane / 8;
        signCodes[i32(signStart + signGroup)] = u8(
          u32(signCodes[i32(signStart + signGroup)]) | (u32(1) << i32(lane % 8)),
        );
      } else {
        values[i32(lane)] = value;
      }
    }

    if (isXxs) {
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const valueStart = subBlock * 8;
        let negativeCount: u32 = 0;
        for (let lane: u32 = 0; lane < 8; lane++) {
          if (readF32(src, groupStart + valueStart + lane) < 0.0) negativeCount++;
        }
        if ((negativeCount & 1) != 0) {
          let minimumScore = weights[i32(valueStart)] * values[i32(valueStart)] * values[i32(valueStart)];
          let minimumLane = valueStart;
          for (let lane: u32 = 1; lane < 8; lane++) {
            const candidateLane = valueStart + lane;
            const score = weights[i32(candidateLane)] * values[i32(candidateLane)] * values[i32(candidateLane)];
            if (score < minimumScore) {
              minimumScore = score;
              minimumLane = candidateLane;
            }
          }
          values[i32(minimumLane)] = -values[i32(minimumLane)];
          signCodes[i32(signStart + subBlock)] = u8(
            u32(signCodes[i32(signStart + subBlock)]) ^ (u32(1) << i32(minimumLane - valueStart)),
          );
        }
        signCodes[i32(signStart + subBlock)] = u8(u32(signCodes[i32(signStart + subBlock)]) & 0x7f);
      }
    }

    let maximum: f32 = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      if (values[i32(lane)] > maximum) maximum = values[i32(lane)];
    }
        const isZero = isXxs ? maximum < 1.0e-8 : maximum == 0.0;
        if (isZero) {
      groupScales[i32(group)] = 0.0;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        gridIndices[i32(group * 8 + subBlock)] = 0;
      }
      continue;
    }

    let scale = maximum / 15.0;
    let bestScore: f32 = 0.0;
    const scaleSearchCount: i32 = isXxs ? 15 : 9;
    const scaleDelta: f32 = isXxs ? 0.2 : 0.2;
    for (let step: i32 = -scaleSearchCount; step <= scaleSearchCount; step++) {
      const inverseScale: f32 = (15.0 + f32(step) * scaleDelta) / maximum;
      const candidateScale: f32 = 1.0 / inverseScale;
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const valueStart = subBlock * 4;
        let targetPattern: u32 = 0;
        for (let lane: u32 = 0; lane < 4; lane++) {
          const value = values[i32(valueStart + lane)];
          const quant = clampQuant(roundNearestEven(0.5 * (inverseScale * value - 1.0)), 0, 7);
          targetPattern |= u32(quant) << i32(lane * 3);
        }
        const gridIndex = findIQLatticePattern(patterns, gridSize, 4, 3, neighbourRings,
          targetPattern, values, valueStart, searchWeights, valueStart, candidateScale);
        candidateIndices[i32(group * 8 + subBlock)] = u16(gridIndex);
        onGridAux[i32(subBlock)] = iqPatternDistance(patterns, gridIndex, targetPattern, 4, 3) == 0 ? 1 : 0;
        for (let lane: u32 = 0; lane < 4; lane++) {
          const quant = f32((iqPatternDigit(patterns, gridIndex, lane, 3) << 1) + 1);
          const value = values[i32(valueStart + lane)];
          const weight = weights[i32(valueStart + lane)];
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
      }
      if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        scale = sumQx / sumQ2;
        bestScore = scale * sumQx;
        for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
          gridIndices[i32(group * 8 + subBlock)] = candidateIndices[i32(group * 8 + subBlock)];
          onGrid[i32(subBlock)] = onGridAux[i32(subBlock)];
        }
      }
    }

    if (bestScore == 0.0 || scale == 0.0) {
      groupScales[i32(group)] = 0.0;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        gridIndices[i32(group * 8 + subBlock)] = 0;
      }
      continue;
    }

    let notOnGridCount: u32 = 0;
    for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
      if (onGrid[i32(subBlock)] == 0) notOnGridCount++;
    }
    if (scale > 0.0 && notOnGridCount > 0) {
      const inverseScale: f32 = 1.0 / scale;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        if (isXxs && onGrid[i32(subBlock)] != 0) continue;
        const valueStart = subBlock * 4;
        let targetPattern: u32 = 0;
        for (let lane: u32 = 0; lane < 4; lane++) {
          const value = values[i32(valueStart + lane)];
          const quant = clampQuant(roundNearestEven(0.5 * (inverseScale * value - 1.0)), 0, 7);
          targetPattern |= u32(quant) << i32(lane * 3);
        }
        const gridIndex = findIQLatticePattern(patterns, gridSize, 4, 3, neighbourRings,
          targetPattern, values, valueStart, searchWeights, valueStart, scale);
        gridIndices[i32(group * 8 + subBlock)] = u16(gridIndex);
      }
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const valueStart = subBlock * 4;
        const gridIndex = u32(gridIndices[i32(group * 8 + subBlock)]);
        for (let lane: u32 = 0; lane < 4; lane++) {
          const quant = f32((iqPatternDigit(patterns, gridIndex, lane, 3) << 1) + 1);
          const value = values[i32(valueStart + lane)];
          const weight = weights[i32(valueStart + lane)];
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
      }
      if (sumQ2 > 0.0) scale = sumQx / sumQ2;
    }

    if (scale < 0.0) {
      scale = -scale;
      for (let signGroup: u32 = 0; signGroup < 4; signGroup++) {
        const signIndex = i32(signStart + signGroup);
        signCodes[signIndex] = u8(u32(signCodes[signIndex]) ^ u32(isXxs ? 127 : 255));
      }
    }
    groupScales[i32(group)] = scale;
    if (scale > maxScale) maxScale = scale;
  }

  for (let byte: u32 = 0; byte < blockByteSize; byte++) store<u8>(dst + usize(byte), 0);
  const baseScale: f32 = maxScale / 31.0;
  store<u16>(dst, f32ToFp16(baseScale));
  const inverseBaseScale: f32 = baseScale > 0.0 ? 1.0 / baseScale : 0.0;
  for (let group: u32 = 0; group < 8; group++) {
    const scaleCode = maxScale > 0.0
      ? clampQuant(roundNearestEven(0.5 * (inverseBaseScale * groupScales[i32(group)] - 1.0)), 0, 15)
      : 0;
    for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
      const gridIndex = u32(gridIndices[i32(group * 8 + subBlock)]);
      store<u8>(dst + usize(2 + group * 8 + subBlock), u8(gridIndex & 0xff));
      if (!isXxs) {
        const highOffset = 66 + group;
        const high = u32(load<u8>(dst + usize(highOffset))) | ((gridIndex >> 8) << i32(subBlock));
        store<u8>(dst + usize(highOffset), u8(high));
        store<u8>(dst + usize(74 + group * 4 + subBlock / 2), 0);
      }
    }
    if (isXxs) {
      let scaleAndSigns = u32(scaleCode) << 28;
      for (let signGroup: u32 = 0; signGroup < 4; signGroup++) {
        scaleAndSigns |= u32(signCodes[i32(group * 4 + signGroup)]) << i32(signGroup * 7);
      }
      store<u32>(dst + usize(66 + group * 4), scaleAndSigns);
    } else {
      const scaleOffset = 106 + group / 2;
      const currentScale = u32(load<u8>(dst + usize(scaleOffset)));
      const packedScale = group % 2 == 0
        ? (currentScale & 0xf0) | u32(scaleCode)
        : (currentScale & 0x0f) | (u32(scaleCode) << 4);
      store<u8>(dst + usize(scaleOffset), u8(packedScale));
    }
  }
  if (!isXxs) {
    for (let group: u32 = 0; group < 8; group++) {
      for (let signGroup: u32 = 0; signGroup < 4; signGroup++) {
        store<u8>(dst + usize(74 + group * 4 + signGroup), signCodes[i32(group * 4 + signGroup)]);
      }
    }
  }
}

export function quantize_iq3_xxs(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const values = new StaticArray<f32>(32);
  const weights = new StaticArray<f32>(32);
  const searchWeights = new StaticArray<f32>(32);
  const signCodes = new StaticArray<u8>(32);
  const gridIndices = new StaticArray<u16>(64);
  const candidateIndices = new StaticArray<u16>(64);
  const onGrid = new StaticArray<u8>(8);
  const onGridAux = new StaticArray<u8>(8);
  const groupScales = new StaticArray<f32>(8);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq3SuperBlock(src, dst + usize(block * 98), block * 256, true,
      IQ3_XXS_PATTERNS, 256, 2, 98, values, weights, searchWeights, signCodes,
      gridIndices, candidateIndices, onGrid, onGridAux, groupScales);
  }
}

export function quantize_iq3_s(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const values = new StaticArray<f32>(32);
  const weights = new StaticArray<f32>(32);
  const searchWeights = new StaticArray<f32>(32);
  const signCodes = new StaticArray<u8>(32);
  const gridIndices = new StaticArray<u16>(64);
  const candidateIndices = new StaticArray<u16>(64);
  const onGrid = new StaticArray<u8>(8);
  const onGridAux = new StaticArray<u8>(8);
  const groupScales = new StaticArray<f32>(8);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq3SuperBlock(src, dst + usize(block * 110), block * 256, false,
      IQ3_S_PATTERNS, 512, 3, 110, values, weights, searchWeights, signCodes,
      gridIndices, candidateIndices, onGrid, onGridAux, groupScales);
  }
}

function quantizeIq2SuperBlock(
  src: FloatPtr,
  dst: BytePtr,
  srcStart: u32,
  mode: u32,
  patterns: StaticArray<u16>,
  gridSize: u32,
  neighbourRings: u32,
  blockByteSize: u32,
  values: StaticArray<f32>,
  weights: StaticArray<f32>,
  searchWeights: StaticArray<f32>,
  qpLevels: StaticArray<u8>,
  signCodes: StaticArray<u8>,
  gridIndices: StaticArray<u16>,
  candidateIndices: StaticArray<u16>,
  onGrid: StaticArray<u8>,
  onGridAux: StaticArray<u8>,
  groupScales: StaticArray<f32>,
): void {
  const groupElements: u32 = mode == 0 ? 32 : 16;
  const groupCount: u32 = u32(256) / groupElements;
  const subBlockCount: u32 = groupElements / u32(8);
  const scaleSearchCount: i32 = mode == 0 ? 6 : 9;
  const scaleDelta: f32 = 0.1;
  let sumSquares: f32 = 0.0;
  for (let element: u32 = 0; element < 256; element++) {
    const value = readF32(src, srcStart + element);
    sumSquares += value * value;
  }
  const sigma2: f32 = mode == 2 ? 2.0 * sumSquares / 256.0 : sumSquares / 256.0;
  let maxScale: f32 = 0.0;

  for (let group: u32 = 0; group < groupCount; group++) {
    const groupStart = srcStart + group * groupElements;
    const signStart = group * subBlockCount;
    for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
      signCodes[i32(signStart + subBlock)] = 0;
    }
    for (let lane: u32 = 0; lane < groupElements; lane++) {
      const value = readF32(src, groupStart + lane);
      const square = value * value;
      weights[i32(lane)] = mode == 2 ? 0.25 * sigma2 + square : sqrtF32(sigma2 + square);
      searchWeights[i32(lane)] = sqrtF32(weights[i32(lane)]);
      if (value < 0.0) {
        values[i32(lane)] = -value;
        const subBlock = lane / 8;
        signCodes[i32(signStart + subBlock)] = u8(
          u32(signCodes[i32(signStart + subBlock)]) | (u32(1) << i32(lane % 8)),
        );
      } else {
        values[i32(lane)] = value;
      }
    }

    if (mode != 2) {
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const valueStart = subBlock * 8;
        let negativeCount: u32 = 0;
        for (let lane: u32 = 0; lane < 8; lane++) {
          if (readF32(src, groupStart + valueStart + lane) < 0.0) negativeCount++;
        }
        if ((negativeCount & 1) != 0) {
          let minimumScore = weights[i32(valueStart)] * values[i32(valueStart)] * values[i32(valueStart)];
          let minimumLane = valueStart;
          for (let lane: u32 = 1; lane < 8; lane++) {
            const candidateLane = valueStart + lane;
            const score = weights[i32(candidateLane)] * values[i32(candidateLane)] * values[i32(candidateLane)];
            if (score < minimumScore) {
              minimumScore = score;
              minimumLane = candidateLane;
            }
          }
          values[i32(minimumLane)] = -values[i32(minimumLane)];
          signCodes[i32(signStart + subBlock)] = u8(
            u32(signCodes[i32(signStart + subBlock)]) ^ (u32(1) << i32(minimumLane - valueStart)),
          );
        }
        signCodes[i32(signStart + subBlock)] = u8(u32(signCodes[i32(signStart + subBlock)]) & 0x7f);
      }
    }

    let maximum: f32 = 0.0;
    for (let lane: u32 = 0; lane < groupElements; lane++) {
      if (values[i32(lane)] > maximum) maximum = values[i32(lane)];
    }
    const isZero = mode == 2 ? maximum < 1.0e-8 : maximum < 1.0e-15;
    if (isZero) {
      groupScales[i32(group)] = 0.0;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        gridIndices[i32(group * subBlockCount + subBlock)] = 0;
      }
      continue;
    }

    let scale = mode == 0
      ? makeQpQuants(values, weights, groupElements, 4, qpLevels)
      : maximum / 5.0;
    const effectiveMaximum: f32 = mode == 0 ? scale * 3.0 : maximum;
    if (effectiveMaximum <= 0.0) {
      groupScales[i32(group)] = 0.0;
      continue;
    }

    let bestScore: f32 = 0.0;
    for (let step = -scaleSearchCount; step <= scaleSearchCount; step++) {
      const inverseScale: f32 = (5.0 + f32(step) * scaleDelta) / effectiveMaximum;
      const candidateScale: f32 = 1.0 / inverseScale;
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;

      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const valueStart = subBlock * 8;
        let targetPattern: u32 = 0;
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = values[i32(valueStart + lane)];
          const quant = clampQuant(roundNearestEven(0.5 * (inverseScale * value - 1.0)), 0, 2);
          targetPattern |= u32(quant) << i32(lane * 2);
        }
        const gridIndex = findIQLatticePattern(patterns, gridSize, 8, 2, neighbourRings,
          targetPattern, values, valueStart, searchWeights, valueStart, candidateScale);
        candidateIndices[i32(subBlock)] = u16(gridIndex);
        onGridAux[i32(subBlock)] = iqPatternDistance(patterns, gridIndex, targetPattern, 8, 2) == 0 ? 1 : 0;
        for (let lane: u32 = 0; lane < 8; lane++) {
          const quant = f32((iqPatternDigit(patterns, gridIndex, lane, 2) << 1) + 1);
          const value = values[i32(valueStart + lane)];
          const weight = weights[i32(valueStart + lane)];
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
      }

      if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        scale = sumQx / sumQ2;
        bestScore = scale * sumQx;
        for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
          gridIndices[i32(group * subBlockCount + subBlock)] = candidateIndices[i32(subBlock)];
          onGrid[i32(subBlock)] = onGridAux[i32(subBlock)];
        }
      }
    }

    if (bestScore == 0.0 || scale == 0.0) {
      groupScales[i32(group)] = 0.0;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        gridIndices[i32(group * subBlockCount + subBlock)] = 0;
      }
      continue;
    }

    let notOnGridCount: u32 = 0;
    for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
      if (onGrid[i32(subBlock)] == 0) notOnGridCount++;
    }
    if (scale > 0.0 && (mode == 0 || notOnGridCount > 0)) {
      const inverseScale: f32 = 1.0 / scale;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        if (mode != 0 && onGrid[i32(subBlock)] != 0) continue;
        const valueStart = subBlock * 8;
        let targetPattern: u32 = 0;
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = values[i32(valueStart + lane)];
          const quant = clampQuant(roundNearestEven(0.5 * (inverseScale * value - 1.0)), 0, 2);
          targetPattern |= u32(quant) << i32(lane * 2);
        }
        const gridIndex = findIQLatticePattern(patterns, gridSize, 8, 2, neighbourRings,
          targetPattern, values, valueStart, searchWeights, valueStart, scale);
        gridIndices[i32(group * subBlockCount + subBlock)] = u16(gridIndex);
      }
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const valueStart = subBlock * 8;
        const gridIndex = u32(gridIndices[i32(group * subBlockCount + subBlock)]);
        for (let lane: u32 = 0; lane < 8; lane++) {
          const quant = f32((iqPatternDigit(patterns, gridIndex, lane, 2) << 1) + 1);
          const value = values[i32(valueStart + lane)];
          const weight = weights[i32(valueStart + lane)];
          sumQx += weight * value * quant;
          sumQ2 += weight * quant * quant;
        }
      }
      if (sumQ2 > 0.0) scale = sumQx / sumQ2;
    }

    if (scale < 0.0) {
      scale = -scale;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const signIndex = i32(signStart + subBlock);
        signCodes[signIndex] = u8(u32(signCodes[signIndex]) ^ u32(mode == 2 ? 255 : 127));
      }
    }
    groupScales[i32(group)] = scale;
    if (scale > maxScale) maxScale = scale;
  }

  for (let byte: u32 = 0; byte < blockByteSize; byte++) store<u8>(dst + usize(byte), 0);
  const baseScale: f32 = maxScale / 31.0;
  const correction: f32 = 0.947;
  store<u16>(dst, f32ToFp16(baseScale * correction));
  const inverseBaseScale: f32 = baseScale > 0.0 ? 1.0 / baseScale : 0.0;

  for (let group: u32 = 0; group < groupCount; group++) {
    const scaleCode = maxScale > 0.0
      ? clampQuant(roundNearestEven(0.5 * (inverseBaseScale * groupScales[i32(group)] - 1.0)), 0, 15)
      : 0;
    if (mode == 0) {
      let packedSigns = u32(scaleCode) << 28;
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const subIndex = group * subBlockCount + subBlock;
        const gridIndex = u32(gridIndices[i32(subIndex)]);
        const signIndex = u32(signCodes[i32(subIndex)]);
        store<u8>(dst + usize(2 + group * 8 + subBlock), u8(gridIndex));
        packedSigns |= signIndex << i32(subBlock * 7);
      }
      store<u32>(dst + usize(6 + group * 8), packedSigns);
    } else if (mode == 1) {
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const subIndex = group * subBlockCount + subBlock;
        const gridIndex = u32(gridIndices[i32(subIndex)]);
        const signIndex = u32(signCodes[i32(subIndex)]);
        store<u16>(dst + usize(2 + group * 4 + subBlock * 2), u16(gridIndex | (signIndex << 9)));
      }
      const scaleOffset = 66 + group / 2;
      const currentScale = u32(load<u8>(dst + usize(scaleOffset)));
      const packedScale = group % 2 == 0
        ? (currentScale & 0xf0) | u32(scaleCode)
        : (currentScale & 0x0f) | (u32(scaleCode) << 4);
      store<u8>(dst + usize(scaleOffset), u8(packedScale));
    } else {
      for (let subBlock: u32 = 0; subBlock < subBlockCount; subBlock++) {
        const subIndex = group * subBlockCount + subBlock;
        const gridIndex = u32(gridIndices[i32(subIndex)]);
        store<u8>(dst + usize(2 + subIndex), u8(gridIndex));
        const highOffset = 66 + subIndex / 4;
        const highShift = i32((subIndex % 4) * 2);
        const high = u32(load<u8>(dst + usize(highOffset))) | ((gridIndex >> 8) << highShift);
        store<u8>(dst + usize(highOffset), u8(high));
        store<u8>(dst + usize(34 + subIndex), signCodes[i32(subIndex)]);
      }
      const scaleOffset = 74 + group / 2;
      const currentScale = u32(load<u8>(dst + usize(scaleOffset)));
      const packedScale = group % 2 == 0
        ? (currentScale & 0xf0) | u32(scaleCode)
        : (currentScale & 0x0f) | (u32(scaleCode) << 4);
      store<u8>(dst + usize(scaleOffset), u8(packedScale));
    }
  }
}

export function quantize_iq2_xxs(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const values = new StaticArray<f32>(32);
  const weights = new StaticArray<f32>(32);
  const searchWeights = new StaticArray<f32>(32);
  const qpLevels = new StaticArray<u8>(32);
  const signCodes = new StaticArray<u8>(32);
  const gridIndices = new StaticArray<u16>(32);
  const candidateIndices = new StaticArray<u16>(32);
  const onGrid = new StaticArray<u8>(4);
  const onGridAux = new StaticArray<u8>(4);
  const groupScales = new StaticArray<f32>(16);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq2SuperBlock(src, dst + usize(block * 66), block * 256, 0,
      IQ2_XXS_PATTERNS, 256, 2, 66, values, weights, searchWeights, qpLevels, signCodes,
      gridIndices, candidateIndices, onGrid, onGridAux, groupScales);
  }
}

export function quantize_iq2_xs(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const values = new StaticArray<f32>(32);
  const weights = new StaticArray<f32>(32);
  const searchWeights = new StaticArray<f32>(32);
  const qpLevels = new StaticArray<u8>(32);
  const signCodes = new StaticArray<u8>(32);
  const gridIndices = new StaticArray<u16>(32);
  const candidateIndices = new StaticArray<u16>(32);
  const onGrid = new StaticArray<u8>(4);
  const onGridAux = new StaticArray<u8>(4);
  const groupScales = new StaticArray<f32>(16);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq2SuperBlock(src, dst + usize(block * 74), block * 256, 1,
      IQ2_XS_PATTERNS, 512, 2, 74, values, weights, searchWeights, qpLevels, signCodes,
      gridIndices, candidateIndices, onGrid, onGridAux, groupScales);
  }
}

export function quantize_iq2_s(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const values = new StaticArray<f32>(32);
  const weights = new StaticArray<f32>(32);
  const searchWeights = new StaticArray<f32>(32);
  const qpLevels = new StaticArray<u8>(32);
  const signCodes = new StaticArray<u8>(32);
  const gridIndices = new StaticArray<u16>(32);
  const candidateIndices = new StaticArray<u16>(32);
  const onGrid = new StaticArray<u8>(4);
  const onGridAux = new StaticArray<u8>(4);
  const groupScales = new StaticArray<f32>(16);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq2SuperBlock(src, dst + usize(block * 82), block * 256, 2,
      IQ2_S_PATTERNS, 1024, 1, 82, values, weights, searchWeights, qpLevels, signCodes,
      gridIndices, candidateIndices, onGrid, onGridAux, groupScales);
  }
}

export function dequantize_iq2_xxs(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 66);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let group: u32 = 0; group < 8; group++) {
      const groupSrc = blockSrc + usize(2 + group * 8);
      const scaleAndSigns = load<u32>(groupSrc + 4);
      const scale = d * (0.5 + f32(scaleAndSigns >>> 28)) * 0.25;
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const gridIndex = u32(load<u8>(groupSrc + usize(subBlock)));
        const signIndex = (scaleAndSigns >>> i32(subBlock * 7)) & 0x7f;
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = scale * iq2XxsGridValue(gridIndex, lane) * iqSignFactor(signIndex, lane);
          writeF32(dst, block * 256 + group * 32 + subBlock * 8 + lane, value);
        }
      }
    }
  }
}

export function dequantize_iq2_xs(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 74);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let group: u32 = 0; group < 8; group++) {
      const scaleByte = load<u8>(blockSrc + usize(66 + group));
      const scales: StaticArray<f32> = StaticArray.fromArray<f32>([
        d * (0.5 + f32(scaleByte & 15)) * 0.25,
        d * (0.5 + f32(scaleByte >> 4)) * 0.25,
      ]);
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const quant = load<u16>(blockSrc + usize(2 + group * 8 + subBlock * 2));
        const gridIndex = u32(quant) & 0x1ff;
        const signIndex = u32(quant) >> 9;
        const scale = unchecked(scales[i32(subBlock / 2)]);
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = scale * iq2XsGridValue(gridIndex, lane) * iqSignFactor(signIndex, lane);
          writeF32(dst, block * 256 + group * 32 + subBlock * 8 + lane, value);
        }
      }
    }
  }
}

export function dequantize_iq2_s(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 82);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let group: u32 = 0; group < 8; group++) {
      const scaleByte = load<u8>(blockSrc + usize(74 + group));
      const scale0 = d * (0.5 + f32(scaleByte & 15)) * 0.25;
      const scale1 = d * (0.5 + f32(scaleByte >> 4)) * 0.25;
      const highBits = u32(load<u8>(blockSrc + usize(66 + group)));
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const low = u32(load<u8>(blockSrc + usize(2 + group * 8 + subBlock)));
        const high = (highBits << i32(8 - subBlock * 2)) & 0x300;
        const gridIndex = low | high;
        const signIndex = u32(load<u8>(blockSrc + usize(34 + group * 4 + subBlock))) & 0x7f;
        const scale = subBlock < 2 ? scale0 : scale1;
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = scale * iq2SGridValue(gridIndex, lane) * iqSignFactor(signIndex, lane);
          writeF32(dst, block * 256 + group * 32 + subBlock * 8 + lane, value);
        }
      }
    }
  }
}

export function dequantize_iq3_xxs(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 98);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let group: u32 = 0; group < 8; group++) {
      const qs = blockSrc + usize(2 + group * 8);
      const scaleAndSigns = load<u32>(blockSrc + usize(66 + group * 4));
      const scale = d * (0.5 + f32(scaleAndSigns >>> 28)) * 0.5;
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const signIndex = (scaleAndSigns >>> i32(subBlock * 7)) & 0x7f;
        const grid0 = u32(load<u8>(qs + usize(subBlock * 2)));
        const grid1 = u32(load<u8>(qs + usize(subBlock * 2 + 1)));
        for (let lane: u32 = 0; lane < 4; lane++) {
          const first = scale * iq3XxsGridValue(grid0, lane) * iqSignFactor(signIndex, lane);
          const second = scale * iq3XxsGridValue(grid1, lane) * iqSignFactor(signIndex, lane + 4);
          const output = block * 256 + group * 32 + subBlock * 8;
          writeF32(dst, output + lane, first);
          writeF32(dst, output + lane + 4, second);
        }
      }
    }
  }
}

export function dequantize_iq3_s(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 110);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let groupPair: u32 = 0; groupPair < 4; groupPair++) {
      const scaleByte = load<u8>(blockSrc + usize(106 + groupPair));
      for (let half: u32 = 0; half < 2; half++) {
        const group = groupPair * 2 + half;
        const scaleCode = half == 0 ? u32(scaleByte & 15) : u32(scaleByte >> 4);
        const scale = d * (1.0 + 2.0 * f32(scaleCode));
        const qh = u32(load<u8>(blockSrc + usize(66 + group)));
        for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
          const shift0 = i32(8 - subBlock * 2);
          const shift1 = i32(7 - subBlock * 2);
          const grid0 = u32(load<u8>(blockSrc + usize(2 + group * 8 + subBlock * 2))) |
            ((qh << shift0) & 0x100);
          const grid1 = u32(load<u8>(blockSrc + usize(3 + group * 8 + subBlock * 2))) |
            ((qh << shift1) & 0x100);
          const signIndex = u32(load<u8>(blockSrc + usize(74 + group * 4 + subBlock))) & 0x7f;
          const output = block * 256 + group * 32 + subBlock * 8;
          for (let lane: u32 = 0; lane < 4; lane++) {
            writeF32(dst, output + lane, scale * iq3SGridValue(grid0, lane) * iqSignFactor(signIndex, lane));
            writeF32(dst, output + lane + 4, scale * iq3SGridValue(grid1, lane) * iqSignFactor(signIndex, lane + 4));
          }
        }
      }
    }
  }
}

export function dequantize_iq1_s(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 50);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let group: u32 = 0; group < 8; group++) {
      const qh = load<u16>(blockSrc + usize(34 + group * 2));
      const scaleCode = (u32(qh) >> 12) & 7;
      const scale = d * f32((scaleCode << 1) + 1);
      const delta: f32 = (qh & 0x8000) != 0 ? -0.125 : 0.125;
      for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
        const low = u32(load<u8>(blockSrc + usize(2 + group * 4 + subBlock)));
        const gridIndex = low | (((u32(qh) >> i32(subBlock * 3)) & 7) << 8);
        for (let lane: u32 = 0; lane < 8; lane++) {
          const value = scale * (iq1SGridValue(gridIndex, lane) + delta);
          writeF32(dst, block * 256 + group * 32 + subBlock * 8 + lane, value);
        }
      }
    }
  }
}

export function dequantize_iq1_m(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 56);
    const scale0 = u32(load<u16>(blockSrc + 48));
    const scale1 = u32(load<u16>(blockSrc + 50));
    const scale2 = u32(load<u16>(blockSrc + 52));
    const scale3 = u32(load<u16>(blockSrc + 54));
    const globalScaleBits = (scale0 >> 12) | ((scale1 >> 8) & 0x00f0) |
      ((scale2 >> 4) & 0x0f00) | (scale3 & 0xf000);
    const d = fp16ToF32(u16(globalScaleBits));

    for (let group: u32 = 0; group < 8; group++) {
      const scaleWord = group < 2 ? scale0 : group < 4 ? scale1 : group < 6 ? scale2 : scale3;
      const pairShift = i32((group % 2) * 6);
      const scale0Code = (scaleWord >> pairShift) & 7;
      const scale1Code = (scaleWord >> (pairShift + 3)) & 7;
      const dl0 = d * f32((scale0Code << 1) + 1);
      const dl1 = d * f32((scale1Code << 1) + 1);
      for (let half: u32 = 0; half < 2; half++) {
        const qh = u32(load<u8>(blockSrc + usize(32 + group * 2 + half)));
        const scale = half == 0 ? dl0 : dl1;
        for (let subBlock: u32 = 0; subBlock < 2; subBlock++) {
          const pair = half * 2 + subBlock;
          const low = u32(load<u8>(blockSrc + usize(group * 4 + pair)));
          const shift = i32(8 - subBlock * 4);
          const gridIndex = low | ((qh << shift) & 0x700);
          const delta: f32 = (qh & (u32(0x08) << i32(subBlock * 4))) != 0 ? -0.125 : 0.125;
          for (let lane: u32 = 0; lane < 8; lane++) {
            const value = scale * (iq1SGridValue(gridIndex, lane) + delta);
            writeF32(dst, block * 256 + group * 32 + pair * 8 + lane, value);
          }
        }
      }
    }
  }
}

const IQ4_NL_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -127, -104, -83, -65, -49, -35, -22, -10,
  1, 13, 25, 38, 53, 69, 89, 113,
]);

function iq4NlValue(index: u32): f32 {
  return f32(unchecked(IQ4_NL_VALUES[i32(index)]));
}

function bestIq4NlIndex(value: f32): u32 {
  if (value <= iq4NlValue(0)) return 0;
  if (value >= iq4NlValue(15)) return 15;

  let lower = 0;
  let upper = 15;
  while (upper - lower > 1) {
    const middle = (lower + upper) / 2;
    if (value < iq4NlValue(u32(middle))) upper = middle;
    else lower = middle;
  }
  return value - iq4NlValue(u32(upper - 1)) < iq4NlValue(u32(upper)) - value
    ? u32(upper - 1)
    : u32(upper);
}

function quantizeIq4NlSuperBlock(
  src: FloatPtr,
  dst: BytePtr,
  srcStart: u32,
  groupCount: u32,
  tryCount: i32,
  levels: StaticArray<u8>,
  weights: StaticArray<f32>,
  scales: StaticArray<f32>,
): void {
  let maxScale: f32 = 0.0;
  let maxAbsScale: f32 = 0.0;

  for (let group: u32 = 0; group < groupCount; group++) {
    const groupStart = srcStart + group * 32;
    let maxValue: f32 = 0.0;
    let maxMagnitude: f32 = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, groupStart + lane);
      const magnitude = absF32(value);
      weights[i32(lane)] = value * value;
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
        maxValue = value;
      }
    }

    if (maxMagnitude < 1.0e-15) {
      scales[i32(group)] = 0.0;
      continue;
    }

    let scale = (tryCount > 0 ? -maxValue : maxValue) / iq4NlValue(0);
    let inverseScale: f32 = f32(1.0) / scale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, groupStart + lane);
      const quant = bestIq4NlIndex(inverseScale * value);
      levels[i32(group * 32 + lane)] = u8(quant);
      const q = iq4NlValue(quant);
      const weight = weights[i32(lane)];
      sumQx += weight * q * value;
      sumQ2 += weight * q * q;
    }
    scale = sumQ2 > 0.0 ? sumQx / sumQ2 : 0.0;
    let best = scale * sumQx;

    for (let offset: i32 = -tryCount; offset <= tryCount; offset++) {
      inverseScale = (f32(offset) + iq4NlValue(0)) / maxValue;
      sumQx = 0.0;
      sumQ2 = 0.0;
      for (let lane: u32 = 0; lane < 32; lane++) {
        const value = readF32(src, groupStart + lane);
        const quant = bestIq4NlIndex(inverseScale * value);
        const q = iq4NlValue(quant);
        const weight = weights[i32(lane)];
        sumQx += weight * q * value;
        sumQ2 += weight * q * q;
      }
      if (sumQ2 > 0.0 && sumQx * sumQx > best * sumQ2) {
        scale = sumQx / sumQ2;
        best = scale * sumQx;
      }
    }

    scales[i32(group)] = scale;
    const absScale = absF32(scale);
    if (absScale > maxAbsScale) {
      maxAbsScale = absScale;
      maxScale = scale;
    }
  }

  if (groupCount == 1) {
    store<u16>(dst, f32ToFp16(scales[0]));
  } else {
    const superScale: f32 = -maxScale / 32.0;
    store<u16>(dst, f32ToFp16(superScale));
    let highScales: u16 = 0;
    for (let byte: u32 = 0; byte < 4; byte++) store<u8>(dst + usize(4 + byte), 0);

    const inverseSuperScale: f32 = superScale != 0.0 ? 1.0 / superScale : 0.0;
    for (let group: u32 = 0; group < groupCount; group++) {
      const scaleCode = clampQuant(roundNearestEven(inverseSuperScale * scales[i32(group)]), -32, 31) + 32;
      const scaleLowOffset = 4 + group / 2;
      const currentLow = u32(load<u8>(dst + usize(scaleLowOffset)));
      const packedLow = group % 2 == 0
        ? (currentLow & 0xf0) | u32(scaleCode & 15)
        : (currentLow & 0x0f) | (u32(scaleCode & 15) << 4);
      store<u8>(dst + usize(scaleLowOffset), u8(packedLow));
      highScales |= u16(u32(scaleCode >> 4) << i32(group * 2));

      const blockScale = fp16ToF32(load<u16>(dst)) * f32(scaleCode - 32);
      const inverseBlockScale: f32 = blockScale != 0.0 ? 1.0 / blockScale : 0.0;
      const groupStart = srcStart + group * 32;
      for (let lane: u32 = 0; lane < 32; lane++) {
        levels[i32(group * 32 + lane)] = u8(bestIq4NlIndex(inverseBlockScale * readF32(src, groupStart + lane)));
      }
    }
    store<u16>(dst + 2, highScales);
  }

  const quantsOffset: u32 = groupCount > 1 ? 8 : 2;
  for (let group: u32 = 0; group < groupCount; group++) {
    const groupDst = dst + usize(quantsOffset + group * 16);
    for (let lane: u32 = 0; lane < 16; lane++) {
      const low = u32(levels[i32(group * 32 + lane)]);
      const high = u32(levels[i32(group * 32 + lane + 16)]);
      store<u8>(groupDst + usize(lane), u8(low | (high << 4)));
    }
  }
}

export function quantize_iq4_nl(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  const levels = new StaticArray<u8>(32);
  const weights = new StaticArray<f32>(32);
  const scales = new StaticArray<f32>(1);
  for (let block: u32 = 0; block < k / 32; block++) {
    quantizeIq4NlSuperBlock(src, dst + usize(block * 18), block * 32, 1, -1, levels, weights, scales);
  }
}

export function dequantize_iq4_nl(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 32);
  for (let block: u32 = 0; block < k / 32; block++) {
    const blockSrc = src + usize(block * 18);
    const d = fp16ToF32(load<u16>(blockSrc));
    for (let lane: u32 = 0; lane < 16; lane++) {
      const packed = load<u8>(blockSrc + usize(2 + lane));
      writeF32(dst, block * 32 + lane, d * iq4NlValue(u32(packed & 15)));
      writeF32(dst, block * 32 + 16 + lane, d * iq4NlValue(u32(packed >> 4)));
    }
  }
}

export function quantize_iq4_xs(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const levels = new StaticArray<u8>(256);
  const weights = new StaticArray<f32>(32);
  const scales = new StaticArray<f32>(8);
  for (let block: u32 = 0; block < k / 256; block++) {
    quantizeIq4NlSuperBlock(src, dst + usize(block * 136), block * 256, 8, 7, levels, weights, scales);
  }
}

export function dequantize_iq4_xs(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 136);
    const d = fp16ToF32(load<u16>(blockSrc));
    const scalesHigh = load<u16>(blockSrc + 2);
    for (let group: u32 = 0; group < 8; group++) {
      const scaleByte = load<u8>(blockSrc + usize(4 + group / 2));
      const scaleLow = group % 2 == 0 ? u32(scaleByte & 15) : u32(scaleByte >> 4);
      const scaleHigh = (u32(scalesHigh) >> i32(group * 2)) & 3;
      const groupScale = d * f32(i32(scaleLow | (scaleHigh << 4)) - 32);
      for (let lane: u32 = 0; lane < 16; lane++) {
        const packed = load<u8>(blockSrc + usize(8 + group * 16 + lane));
        writeF32(dst, block * 256 + group * 32 + lane, groupScale * iq4NlValue(u32(packed & 15)));
        writeF32(dst, block * 256 + group * 32 + 16 + lane, groupScale * iq4NlValue(u32(packed >> 4)));
      }
    }
  }
}

function fitIqKsGroup(
  src: FloatPtr,
  srcStart: u32,
  kind: u32,
  tryCount: i32,
  weights: StaticArray<f32>,
  result: StaticArray<f32>,
): void {
  let maxValue: f32 = 0.0;
  let maxMagnitude: f32 = 0.0;
  for (let lane: u32 = 0; lane < 32; lane++) {
    const value = readF32(src, srcStart + lane);
    const magnitude = absF32(value);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      maxValue = value;
    }
  }
  if (maxMagnitude < 1.0e-16) {
    result[0] = 0.0;
    result[1] = 0.0;
    return;
  }

  const firstValue = iqKCodebookValue(kind, false, 0);
  let scale = -maxValue / firstValue;
  let inverseScale: f32 = 1.0 / scale;
  let sumQxPositive: f32 = 0.0;
  let sumQ2Positive: f32 = 0.0;
  let sumQxNegative: f32 = 0.0;
  let sumQ2Negative: f32 = 0.0;
  for (let lane: u32 = 0; lane < 32; lane++) {
    const value = readF32(src, srcStart + lane);
    const weight = weights[i32(lane)];
    let index = bestIqKIndex(kind, false, inverseScale * value);
    let quant = iqKCodebookValue(kind, false, index);
    sumQxPositive += weight * quant * value;
    sumQ2Positive += weight * quant * quant;
    index = bestIqKIndex(kind, false, -inverseScale * value);
    quant = iqKCodebookValue(kind, false, index);
    sumQxNegative += weight * quant * value;
    sumQ2Negative += weight * quant * quant;
  }
  scale = sumQxPositive / sumQ2Positive;
  let best = scale * sumQxPositive;
  let bestShifted = false;
  if (sumQ2Negative > 0.0 && sumQxNegative * sumQxNegative > best * sumQ2Negative) {
    scale = sumQxNegative / sumQ2Negative;
    best = scale * sumQxNegative;
  }

  for (let attempt: i32 = -tryCount; attempt <= tryCount; attempt++) {
    inverseScale = (f32(attempt) + firstValue) / maxValue;
    sumQxPositive = 0.0;
    sumQ2Positive = 0.0;
    sumQxNegative = 0.0;
    sumQ2Negative = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, srcStart + lane);
      const weight = weights[i32(lane)];
      let index = bestIqKIndex(kind, false, inverseScale * value);
      let quant = iqKCodebookValue(kind, false, index);
      sumQxPositive += weight * quant * value;
      sumQ2Positive += weight * quant * quant;
      index = bestIqKIndex(kind, false, -inverseScale * value);
      quant = iqKCodebookValue(kind, false, index);
      sumQxNegative += weight * quant * value;
      sumQ2Negative += weight * quant * quant;
    }
    if (sumQ2Positive > 0.0 && sumQxPositive * sumQxPositive > best * sumQ2Positive) {
      scale = sumQxPositive / sumQ2Positive;
      best = scale * sumQxPositive;
      bestShifted = false;
    }
    if (sumQ2Negative > 0.0 && sumQxNegative * sumQxNegative > best * sumQ2Negative) {
      scale = sumQxNegative / sumQ2Negative;
      best = scale * sumQxNegative;
      bestShifted = false;
    }

    inverseScale = (f32(attempt) + iqKCodebookValue(kind, true, 0)) / maxValue;
    sumQxPositive = 0.0;
    sumQ2Positive = 0.0;
    sumQxNegative = 0.0;
    sumQ2Negative = 0.0;
    for (let lane: u32 = 0; lane < 32; lane++) {
      const value = readF32(src, srcStart + lane);
      const weight = weights[i32(lane)];
      let index = bestIqKIndex(kind, true, inverseScale * value);
      let quant = iqKCodebookValue(kind, true, index);
      sumQxPositive += weight * quant * value;
      sumQ2Positive += weight * quant * quant;
      index = bestIqKIndex(kind, true, -inverseScale * value);
      quant = iqKCodebookValue(kind, true, index);
      sumQxNegative += weight * quant * value;
      sumQ2Negative += weight * quant * quant;
    }
    if (sumQ2Positive > 0.0 && sumQxPositive * sumQxPositive > best * sumQ2Positive) {
      scale = sumQxPositive / sumQ2Positive;
      best = scale * sumQxPositive;
      bestShifted = true;
    }
    if (sumQ2Negative > 0.0 && sumQxNegative * sumQxNegative > best * sumQ2Negative) {
      scale = sumQxNegative / sumQ2Negative;
      best = scale * sumQxNegative;
      bestShifted = true;
    }
  }
  result[0] = scale;
  result[1] = bestShifted ? 1.0 : 0.0;
}

function fitIq2KsSegments(
  sumX: StaticArray<f32>,
  sumW: StaticArray<f32>,
  count: u32,
  first: u32,
  second: u32,
  third: u32,
  shifted: bool,
  reversed: bool,
  result: StaticArray<f32>,
): void {
  let sumQx: f32 = 0.0;
  let sumQ2: f32 = 0.0;
  for (let segment: u32 = 0; segment < 4; segment++) {
    const start = segment == 0 ? 0 : segment == 1 ? first : segment == 2 ? second : third;
    const end = segment == 0 ? first : segment == 1 ? second : segment == 2 ? third : count;
    const index = reversed ? 3 - segment : segment;
    const quant = iq2KValue(shifted, index);
    const weightedX = sumX[i32(end)] - sumX[i32(start)];
    const segmentWeight = sumW[i32(end)] - sumW[i32(start)];
    sumQx += weightedX * quant;
    sumQ2 += segmentWeight * quant * quant;
  }
  result[0] = sumQx;
  result[1] = sumQ2;
}

function makeIqKsScaleQuants(
  values: StaticArray<f32>,
  weights: StaticArray<f32>,
  count: u32,
  maxLevel: i32,
  levels: StaticArray<i32>,
): f32 {
  let maxValue: f32 = 0.0;
  let maxMagnitude: f32 = 0.0;
  for (let index: u32 = 0; index < count; index++) {
    const value = values[i32(index)];
    const magnitude = absF32(value);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      maxValue = value;
    }
  }
  if (maxMagnitude == 0.0) {
    for (let index: u32 = 0; index < count; index++) levels[i32(index)] = 0;
    return 0.0;
  }

  let inverseScale: f32 = -f32(maxLevel) / maxValue;
  let sumLx: f32 = 0.0;
  let sumL2: f32 = 0.0;
  for (let index: u32 = 0; index < count; index++) {
    const level = clampQuant(roundNearestEven(inverseScale * values[i32(index)]), -maxLevel, maxLevel - 1);
    levels[i32(index)] = level + maxLevel;
    const weight = weights[i32(index)];
    sumLx += weight * values[i32(index)] * f32(level);
    sumL2 += weight * f32(level * level);
  }
  let scale: f32 = sumL2 != 0.0 ? sumLx / sumL2 : 0.0;
  let best = scale * sumLx;
  for (let step: i32 = -9; step <= 9; step++) {
    if (step == 0) continue;
    inverseScale = -(f32(maxLevel) + 0.1 * f32(step)) / maxValue;
    sumLx = 0.0;
    sumL2 = 0.0;
    for (let index: u32 = 0; index < count; index++) {
      const level = clampQuant(roundNearestEven(inverseScale * values[i32(index)]), -maxLevel, maxLevel - 1);
      const weight = weights[i32(index)];
      sumLx += weight * values[i32(index)] * f32(level);
      sumL2 += weight * f32(level * level);
    }
    if (sumL2 > 0.0 && sumLx * sumLx > best * sumL2) {
      for (let index: u32 = 0; index < count; index++) {
        const level = clampQuant(roundNearestEven(inverseScale * values[i32(index)]), -maxLevel, maxLevel - 1);
        levels[i32(index)] = level + maxLevel;
      }
      scale = sumLx / sumL2;
      best = scale * sumLx;
    }
  }
  return scale;
}

export function quantize_iq2_ks(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 2 + blocksPerRow * 70;
  const scales = new StaticArray<f32>(groupsPerRow);
  const scaleWeights = new StaticArray<f32>(groupsPerRow);
  const levels = new StaticArray<i32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);
  const sortedOrder = new StaticArray<u32>(32);
  const sumX = new StaticArray<f32>(33);
  const sumW = new StaticArray<f32>(33);
  const fit = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<u16>(rowDst, 0);
    let rowMaxScale: f32 = 0.0;
    let rowMaxAbsScale: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 70);
      for (let byte: u32 = 0; byte < 70; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      let sumSquares: f32 = 0.0;
      for (let element: u32 = 0; element < 256; element++) {
        const value = readF32(src, blockStart + element);
        sumSquares += value * value;
      }
      const sigma2: f32 = 1.5 * sumSquares / 256.0;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        let totalWeight: f32 = 0.0;
        let maxMagnitude: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          const weight: f32 = 0.25 * sigma2 + value * value;
          weights[i32(lane)] = weight;
          sortedOrder[i32(lane)] = lane;
          totalWeight += weight;
          const magnitude = absF32(value);
          if (magnitude > maxMagnitude) maxMagnitude = magnitude;
        }
        const groupIndex = block * 8 + group;
        scaleWeights[i32(groupIndex)] = totalWeight;
        if (maxMagnitude < 1.0e-16) {
          scales[i32(groupIndex)] = 0.0;
          continue;
        }

        for (let position: i32 = 1; position < 32; position++) {
          const selected = sortedOrder[position];
          const selectedValue = readF32(src, groupStart + selected);
          let cursor = position - 1;
          while (cursor >= 0) {
            const previous = sortedOrder[cursor];
            const previousValue = readF32(src, groupStart + previous);
            if (previousValue < selectedValue ||
                (previousValue == selectedValue && previous <= selected)) break;
            sortedOrder[cursor + 1] = previous;
            cursor--;
          }
          sortedOrder[cursor + 1] = selected;
        }
        sumX[0] = 0.0;
        sumW[0] = 0.0;
        for (let position: u32 = 0; position < 32; position++) {
          const lane = sortedOrder[i32(position)];
          sumW[i32(position + 1)] = sumW[i32(position)] + weights[i32(lane)];
          sumX[i32(position + 1)] = sumX[i32(position)] + weights[i32(lane)] * readF32(src, groupStart + lane);
        }

        let best: f32 = 0.0;
        let groupScale: f32 = 0.0;
        let shifted = false;
        for (let first: u32 = 0; first < 24; first++) {
          for (let second: u32 = first; second < 32; second++) {
            const minimumThird = second > 8 ? second : 8;
            for (let third: u32 = minimumThird; third < 32; third++) {
              for (let candidate: u32 = 0; candidate < 4; candidate++) {
                fitIq2KsSegments(sumX, sumW, 32, first, second, third,
                  (candidate & 1) != 0, candidate >= 2, fit);
                if (fit[1] > 0.0 && fit[0] * fit[0] > best * fit[1]) {
                  groupScale = fit[0] / fit[1];
                  best = groupScale * fit[0];
                  shifted = (candidate & 1) != 0;
                }
              }
            }
          }
        }
        scales[i32(groupIndex)] = groupScale;
        if (shifted) store<u16>(blockDst, load<u16>(blockDst) | u16(u32(1) << i32(group)));
      }
    }

    const rowScale = makeIqKsScaleQuants(scales, scaleWeights, groupsPerRow, 16, levels);
    store<u16>(rowDst, f32ToFp16(1.030 * rowScale));
    if (rowScale == 0.0) continue;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 70);
      const blockStart = srcRow + block * 256;
      let blockSumSquares: f32 = 0.0;
      for (let element: u32 = 0; element < 256; element++) {
        const value = readF32(src, blockStart + element);
        blockSumSquares += value * value;
      }
      const blockSigma2: f32 = 1.5 * blockSumSquares / 256.0;
      let extra = u32(load<u16>(blockDst));
      for (let group: u32 = 0; group < 8; group++) {
        const groupIndex = block * 8 + group;
        const level = levels[i32(groupIndex)];
        store<u8>(blockDst + usize(2 + group / 2),
          load<u8>(blockDst + usize(2 + group / 2)) | u8((level & 15) << i32(4 * (group & 1))));
        extra |= u32((level >> 4) & 1) << i32(8 + group);
        const shifted = (extra & (u32(1) << i32(group))) != 0;
        const signedLevel = level - 16;
        const groupScale = rowScale * f32(signedLevel);
        const inverseGroupScale: f32 = groupScale != 0.0 ? 1.0 / groupScale : 0.0;
        const groupStart = blockStart + group * 32;
        const quantOffset = 6 + (group / 4) * 32;
        const quantShift = i32(2 * (group & 3));
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          const index = bestIq2KIndex(shifted, inverseGroupScale * value);
          const quantAddress = blockDst + usize(quantOffset + lane);
          store<u8>(quantAddress, load<u8>(quantAddress) | u8(index << quantShift));
          const weight: f32 = 0.25 * blockSigma2 + value * value;
          const quant = iq2KValue(shifted, index) * f32(signedLevel);
          sumQx += weight * quant * value;
          sumQ2 += weight * quant * quant;
        }
      }
      store<u16>(blockDst, u16(extra));
    }
    store<u16>(rowDst, f32ToFp16(sumQ2 > 0.0 ? 1.030 * sumQx / sumQ2 : 1.030 * rowScale));
  }
}

export function dequantize_iq2_ks(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 2 + blocksPerRow * 70;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = fp16ToF32(load<u16>(rowSrc));
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(2 + block * 70);
      let extra = u32(load<u16>(blockSrc));
      for (let half: u32 = 0; half < 4; half++) {
        const scaleByte = u32(load<u8>(blockSrc + usize(2 + half)));
        const high0 = (extra >> 4) & 0x10;
        const high1 = (extra >> 5) & 0x10;
        const scale0 = d * f32(i32((scaleByte & 15) | high0) - 16);
        const scale1 = d * f32(i32((scaleByte >> 4) | high1) - 16);
        const shifted0 = (extra & 1) != 0;
        const shifted1 = (extra & 2) != 0;
        const quantOffset = 6 + (half / 2) * 32;
        const quantShift0 = i32(4 * (half & 1));
        const quantShift1 = quantShift0 + 2;
        const outputStart = rowDst + block * 256 + half * 64;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const packed = u32(load<u8>(blockSrc + usize(quantOffset + lane)));
          const index0 = (packed >> quantShift0) & 3;
          const index1 = (packed >> quantShift1) & 3;
          writeF32(dst, outputStart + lane, scale0 * iq2KValue(shifted0, index0));
          writeF32(dst, outputStart + 32 + lane, scale1 * iq2KValue(shifted1, index1));
        }
        extra >>= 2;
      }
    }
  }
}

export function quantize_iq3_ks(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 2 + blocksPerRow * 102;
  const groupScales = new StaticArray<f32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);
  const result = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<u16>(rowDst, 0);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 102);
      for (let byte: u32 = 0; byte < 102; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          weights[i32(lane)] = value * value;
        }
        fitIqKsGroup(src, groupStart, 2, 5, weights, result);
        const scale = result[0];
        groupScales[i32(block * 8 + group)] = scale;
        if (result[1] != 0.0) {
          store<u16>(blockDst, load<u16>(blockDst) | u16(u32(1) << i32(8 + group)));
        }
      }
    }

    let rowMaxScale: f32 = 0.0;
    let rowMaxAbsScale: f32 = 0.0;
    for (let index: u32 = 0; index < groupsPerRow; index++) {
      const scale = groupScales[i32(index)];
      const magnitude = absF32(scale);
      if (magnitude > rowMaxAbsScale) {
        rowMaxAbsScale = magnitude;
        rowMaxScale = scale;
      }
    }
    const d = -rowMaxScale / 16.0;
    store<u16>(rowDst, f32ToFp16(d));
    if (d == 0.0) continue;
    const inverseScale: f32 = 1.0 / d;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 102);
      const blockStart = srcRow + block * 256;
      let extra = u32(load<u16>(blockDst));
      for (let group: u32 = 0; group < 8; group++) {
        const scale = groupScales[i32(block * 8 + group)];
        let level = clampQuant(roundNearestEven(inverseScale * scale), -16, 15);
        const storedLevel = u32(level + 16);
        const scaleAddress = blockDst + usize(2 + (group & 3));
        store<u8>(scaleAddress, load<u8>(scaleAddress) | u8((storedLevel & 15) << i32(4 * (group / 4))));
        extra |= ((storedLevel >> 4) & 1) << i32(group);
        const shifted = (extra & (u32(1) << i32(8 + group))) != 0;
        const groupScale = d * f32(level);
        const inverseGroupScale: f32 = groupScale != 0.0 ? 1.0 / groupScale : 0.0;
        const groupStart = blockStart + group * 32;
        const quantOffset = 6 + (group / 4) * 32;
        const highOffset = 70 + (group / 8) * 32;
        const quantShift = i32(2 * (group & 3));
        const highShift = i32(group & 7);
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          const index = bestIqKIndex(2, shifted, inverseGroupScale * value);
          const quantAddress = blockDst + usize(quantOffset + lane);
          const highAddress = blockDst + usize(highOffset + lane);
          store<u8>(quantAddress, load<u8>(quantAddress) | u8((index & 3) << quantShift));
          store<u8>(highAddress, load<u8>(highAddress) | u8((index >> 2) << highShift));
          const weight = value * value;
          const quant = iqKCodebookValue(2, shifted, index) * f32(level);
          sumQx += weight * quant * value;
          sumQ2 += weight * quant * quant;
        }
      }
      store<u16>(blockDst, u16(extra));
    }
    store<u16>(rowDst, f32ToFp16(sumQ2 > 0.0 ? sumQx / sumQ2 : d));
  }
}

export function dequantize_iq3_ks(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 2 + blocksPerRow * 102;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = fp16ToF32(load<u16>(rowSrc));
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(2 + block * 102);
      const extra = u32(load<u16>(blockSrc));
      for (let half: u32 = 0; half < 2; half++) {
        for (let group: u32 = 0; group < 4; group++) {
          const packedScale = u32(load<u8>(blockSrc + usize(2 + group)));
          const group0 = half * 4 + group;
          const level = half == 0 ? i32(packedScale & 15) : i32(packedScale >> 4);
          const scaleLevel = level | (i32((extra >> i32(group0)) & 1) << 4);
          const scale = d * f32(scaleLevel - 16);
          const shifted = (extra & (u32(1) << i32(8 + group0))) != 0;
          const quantOffset = 6 + half * 32;
          const highShift = i32(half * 4 + group);
          const outputStart = rowDst + block * 256 + half * 128 + group * 32;
          for (let lane: u32 = 0; lane < 32; lane++) {
            const packed = u32(load<u8>(blockSrc + usize(quantOffset + lane)));
            const high = (u32(load<u8>(blockSrc + usize(70 + lane))) >> highShift) & 1;
            const index = ((packed >> i32(2 * group)) & 3) | (high << 2);
            writeF32(dst, outputStart + lane, scale * iqKCodebookValue(2, shifted, index));
          }
        }
      }
    }
  }
}

export function quantize_iq4_ks(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 4 + blocksPerRow * 136;
  const groupScales = new StaticArray<f32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);
  const result = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<f32>(rowDst, 0.0);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 136);
      for (let byte: u32 = 0; byte < 136; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          weights[i32(lane)] = value * value;
        }
        fitIqKsGroup(src, groupStart, 3, 7, weights, result);
        const scale = result[0];
        groupScales[i32(block * 8 + group)] = scale;
        if (result[1] != 0.0) store<u8>(blockDst + usize(group), 1);
      }
    }

    let rowMaxScale: f32 = 0.0;
    let rowMaxAbsScale: f32 = 0.0;
    for (let index: u32 = 0; index < groupsPerRow; index++) {
      const scale = groupScales[i32(index)];
      const magnitude = absF32(scale);
      if (magnitude > rowMaxAbsScale) {
        rowMaxAbsScale = magnitude;
        rowMaxScale = scale;
      }
    }
    const d: f32 = rowMaxAbsScale / 127.0;
    store<f32>(rowDst, d);
    if (d == 0.0) continue;
    const inverseScale: f32 = 1.0 / d;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 136);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const scale = groupScales[i32(block * 8 + group)];
        let level = clampQuant(roundNearestEven(0.5 * (inverseScale * scale + 127.0)), 0, 127) << 1;
        store<u8>(blockDst + usize(group), load<u8>(blockDst + usize(group)) | u8(level));
        level -= 127;
        const shifted = (load<u8>(blockDst + usize(group)) & 1) != 0;
        const groupScale = d * f32(level);
        const inverseGroupScale: f32 = groupScale != 0.0 ? 1.0 / groupScale : 0.0;
        const groupStart = blockStart + group * 32;
        for (let lane: u32 = 0; lane < 16; lane++) {
          const value0 = readF32(src, groupStart + lane);
          const value1 = readF32(src, groupStart + 16 + lane);
          const index0 = bestIqKIndex(3, shifted, inverseGroupScale * value0);
          const index1 = bestIqKIndex(3, shifted, inverseGroupScale * value1);
          const quantAddress = blockDst + usize(8 + group * 16 + lane);
          store<u8>(quantAddress, u8(index0 | (index1 << 4)));
          const weight0 = value0 * value0;
          const weight1 = value1 * value1;
          const quant0 = iqKCodebookValue(3, shifted, index0) * f32(level);
          const quant1 = iqKCodebookValue(3, shifted, index1) * f32(level);
          sumQx += weight0 * quant0 * value0 + weight1 * quant1 * value1;
          sumQ2 += weight0 * quant0 * quant0 + weight1 * quant1 * quant1;
        }
      }
    }
    store<f32>(rowDst, sumQ2 > 0.0 ? sumQx / sumQ2 : d);
  }
}

export function dequantize_iq4_ks(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 136;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = load<f32>(rowSrc);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(4 + block * 136);
      for (let group: u32 = 0; group < 8; group++) {
        const scaleByte = u32(load<u8>(blockSrc + usize(group)));
        const scale = d * f32(i32(scaleByte & 254) - 127);
        const shifted = (scaleByte & 1) != 0;
        const groupStart = rowDst + block * 256 + group * 32;
        for (let lane: u32 = 0; lane < 16; lane++) {
          const packed = u32(load<u8>(blockSrc + usize(8 + group * 16 + lane)));
          writeF32(dst, groupStart + lane, scale * iqKCodebookValue(3, shifted, packed & 15));
          writeF32(dst, groupStart + 16 + lane, scale * iqKCodebookValue(3, shifted, packed >> 4));
        }
      }
    }
  }
}

export function quantize_iq5_ks(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 4 + blocksPerRow * 168;
  const groupScales = new StaticArray<f32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);
  const result = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<f32>(rowDst, 0.0);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 168);
      for (let byte: u32 = 0; byte < 168; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          weights[i32(lane)] = value * value;
        }
        fitIqKsGroup(src, groupStart, 4, 5, weights, result);
        const scale = result[0];
        groupScales[i32(block * 8 + group)] = scale;
        if (result[1] != 0.0) store<u8>(blockDst + usize(group), 1);
      }
    }

    let rowMaxScale: f32 = 0.0;
    let rowMaxAbsScale: f32 = 0.0;
    for (let index: u32 = 0; index < groupsPerRow; index++) {
      const scale = groupScales[i32(index)];
      const magnitude = absF32(scale);
      if (magnitude > rowMaxAbsScale) {
        rowMaxAbsScale = magnitude;
        rowMaxScale = scale;
      }
    }
    const d: f32 = rowMaxAbsScale / 127.0;
    store<f32>(rowDst, d);
    if (d == 0.0) continue;
    const inverseScale: f32 = 1.0 / d;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 168);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const scale = groupScales[i32(block * 8 + group)];
        let level = clampQuant(roundNearestEven(0.5 * (inverseScale * scale + 127.0)), 0, 127) << 1;
        store<u8>(blockDst + usize(group), load<u8>(blockDst + usize(group)) | u8(level));
        level -= 127;
        const shifted = (load<u8>(blockDst + usize(group)) & 1) != 0;
        const groupScale = d * f32(level);
        const inverseGroupScale: f32 = groupScale != 0.0 ? 1.0 / groupScale : 0.0;
        const groupStart = blockStart + group * 32;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          const index = bestIqKIndex(4, shifted, inverseGroupScale * value);
          const quantAddress = blockDst + usize(8 + (group / 2) * 32 + lane);
          const highAddress = blockDst + usize(136 + lane);
          store<u8>(quantAddress, load<u8>(quantAddress) | u8((index & 15) << i32(4 * (group & 1))));
          store<u8>(highAddress, load<u8>(highAddress) | u8((index >> 4) << i32(group)));
          const weight = value * value;
          const quant = iqKCodebookValue(4, shifted, index) * f32(level);
          sumQx += weight * quant * value;
          sumQ2 += weight * quant * quant;
        }
      }
    }
    store<f32>(rowDst, sumQ2 > 0.0 ? sumQx / sumQ2 : d);
  }
}

export function dequantize_iq5_ks(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 168;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = load<f32>(rowSrc);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(4 + block * 168);
      for (let half: u32 = 0; half < 4; half++) {
        const scaleByte0 = u32(load<u8>(blockSrc + usize(2 * half)));
        const scaleByte1 = u32(load<u8>(blockSrc + usize(2 * half + 1)));
        const qOffset = 8 + half * 32;
        const hShift0 = i32(2 * half);
        const hShift1 = i32(2 * half + 1);
        const scale0 = d * f32(i32(scaleByte0 & 254) - 127);
        const scale1 = d * f32(i32(scaleByte1 & 254) - 127);
        const shifted0 = (scaleByte0 & 1) != 0;
        const shifted1 = (scaleByte1 & 1) != 0;
        const outputStart = rowDst + block * 256 + half * 64;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const packed = u32(load<u8>(blockSrc + usize(qOffset + lane)));
          const high = u32(load<u8>(blockSrc + usize(136 + lane)));
          const index0 = (packed & 15) | (((high >> hShift0) & 1) << 4);
          const index1 = (packed >> 4) | (((high >> hShift1) & 1) << 4);
          writeF32(dst, outputStart + lane, scale0 * iqKCodebookValue(4, shifted0, index0));
          writeF32(dst, outputStart + 32 + lane, scale1 * iqKCodebookValue(4, shifted1, index1));
        }
      }
    }
  }
}

function popcountU32(value: u32): u32 {
  let bits = value;
  let count: u32 = 0;
  while (bits != 0) {
    count += bits & 1;
    bits >>>= 1;
  }
  return count;
}

function scrambleIq4Ks(index: u32): u32 {
  let value = index | ((popcountU32(index) & 1) << 15);
  value ^= value << 1;
  value ^= value << 2;
  value ^= value << 4;
  value ^= value << 8;
  return value & 0x7fff;
}

function pruneIq4Ks(value: u32, shifted: bool, values: StaticArray<f32>, sample: StaticArray<f32>, weights: StaticArray<f32>, scale: f32): u32 {
  if ((popcountU32(value) & 1) == 0) return value;
  let bestScore: f32 = 3.4028235e38;
  let bestPosition: i32 = -1;
  let bestLevel: u32 = 0;
  for (let position: u32 = 0; position < 4; position++) {
    const level = (value >> i32(4 * position)) & 15;
    const parity = popcountU32(level);
    const baseDifference = scale * iqKCodebookValue(3, false, level) - sample[i32(position)];
    const minimum = level > 2 ? level - 2 : 0;
    const maximum = level + 2 < 16 ? level + 2 : 15;
    for (let candidate: u32 = minimum; candidate <= maximum; candidate++) {
      if (candidate == level || ((popcountU32(candidate) ^ parity) & 1) == 0) continue;
      const candidateValue = shifted
        ? iqKCodebookValue(3, true, candidate)
        : iqKCodebookValue(3, false, candidate);
      const difference = scale * candidateValue - sample[i32(position)];
      const score = weights[i32(position)] * (difference * difference - baseDifference * baseDifference);
      if (score < bestScore) {
        bestScore = score;
        bestPosition = i32(position);
        bestLevel = candidate;
      }
    }
  }
  if (bestPosition < 0) return value;
  const mask = u32(15) << i32(4 * bestPosition);
  return (value & ~mask) | (bestLevel << i32(4 * bestPosition));
}

function makeIq4KsPackedValues(
  src: FloatPtr,
  srcStart: u32,
  group: u32,
  shifted: bool,
  inverseScale: f32,
  weights: StaticArray<f32>,
  packed: StaticArray<u32>,
  scores: StaticArray<f32>,
): void {
  const groupStart = srcStart + group * 32;
  const groupValues = shifted ? 1 : 0;
  let sumQx: f32 = 0.0;
  let sumQ2: f32 = 0.0;
  for (let chunk: u32 = 0; chunk < 8; chunk++) {
    const sample = new StaticArray<f32>(4);
    const chunkWeights = new StaticArray<f32>(4);
    sample[0] = readF32(src, groupStart + 2 * chunk);
    sample[1] = readF32(src, groupStart + 16 + 2 * chunk);
    sample[2] = readF32(src, groupStart + 1 + 2 * chunk);
    sample[3] = readF32(src, groupStart + 17 + 2 * chunk);
    chunkWeights[0] = weights[i32(2 * chunk)];
    chunkWeights[1] = weights[i32(16 + 2 * chunk)];
    chunkWeights[2] = weights[i32(1 + 2 * chunk)];
    chunkWeights[3] = weights[i32(17 + 2 * chunk)];
    let positive: u32 = 0;
    let negative: u32 = 0;
    for (let position: u32 = 0; position < 4; position++) {
      positive |= bestIqKIndex(3, shifted, inverseScale * sample[i32(position)]) << i32(4 * position);
      negative |= bestIqKIndex(3, shifted, -inverseScale * sample[i32(position)]) << i32(4 * position);
    }
    positive = pruneIq4Ks(positive, shifted, IQ4_K_VALUES_F32, sample, chunkWeights, 1.0 / inverseScale);
    negative = pruneIq4Ks(negative, shifted, IQ4_K_VALUES_F32, sample, chunkWeights, 1.0 / inverseScale);
    packed[i32(chunk)] = positive;
    const base = groupValues;
    let positiveQx: f32 = 0.0;
    let positiveQ2: f32 = 0.0;
    let negativeQx: f32 = 0.0;
    let negativeQ2: f32 = 0.0;
    for (let position: u32 = 0; position < 4; position++) {
      const value = sample[i32(position)];
      const weight = chunkWeights[i32(position)];
      const positiveIndex = (positive >> i32(4 * position)) & 15;
      const negativeIndex = (negative >> i32(4 * position)) & 15;
      const positiveValue = iqKCodebookValue(3, shifted, positiveIndex);
      const negativeValue = iqKCodebookValue(3, shifted, negativeIndex);
      positiveQx += weight * positiveValue * value;
      positiveQ2 += weight * positiveValue * positiveValue;
      negativeQx += weight * negativeValue * value;
      negativeQ2 += weight * negativeValue * negativeValue;
    }
    sumQx += positiveQx;
    sumQ2 += positiveQ2;
    scores[i32(chunk)] = negativeQx * negativeQx > positiveQx * positiveQx ? negativeQx : positiveQx;
    if (base > 1) unreachable();
  }
  scores[8] = sumQx;
  scores[9] = sumQ2;
}

const IQ4_K_VALUES_F32: StaticArray<f32> = StaticArray.fromArray<f32>([
  -127.0, -104.0, -83.0, -65.0, -49.0, -35.0, -22.0, -10.0,
  1.0, 13.0, 25.0, 38.0, 53.0, 69.0, 89.0, 113.0,
  -123.0, -100.0, -79.0, -61.0, -45.0, -31.0, -18.0, -6.0,
  5.0, 17.0, 29.0, 42.0, 57.0, 73.0, 93.0, 117.0,
]);

export function quantize_iq4_kss(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 4 + blocksPerRow * 128;
  const groupScales = new StaticArray<f32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);
  const sample = new StaticArray<f32>(4);
  const chunkWeights = new StaticArray<f32>(4);
  const packedPositive = new StaticArray<u32>(8);
  const packedNegative = new StaticArray<u32>(8);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<f32>(rowDst, 0.0);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 128);
      for (let byte: u32 = 0; byte < 128; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        let maxValue: f32 = 0.0;
        let maxMagnitude: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          weights[i32(lane)] = value * value;
          const magnitude = absF32(value);
          if (magnitude > maxMagnitude) {
            maxMagnitude = magnitude;
            maxValue = value;
          }
        }
        if (maxMagnitude < 1.0e-16) {
          groupScales[i32(block * 8 + group)] = 0.0;
          continue;
        }
        let best: f32 = 0.0;
        let groupScale: f32 = -maxValue / iqKCodebookValue(3, false, 0);
        for (let attempt: i32 = -7; attempt <= 7; attempt++) {
          for (let mode: u32 = 0; mode < 2; mode++) {
            const shifted = mode != 0;
            const inverseScale = (f32(attempt) + iqKCodebookValue(3, shifted, 0)) / maxValue;
            let sumQxPositive: f32 = 0.0;
            let sumQ2Positive: f32 = 0.0;
            let sumQxNegative: f32 = 0.0;
            let sumQ2Negative: f32 = 0.0;
            for (let chunk: u32 = 0; chunk < 8; chunk++) {
              const chunkStart = groupStart + 2 * chunk;
              sample[0] = readF32(src, chunkStart);
              sample[1] = readF32(src, groupStart + 16 + 2 * chunk);
              sample[2] = readF32(src, chunkStart + 1);
              sample[3] = readF32(src, groupStart + 17 + 2 * chunk);
              chunkWeights[0] = weights[i32(2 * chunk)];
              chunkWeights[1] = weights[i32(16 + 2 * chunk)];
              chunkWeights[2] = weights[i32(1 + 2 * chunk)];
              chunkWeights[3] = weights[i32(17 + 2 * chunk)];
              let packedPositiveValue: u32 = 0;
              let packedNegativeValue: u32 = 0;
              for (let position: u32 = 0; position < 4; position++) {
                packedPositiveValue |= bestIqKIndex(3, shifted, inverseScale * sample[i32(position)]) << i32(4 * position);
                packedNegativeValue |= bestIqKIndex(3, shifted, -inverseScale * sample[i32(position)]) << i32(4 * position);
              }
              packedPositiveValue = pruneIq4Ks(packedPositiveValue, shifted, IQ4_K_VALUES_F32, sample, chunkWeights, 1.0 / inverseScale);
              packedNegativeValue = pruneIq4Ks(packedNegativeValue, shifted, IQ4_K_VALUES_F32, sample, chunkWeights, 1.0 / inverseScale);
              for (let position: u32 = 0; position < 4; position++) {
                const positiveIndex = (packedPositiveValue >> i32(4 * position)) & 15;
                const negativeIndex = (packedNegativeValue >> i32(4 * position)) & 15;
                const positiveQuant = iqKCodebookValue(3, shifted, positiveIndex);
                const negativeQuant = iqKCodebookValue(3, shifted, negativeIndex);
                const weight = chunkWeights[i32(position)];
                const value = sample[i32(position)];
                sumQxPositive += weight * positiveQuant * value;
                sumQ2Positive += weight * positiveQuant * positiveQuant;
                sumQxNegative += weight * negativeQuant * value;
                sumQ2Negative += weight * negativeQuant * negativeQuant;
              }
              if (mode == 0) {
                packedPositive[i32(chunk)] = packedPositiveValue;
                packedNegative[i32(chunk)] = packedNegativeValue;
              }
            }
            if (sumQ2Positive > 0.0 && sumQxPositive * sumQxPositive > best * sumQ2Positive) {
              groupScale = sumQxPositive / sumQ2Positive;
              best = sumQxPositive * groupScale;
            }
            if (sumQ2Negative > 0.0 && sumQxNegative * sumQxNegative > best * sumQ2Negative) {
              groupScale = sumQxNegative / sumQ2Negative;
              best = sumQxNegative * groupScale;
            }
          }
        }
        groupScales[i32(block * 8 + group)] = groupScale;
      }
    }

    let rowMaxAbsScale: f32 = 0.0;
    for (let index: u32 = 0; index < groupsPerRow; index++) {
      const magnitude = absF32(groupScales[i32(index)]);
      if (magnitude > rowMaxAbsScale) rowMaxAbsScale = magnitude;
    }
    const rowScale = rowMaxAbsScale / 127.0;
    store<f32>(rowDst, rowScale);
    if (rowScale == 0.0) continue;
    const inverseRowScale: f32 = 1.0 / rowScale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(4 + block * 128);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const scale = groupScales[i32(block * 8 + group)];
        let level = clampQuant(roundNearestEven(0.5 * (inverseRowScale * scale + 127.0)), 0, 127);
        level = (level << 1) - 127;
        const groupStart = blockStart + group * 32;
        const dl = rowScale * f32(level);
        const inverseGroupScale: f32 = dl != 0.0 ? 1.0 / dl : 0.0;
        let msePositive: f32 = 0.0;
        let mseShifted: f32 = 0.0;
        if (level == 0) {
          const signLevel = u32(level + 127);
          for (let chunk: u32 = 0; chunk < 8; chunk++) {
            store<u16>(blockDst + usize(group * 16 + 2 * chunk), u16((signLevel >> chunk) & 1));
          }
          continue;
        }
        for (let chunk: u32 = 0; chunk < 8; chunk++) {
          const chunkStart = groupStart + 2 * chunk;
          const values = new StaticArray<f32>(4);
          const localWeights = new StaticArray<f32>(4);
          values[0] = readF32(src, chunkStart);
          values[1] = readF32(src, groupStart + 16 + 2 * chunk);
          values[2] = readF32(src, chunkStart + 1);
          values[3] = readF32(src, groupStart + 17 + 2 * chunk);
          localWeights[0] = values[0] * values[0];
          localWeights[1] = values[1] * values[1];
          localWeights[2] = values[2] * values[2];
          localWeights[3] = values[3] * values[3];
          let packed: u32 = 0;
          let shiftedPacked: u32 = 0;
          for (let position: u32 = 0; position < 4; position++) {
            packed |= bestIqKIndex(3, false, inverseGroupScale * values[i32(position)]) << i32(4 * position);
            shiftedPacked |= bestIqKIndex(3, true, inverseGroupScale * values[i32(position)]) << i32(4 * position);
          }
          packed = pruneIq4Ks(packed, false, IQ4_K_VALUES_F32, values, localWeights, dl);
          shiftedPacked = pruneIq4Ks(shiftedPacked, true, IQ4_K_VALUES_F32, values, localWeights, dl);
          for (let position: u32 = 0; position < 4; position++) {
            const regularIndex = (packed >> i32(4 * position)) & 15;
            const shiftedIndex = (shiftedPacked >> i32(4 * position)) & 15;
            const regularValue = iqKCodebookValue(3, false, regularIndex) * dl;
            const shiftedValue = iqKCodebookValue(3, true, shiftedIndex) * dl;
            const differenceRegular = regularValue - values[i32(position)];
            const differenceShifted = shiftedValue - values[i32(position)];
            msePositive += localWeights[i32(position)] * differenceRegular * differenceRegular;
            mseShifted += localWeights[i32(position)] * differenceShifted * differenceShifted;
          }
          packedPositive[i32(chunk)] = packed;
          packedNegative[i32(chunk)] = shiftedPacked;
        }
        const useShifted = mseShifted < msePositive;
        const signLevel = u32(level + 127) | (useShifted ? 1 : 0);
        for (let chunk: u32 = 0; chunk < 8; chunk++) {
          const chunkStart = groupStart + 2 * chunk;
          sample[0] = readF32(src, chunkStart);
          sample[1] = readF32(src, groupStart + 16 + 2 * chunk);
          sample[2] = readF32(src, chunkStart + 1);
          sample[3] = readF32(src, groupStart + 17 + 2 * chunk);
          chunkWeights[0] = sample[0] * sample[0];
          chunkWeights[1] = sample[1] * sample[1];
          chunkWeights[2] = sample[2] * sample[2];
          chunkWeights[3] = sample[3] * sample[3];
          const selectedPacked = useShifted ? packedNegative[i32(chunk)] : packedPositive[i32(chunk)];
          const qsAddress = blockDst + usize(group * 16 + 2 * chunk);
          store<u16>(qsAddress, u16((scrambleIq4Ks(selectedPacked & 0x7fff) << 1) | ((signLevel >> chunk) & 1)));
          for (let position: u32 = 0; position < 4; position++) {
            const index = (selectedPacked >> i32(4 * position)) & 15;
            const quant = iqKCodebookValue(3, useShifted, index) * f32(level);
            sumQx += chunkWeights[i32(position)] * quant * sample[i32(position)];
            sumQ2 += chunkWeights[i32(position)] * quant * quant;
          }
        }
      }
    }
    store<f32>(rowDst, sumQ2 > 0.0 ? sumQx / sumQ2 : rowScale);
  }
}

export function dequantize_iq4_kss(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 128;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = load<f32>(rowSrc);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(4 + block * 128);
      for (let group: u32 = 0; group < 8; group++) {
        let scaleBits: u32 = 0;
        const aux = new StaticArray<u32>(8);
        for (let index: u32 = 0; index < 8; index++) {
          const packed = load<u16>(blockSrc + usize(group * 16 + index * 2));
          aux[i32(index)] = u32(packed & 0xfffe) ^ (u32(packed & 0xfffe) >> 1);
          scaleBits |= (u32(packed) & 1) << i32(index);
        }
        const shifted = (scaleBits & 1) != 0;
        const scale = d * f32(i32(scaleBits & 254) - 127);
        const outputStart = rowDst + block * 256 + group * 32;
        for (let lane: u32 = 0; lane < 16; lane++) {
          const packed = (lane & 1) == 0 ? aux[i32(lane / 2)] & 255 : aux[i32(lane / 2)] >> 8;
          writeF32(dst, outputStart + lane, scale * iqKCodebookValue(3, shifted, packed & 15));
          writeF32(dst, outputStart + 16 + lane, scale * iqKCodebookValue(3, shifted, packed >> 4));
        }
      }
    }
  }
}

const IQ2_K_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -31, -13, 1, 17, -26, -8, 6, 22,
]);

const IQ3_K_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -63, -40, -23, -10, 1, 13, 28, 47,
  -59, -36, -19, -6, 5, 17, 32, 51,
]);

const IQ4_K_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -127, -104, -83, -65, -49, -35, -22, -10, 1, 13, 25, 38, 53, 69, 89, 113,
  -123, -100, -79, -61, -45, -31, -18, -6, 5, 17, 29, 42, 57, 73, 93, 117,
]);

const IQ5_K_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -126, -114, -103, -92, -83, -74, -65, -57, -50, -43, -36, -30, -24, -18, -12, -6,
  -1, 5, 11, 17, 23, 29, 36, 43, 51, 59, 68, 77, 87, 97, 109, 121,
  -124, -112, -101, -90, -81, -72, -63, -55, -48, -41, -34, -28, -22, -16, -10, -4,
  1, 7, 13, 19, 25, 31, 38, 45, 53, 61, 70, 79, 89, 99, 111, 123,
]);

const IQ6_K_VALUES: StaticArray<i32> = StaticArray.fromArray<i32>([
  -127, -121, -115, -109, -104, -98, -93, -88, -84, -79, -74, -70, -66, -62, -58, -54,
  -51, -47, -44, -40, -37, -34, -31, -28, -25, -22, -19, -16, -13, -11, -8, -5,
  -2, 0, 3, 6, 9, 12, 14, 17, 20, 23, 27, 30, 33, 36, 40, 44,
  47, 51, 55, 59, 63, 68, 72, 77, 82, 87, 92, 98, 103, 109, 115, 121,
]);

function iqKCodebookValue(kind: u32, shifted: bool, index: u32): f32 {
  if (kind == 2) return f32(unchecked(IQ3_K_VALUES[i32(index + (shifted ? 8 : 0))]));
  if (kind == 3) return f32(unchecked(IQ4_K_VALUES[i32(index + (shifted ? 16 : 0))]));
  if (kind == 4) return f32(unchecked(IQ5_K_VALUES[i32(index + (shifted ? 32 : 0))]));
  return f32(unchecked(IQ6_K_VALUES[i32(index)])) + (shifted ? 1.0 : 0.0);
}

function bestIqKIndex(kind: u32, shifted: bool, value: f32): u32 {
  const count: u32 = u32(1) << i32(kind + 1);
  if (value <= iqKCodebookValue(kind, shifted, 0)) return 0;
  if (value >= iqKCodebookValue(kind, shifted, count - 1)) return count - 1;

  if (kind == 4) {
    let bestIndex: u32 = 0;
    let bestDifference = absF32(value - iqKCodebookValue(kind, shifted, 0));
    for (let index: u32 = 1; index < count; index++) {
      const difference = absF32(value - iqKCodebookValue(kind, shifted, index));
      if (difference < bestDifference) {
        bestDifference = difference;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  let lower: u32 = 0;
  let upper = count - 1;
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1;
    if (value < iqKCodebookValue(kind, shifted, middle)) upper = middle;
    else lower = middle;
  }
  return value - iqKCodebookValue(kind, shifted, lower) <
      iqKCodebookValue(kind, shifted, upper) - value ? lower : upper;
}

function makeIqKScaleQuants(
  values: StaticArray<f32>,
  weights: StaticArray<f32>,
  count: u32,
  maxLevel: i32,
): f32 {
  let maxValue: f32 = 0.0;
  let maxMagnitude: f32 = 0.0;
  for (let index: u32 = 0; index < count; index++) {
    const value = values[i32(index)];
    const magnitude = absF32(value);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      maxValue = value;
    }
  }
  if (maxMagnitude == 0.0) return 0.0;

  let inverseScale: f32 = f32(-maxLevel) / maxValue;
  let sumLx: f32 = 0.0;
  let sumL2: f32 = 0.0;
  for (let index: u32 = 0; index < count; index++) {
    const level = clampQuant(roundNearestEven(inverseScale * values[i32(index)]), -maxLevel, maxLevel - 1);
    const weight = weights[i32(index)];
    sumLx += weight * values[i32(index)] * f32(level);
    sumL2 += weight * f32(level * level);
  }
  let scale: f32 = sumL2 != 0.0 ? sumLx / sumL2 : 0.0;
  let best = scale * sumLx;

  for (let step: i32 = -9; step <= 9; step++) {
    if (step == 0) continue;
    inverseScale = -(f32(maxLevel) + 0.1 * f32(step)) / maxValue;
    sumLx = 0.0;
    sumL2 = 0.0;
    for (let index: u32 = 0; index < count; index++) {
      const level = clampQuant(roundNearestEven(inverseScale * values[i32(index)]), -maxLevel, maxLevel - 1);
      const weight = weights[i32(index)];
      sumLx += weight * values[i32(index)] * f32(level);
      sumL2 += weight * f32(level * level);
    }
    if (sumL2 > 0.0 && sumLx * sumLx > best * sumL2) {
      scale = sumLx / sumL2;
      best = scale * sumLx;
    }
  }
  return scale;
}

function iq2KValue(shifted: bool, index: u32): f32 {
  return f32(unchecked(IQ2_K_VALUES[i32(index + (shifted ? 4 : 0))]));
}

function bestIq2KIndex(shifted: bool, value: f32): u32 {
  let index: u32 = value < iq2KValue(shifted, 1) ? 0 : value > iq2KValue(shifted, 2) ? 2 : 1;
  return value - iq2KValue(shifted, index) < iq2KValue(shifted, index + 1) - value
    ? index
    : index + 1;
}

export function quantize_iq2_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const scales = new StaticArray<f32>(16);
  const weights = new StaticArray<f32>(16);
  const sumX = new StaticArray<f32>(17);
  const sumW = new StaticArray<f32>(17);
  const scaleWeights = new StaticArray<f32>(16);
  const order = new StaticArray<u32>(16);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 76);
    for (let byte: u32 = 0; byte < 76; byte++) store<u8>(blockDst + usize(byte), 0);

    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, srcStart + element);
      sumSquares += value * value;
    }
    const sigma2: f32 = 1.5 * sumSquares / 256.0;
    let extra: u32 = 0;
    let maxAbsScale: f32 = 0.0;

    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      let totalWeight: f32 = 0.0;
      let maxMagnitude: f32 = 0.0;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const weight: f32 = 0.25 * sigma2 + value * value;
        weights[i32(lane)] = weight;
        totalWeight += weight;
        order[i32(lane)] = lane;
        const magnitude = absF32(value);
        if (magnitude > maxMagnitude) maxMagnitude = magnitude;
      }
      scaleWeights[i32(group)] = totalWeight;
      if (maxMagnitude < 1.0e-16) {
        scales[i32(group)] = 0.0;
        continue;
      }

      for (let position: i32 = 1; position < 16; position++) {
        const selected = order[position];
        const selectedValue = readF32(src, groupStart + selected);
        let cursor = position - 1;
        while (cursor >= 0 && readF32(src, groupStart + order[cursor]) > selectedValue) {
          order[cursor + 1] = order[cursor];
          cursor--;
        }
        order[cursor + 1] = selected;
      }

      sumX[0] = 0.0;
      sumW[0] = 0.0;
      for (let position: u32 = 0; position < 16; position++) {
        const lane = order[i32(position)];
        sumW[i32(position + 1)] = sumW[i32(position)] + weights[i32(lane)];
        sumX[i32(position + 1)] = sumX[i32(position)] + weights[i32(lane)] * readF32(src, groupStart + lane);
      }

      let best: f32 = 0.0;
      let groupScale: f32 = 0.0;
      let bestShifted = false;
      for (let first: u32 = 0; first < 16; first++) {
        for (let second: u32 = first; second < 16; second++) {
          for (let third: u32 = second; third < 16; third++) {
            for (let candidate: u32 = 0; candidate < 4; candidate++) {
              const shifted = (candidate & 1) != 0;
              const reversed = candidate >= 2;
              let sumQx: f32 = 0.0;
              let sumQ2: f32 = 0.0;
              for (let segment: u32 = 0; segment < 4; segment++) {
                const start = segment == 0 ? 0 : segment == 1 ? first : segment == 2 ? second : third;
                const end = segment == 0 ? first : segment == 1 ? second : segment == 2 ? third : 16;
                const quant = iq2KValue(shifted, reversed ? 3 - segment : segment);
                const weightedX = sumX[i32(end)] - sumX[i32(start)];
                const segmentWeight = sumW[i32(end)] - sumW[i32(start)];
                sumQx += weightedX * quant;
                sumQ2 += segmentWeight * quant * quant;
              }
              if (sumQ2 > 0.0 && sumQx * sumQx > best * sumQ2) {
                groupScale = sumQx / sumQ2;
                best = groupScale * sumQx;
                bestShifted = shifted;
              }
            }
          }
        }
      }
      scales[i32(group)] = groupScale;
      if (bestShifted) extra |= u32(1) << i32(group);
      const absScale = absF32(groupScale);
      if (absScale > maxAbsScale) maxAbsScale = absScale;
    }

    if (maxAbsScale == 0.0) continue;
    const baseScale = makeIqKScaleQuants(scales, scaleWeights, 16, 8);
    if (baseScale == 0.0) continue;
    store<u16>(blockDst + 2, u16(extra));
    const inverseBaseScale: f32 = 1.0 / baseScale;
    let finalSumQx: f32 = 0.0;
    let finalSumQ2: f32 = 0.0;

    for (let group: u32 = 0; group < 16; group++) {
      const scaleLevel = clampQuant(roundNearestEven(inverseBaseScale * scales[i32(group)]), -8, 7);
      const scaleOffset = blockDst + usize(4 + group / 2);
      const scaleShift = i32(4 * (group & 1));
      store<u8>(scaleOffset, load<u8>(scaleOffset) | u8((scaleLevel + 8) << scaleShift));
      const groupScale = baseScale * f32(scaleLevel);
      if (groupScale == 0.0) continue;

      const shifted = (extra & (u32(1) << i32(group))) != 0;
      const groupStart = srcStart + group * 16;
      const inverseGroupScale: f32 = 1.0 / groupScale;
      const group32 = group / 2;
      const quantOffset = 12 + 32 * (group32 / 4) + 16 * (group & 1);
      const quantShift = i32(2 * (group32 & 3));
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const weight: f32 = 0.25 * sigma2 + value * value;
        const index = bestIq2KIndex(shifted, inverseGroupScale * value);
        const quantAddress = blockDst + usize(quantOffset + lane);
        store<u8>(quantAddress, load<u8>(quantAddress) | u8(index << quantShift));
        const quant = iq2KValue(shifted, index) * f32(scaleLevel);
        finalSumQx += weight * quant * value;
        finalSumQ2 += weight * quant * quant;
      }
    }
    store<u16>(blockDst, f32ToFp16(finalSumQ2 > 0.0 ? finalSumQx / finalSumQ2 : baseScale));
  }
}

export function dequantize_iq2_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 76);
    const d = fp16ToF32(load<u16>(blockSrc));
    const extra = u32(load<u16>(blockSrc + 2));
    for (let group32: u32 = 0; group32 < 8; group32++) {
      const scales = u32(load<u8>(blockSrc + usize(4 + group32)));
      const scale0 = d * f32(i32(scales & 15) - 8);
      const scale1 = d * f32(i32(scales >> 4) - 8);
      const shifted0 = (extra & (u32(1) << i32(2 * group32))) != 0;
      const shifted1 = (extra & (u32(1) << i32(2 * group32 + 1))) != 0;
      const quantOffset = 12 + 32 * (group32 / 4);
      const quantShift = i32(2 * (group32 & 3));
      const dstStart = block * 256 + group32 * 32;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const index0 = (u32(load<u8>(blockSrc + usize(quantOffset + lane))) >> quantShift) & 3;
        const index1 = (u32(load<u8>(blockSrc + usize(quantOffset + 16 + lane))) >> quantShift) & 3;
        writeF32(dst, dstStart + lane, scale0 * iq2KValue(shifted0, index0));
        writeF32(dst, dstStart + 16 + lane, scale1 * iq2KValue(shifted1, index1));
      }
    }
  }
}

function evaluateIqKScale(
  src: FloatPtr,
  srcStart: u32,
  kind: u32,
  shifted: bool,
  inverseScale: f32,
  weights: StaticArray<f32>,
  result: StaticArray<f32>,
): void {
  let sumQxPositive: f32 = 0.0;
  let sumQ2Positive: f32 = 0.0;
  let sumQxNegative: f32 = 0.0;
  let sumQ2Negative: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const weight = weights[i32(lane)];
    const normalized = inverseScale * value;
    let index = bestIqKIndex(kind, shifted, normalized);
    let quant = iqKCodebookValue(kind, shifted, index);
    sumQxPositive += weight * quant * value;
    sumQ2Positive += weight * quant * quant;
    index = bestIqKIndex(kind, shifted, -normalized);
    quant = iqKCodebookValue(kind, shifted, index);
    sumQxNegative += weight * quant * value;
    sumQ2Negative += weight * quant * quant;
  }
  result[0] = sumQxPositive;
  result[1] = sumQ2Positive;
  result[2] = sumQxNegative;
  result[3] = sumQ2Negative;
}

function quantizeIqKGroup(
  src: FloatPtr,
  srcStart: u32,
  kind: u32,
  tryCount: i32,
  tryStep: f32,
  weights: StaticArray<f32>,
  levels: StaticArray<u8>,
  fit: StaticArray<f32>,
  result: StaticArray<f32>,
): void {
  let maxValue: f32 = 0.0;
  let maxMagnitude: f32 = 0.0;
  for (let lane: u32 = 0; lane < 16; lane++) {
    const value = readF32(src, srcStart + lane);
    const magnitude = absF32(value);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      maxValue = value;
    }
  }
  if (maxMagnitude < 1.0e-16) {
    result[0] = 0.0;
    result[1] = 0.0;
    return;
  }

  const firstValue = iqKCodebookValue(kind, false, 0);
  evaluateIqKScale(src, srcStart, kind, false, -firstValue / maxValue, weights, fit);
  let scale: f32 = fit[0] / fit[1];
  let best = scale * fit[0];
  if (fit[3] > 0.0 && fit[2] * fit[2] > best * fit[3]) {
    scale = fit[2] / fit[3];
    best = scale * fit[2];
  }
  let bestShifted = false;

  for (let attempt: i32 = -tryCount; attempt <= tryCount; attempt++) {
    let inverseScale = (tryStep * f32(attempt) + firstValue) / maxValue;
    evaluateIqKScale(src, srcStart, kind, false, inverseScale, weights, fit);
    if (fit[1] > 0.0 && fit[0] * fit[0] > best * fit[1]) {
      scale = fit[0] / fit[1];
      best = scale * fit[0];
      bestShifted = false;
    }
    if (fit[3] > 0.0 && fit[2] * fit[2] > best * fit[3]) {
      scale = fit[2] / fit[3];
      best = scale * fit[2];
      bestShifted = false;
    }

    inverseScale = (tryStep * f32(attempt) + iqKCodebookValue(kind, true, 0)) / maxValue;
    evaluateIqKScale(src, srcStart, kind, true, inverseScale, weights, fit);
    if (fit[1] > 0.0 && fit[0] * fit[0] > best * fit[1]) {
      scale = fit[0] / fit[1];
      best = scale * fit[0];
      bestShifted = true;
    }
    if (fit[3] > 0.0 && fit[2] * fit[2] > best * fit[3]) {
      scale = fit[2] / fit[3];
      best = scale * fit[2];
      bestShifted = true;
    }
  }

  if (scale != 0.0) {
    const inverseScale: f32 = 1.0 / scale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let lane: u32 = 0; lane < 16; lane++) {
      const value = readF32(src, srcStart + lane);
      const index = bestIqKIndex(kind, bestShifted, inverseScale * value);
      levels[i32(lane)] = u8(index);
      const quant = iqKCodebookValue(kind, bestShifted, index);
      const weight = weights[i32(lane)];
      sumQx += weight * quant * value;
      sumQ2 += weight * quant * quant;
    }
    if (sumQ2 > 0.0) scale = sumQx / sumQ2;

    if (kind == 2) {
      for (let iteration: u32 = 0; iteration < 128; iteration++) {
        let maxGradient: f32 = 0.0;
        let bestLane: i32 = -1;
        let direction: i32 = 0;
        for (let lane: u32 = 0; lane < 16; lane++) {
          const level = u32(levels[i32(lane)]);
          const quant = iqKCodebookValue(kind, bestShifted, level);
          const value = readF32(src, srcStart + lane);
          const gradient = scale * weights[i32(lane)] * (value - scale * quant);
          if (gradient > 0.0 && level < 7) {
            if (gradient > maxGradient) {
              maxGradient = gradient;
              bestLane = i32(lane);
              direction = 1;
            }
          } else if (gradient < 0.0 && level > 0 && -gradient > maxGradient) {
            maxGradient = -gradient;
            bestLane = i32(lane);
            direction = -1;
          }
        }
        if (bestLane < 0) break;

        const oldLevel = u32(levels[bestLane]);
        const newLevel = u32(i32(oldLevel) + direction);
        const oldQuant = iqKCodebookValue(kind, bestShifted, oldLevel);
        const newQuant = iqKCodebookValue(kind, bestShifted, newLevel);
        const weight = weights[bestLane];
        const value = readF32(src, srcStart + u32(bestLane));
        sumQx += weight * value * (newQuant - oldQuant);
        sumQ2 += weight * (newQuant * newQuant - oldQuant * oldQuant);
        levels[bestLane] = u8(newLevel);
        if (sumQ2 > 0.0 && sumQx * sumQx > best * sumQ2) {
          scale = sumQx / sumQ2;
          best = scale * sumQx;
        } else if (iteration > 8) {
          break;
        }
      }
    }
  }

  result[0] = scale;
  result[1] = bestShifted ? 1.0 : 0.0;
}

export function quantize_iq3_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const groupScales = new StaticArray<f32>(16);
  const weights = new StaticArray<f32>(16);
  const levels = new StaticArray<u8>(16);
  const fit = new StaticArray<f32>(4);
  const result = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 110);
    for (let byte: u32 = 0; byte < 110; byte++) store<u8>(blockDst + usize(byte), 0);

    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, srcStart + element);
      sumSquares += value * value;
    }
    const sigma2: f32 = 1.5 * sumSquares / 256.0;
    let extra: u32 = 0;
    let maxAbsScale: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        weights[i32(lane)] = 0.25 * sigma2 + value * value;
      }
      quantizeIqKGroup(src, groupStart, 2, 3, 2.0, weights, levels, fit, result);
      const scale = result[0];
      groupScales[i32(group)] = scale;
      if (result[1] != 0.0) extra |= u32(1) << i32(group);
      const magnitude = absF32(scale);
      if (magnitude > maxAbsScale) maxAbsScale = magnitude;
    }
    if (maxAbsScale == 0.0) continue;

    const baseScale = maxAbsScale / 31.0;
    const inverseBaseScale: f32 = 1.0 / baseScale;
    store<u16>(blockDst + 2, u16(extra));
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const scale = groupScales[i32(group)];
      const scaleLevel = clampQuant(roundNearestEven(0.5 * (inverseBaseScale * absF32(scale) - 1.0)), 0, 15);
      const scaleAddress = blockDst + usize(6 + group / 2);
      const scaleShift = i32(4 * (group & 1));
      store<u8>(scaleAddress, load<u8>(scaleAddress) | u8(scaleLevel << scaleShift));
      if (scale < 0.0) store<u16>(blockDst + 4, load<u16>(blockDst + 4) | u16(u32(1) << i32(group)));
      const signedScaleLevel = (2 * scaleLevel + 1) * (scale < 0.0 ? -1 : 1);
      const groupScale = baseScale * f32(signedScaleLevel);
      if (groupScale == 0.0) continue;

      const groupStart = srcStart + group * 16;
      const shifted = (extra & (u32(1) << i32(group))) != 0;
      const inverseGroupScale: f32 = 1.0 / groupScale;
      const group32 = group / 2;
      const halfOffset = 16 * (group & 1);
      const quantOffset = 14 + 32 * (group32 / 4) + halfOffset;
      const highOffset = 78 + halfOffset;
      const quantShift = i32(2 * (group32 & 3));
      const highShift = i32(group32 & 7);
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const weight: f32 = 0.25 * sigma2 + value * value;
        const index = bestIqKIndex(2, shifted, inverseGroupScale * value);
        const quantAddress = blockDst + usize(quantOffset + lane);
        const highAddress = blockDst + usize(highOffset + lane);
        store<u8>(quantAddress, load<u8>(quantAddress) | u8((index & 3) << quantShift));
        store<u8>(highAddress, load<u8>(highAddress) | u8((index >> 2) << highShift));
        const quant = iqKCodebookValue(2, shifted, index) * f32(signedScaleLevel);
        sumQx += weight * quant * value;
        sumQ2 += weight * quant * quant;
      }
    }
    store<u16>(blockDst, f32ToFp16(sumQ2 > 0.0 ? sumQx / sumQ2 : baseScale));
  }
}

export function dequantize_iq3_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 110);
    const d = fp16ToF32(load<u16>(blockSrc));
    const extra = u32(load<u16>(blockSrc + 2));
    const scaleSigns = u32(load<u16>(blockSrc + 4));
    for (let group32: u32 = 0; group32 < 8; group32++) {
      const scales = u32(load<u8>(blockSrc + usize(6 + group32)));
      const scaleLevel0 = i32(scales & 15) * 2 + 1;
      const scaleLevel1 = i32(scales >> 4) * 2 + 1;
      const scale0 = d * f32(scaleLevel0) * ((scaleSigns & (u32(1) << i32(2 * group32))) != 0 ? -1.0 : 1.0);
      const scale1 = d * f32(scaleLevel1) * ((scaleSigns & (u32(1) << i32(2 * group32 + 1))) != 0 ? -1.0 : 1.0);
      const shifted0 = (extra & (u32(1) << i32(2 * group32))) != 0;
      const shifted1 = (extra & (u32(1) << i32(2 * group32 + 1))) != 0;
      const quantOffset = 14 + 32 * (group32 / 4);
      const quantShift = i32(2 * (group32 & 3));
      const highShift = i32(group32 & 7);
      const dstStart = block * 256 + group32 * 32;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const low0 = (u32(load<u8>(blockSrc + usize(quantOffset + lane))) >> quantShift) & 3;
        const low1 = (u32(load<u8>(blockSrc + usize(quantOffset + 16 + lane))) >> quantShift) & 3;
        const high0 = ((u32(load<u8>(blockSrc + usize(78 + lane))) >> highShift) & 1) << 2;
        const high1 = ((u32(load<u8>(blockSrc + usize(94 + lane))) >> highShift) & 1) << 2;
        writeF32(dst, dstStart + lane, scale0 * iqKCodebookValue(2, shifted0, low0 | high0));
        writeF32(dst, dstStart + 16 + lane, scale1 * iqKCodebookValue(2, shifted1, low1 | high1));
      }
    }
  }
}

export function quantize_iq4_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const groupScales = new StaticArray<f32>(16);
  const weights = new StaticArray<f32>(16);
  const levels = new StaticArray<u8>(16);
  const allLevels = new StaticArray<u8>(256);
  const fit = new StaticArray<f32>(4);
  const result = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 144);
    for (let byte: u32 = 0; byte < 144; byte++) store<u8>(blockDst + usize(byte), 0);
    let extra: u32 = 0;
    let maxScale: f32 = 0.0;
    let maxAbsScale: f32 = 0.0;

    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        weights[i32(lane)] = value * value;
      }
      quantizeIqKGroup(src, groupStart, 3, 7, 1.0, weights, levels, fit, result);
      const scale = result[0];
      groupScales[i32(group)] = scale;
      if (result[1] != 0.0) extra |= u32(1) << i32(group);
      const magnitude = absF32(scale);
      if (magnitude > maxAbsScale) {
        maxAbsScale = magnitude;
        maxScale = scale;
      }
    }

    const baseScale = -maxScale / 32.0;
    store<u16>(blockDst, f32ToFp16(baseScale));
    store<u16>(blockDst + 2, u16(extra));
    const inverseBaseScale: f32 = baseScale != 0.0 ? 1.0 / baseScale : 0.0;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const shifted = (extra & (u32(1) << i32(group))) != 0;
      const scaleLevel = clampQuant(roundNearestEven(inverseBaseScale * groupScales[i32(group)]), -32, 31);
      const groupScale = baseScale * f32(scaleLevel);
      const inverseGroupScale: f32 = groupScale != 0.0 ? 1.0 / groupScale : 0.0;
      const storedScale = u32(scaleLevel + 32);
      const lowAddress = blockDst + usize(8 + group / 2);
      const lowShift = i32(4 * (group & 1));
      store<u8>(lowAddress, load<u8>(lowAddress) | u8((storedScale & 15) << lowShift));
      const highAddress = blockDst + usize(4 + 2 * (group / 8));
      store<u16>(highAddress, load<u16>(highAddress) | u16((storedScale >> 4) << i32(2 * (group & 7))));

      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const index = bestIqKIndex(3, shifted, inverseGroupScale * value);
        allLevels[i32(group * 16 + lane)] = u8(index);
        const weight = value * value;
        const quant = iqKCodebookValue(3, shifted, index) * f32(scaleLevel);
        sumQx += weight * quant * value;
        sumQ2 += weight * quant * quant;
      }
    }
    if (sumQ2 > 0.0) store<u16>(blockDst, f32ToFp16(sumQx / sumQ2));
    for (let group32: u32 = 0; group32 < 8; group32++) {
      for (let lane: u32 = 0; lane < 16; lane++) {
        const low = u32(allLevels[i32(group32 * 32 + lane)]);
        const high = u32(allLevels[i32(group32 * 32 + 16 + lane)]);
        store<u8>(blockDst + usize(16 + group32 * 16 + lane), u8(low | (high << 4)));
      }
    }
  }
}

export function dequantize_iq4_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 144);
    const d = fp16ToF32(load<u16>(blockSrc));
    const extra = u32(load<u16>(blockSrc + 2));
    for (let group32: u32 = 0; group32 < 8; group32++) {
      const high = u32(load<u8>(blockSrc + usize(4 + group32 / 2))) >> i32(4 * (group32 & 1));
      const low = u32(load<u8>(blockSrc + usize(8 + group32)));
      const scale0 = d * f32(i32((low & 15) | ((high << 4) & 0x30)) - 32);
      const scale1 = d * f32(i32((low >> 4) | ((high << 2) & 0x30)) - 32);
      const shifted0 = (extra & (u32(1) << i32(2 * group32))) != 0;
      const shifted1 = (extra & (u32(1) << i32(2 * group32 + 1))) != 0;
      const quantOffset = 16 + group32 * 16;
      const dstStart = block * 256 + group32 * 32;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const packed = u32(load<u8>(blockSrc + usize(quantOffset + lane)));
        writeF32(dst, dstStart + lane, scale0 * iqKCodebookValue(3, shifted0, packed & 15));
        writeF32(dst, dstStart + 16 + lane, scale1 * iqKCodebookValue(3, shifted1, packed >> 4));
      }
    }
  }
}

export function quantize_iq5_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const groupScales = new StaticArray<f32>(16);
  const weights = new StaticArray<f32>(16);
  const levels = new StaticArray<u8>(16);
  const fit = new StaticArray<f32>(4);
  const result = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 176);
    for (let byte: u32 = 0; byte < 176; byte++) store<u8>(blockDst + usize(byte), 0);
    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, srcStart + element);
      sumSquares += value * value;
    }
    const sigma2: f32 = 2.0 * sumSquares / 256.0;
    let extra: u32 = 0;
    let maxScale: f32 = 0.0;
    let maxAbsScale: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        weights[i32(lane)] = 0.25 * sigma2 + value * value;
      }
      quantizeIqKGroup(src, groupStart, 4, 5, 1.0, weights, levels, fit, result);
      const scale = result[0];
      groupScales[i32(group)] = scale;
      if (result[1] != 0.0) extra |= u32(1) << i32(group);
      const magnitude = absF32(scale);
      if (magnitude > maxAbsScale) {
        maxAbsScale = magnitude;
        maxScale = scale;
      }
    }
    if (maxAbsScale < 1.0e-30) continue;

    const baseScale = -maxScale / 32.0;
    store<u16>(blockDst, f32ToFp16(baseScale));
    store<u16>(blockDst + 2, u16(extra));
    const inverseBaseScale: f32 = 1.0 / baseScale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const scaleLevel = clampQuant(roundNearestEven(inverseBaseScale * groupScales[i32(group)]), -32, 31);
      const storedScale = u32(scaleLevel + 32);
      const lowAddress = blockDst + usize(8 + group / 2);
      store<u8>(lowAddress, load<u8>(lowAddress) | u8((storedScale & 15) << i32(4 * (group & 1))));
      const highAddress = blockDst + usize(4 + group / 4);
      store<u8>(highAddress, load<u8>(highAddress) | u8((storedScale >> 4) << i32(2 * (group & 3))));
      const groupScale = baseScale * f32(scaleLevel);
      if (groupScale == 0.0) continue;

      const groupStart = srcStart + group * 16;
      const shifted = (extra & (u32(1) << i32(group))) != 0;
      const inverseGroupScale: f32 = 1.0 / groupScale;
      const group32 = group / 2;
      const halfOffset = 16 * (group & 1);
      const quantOffset = 16 + 32 * (group32 / 2) + halfOffset;
      const highOffset = 144 + halfOffset;
      const quantShift = i32(4 * (group32 & 1));
      const highShift = i32(group32 & 7);
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const weight: f32 = 0.25 * sigma2 + value * value;
        const index = bestIqKIndex(4, shifted, inverseGroupScale * value);
        const quantAddress = blockDst + usize(quantOffset + lane);
        const highAddress = blockDst + usize(highOffset + lane);
        store<u8>(quantAddress, load<u8>(quantAddress) | u8((index & 15) << quantShift));
        store<u8>(highAddress, load<u8>(highAddress) | u8((index >> 4) << highShift));
        const quant = iqKCodebookValue(4, shifted, index) * f32(scaleLevel);
        sumQx += weight * quant * value;
        sumQ2 += weight * quant * quant;
      }
    }
    if (sumQ2 > 0.0) store<u16>(blockDst, f32ToFp16(sumQx / sumQ2));
  }
}

export function dequantize_iq5_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 176);
    const d = fp16ToF32(load<u16>(blockSrc));
    let extra = u32(load<u16>(blockSrc + 2));
    for (let group64: u32 = 0; group64 < 4; group64++) {
      const scales0 = u32(load<u8>(blockSrc + usize(8 + 2 * group64)));
      const scales1 = u32(load<u8>(blockSrc + usize(9 + 2 * group64)));
      const scalesHigh = u32(load<u8>(blockSrc + usize(4 + group64)));
      const scale0 = d * f32(i32((scales0 & 15) | ((scalesHigh << 4) & 0x30)) - 32);
      const scale1 = d * f32(i32((scales0 >> 4) | ((scalesHigh << 2) & 0x30)) - 32);
      const scale2 = d * f32(i32((scales1 & 15) | (scalesHigh & 0x30)) - 32);
      const scale3 = d * f32(i32((scales1 >> 4) | ((scalesHigh >> 2) & 0x30)) - 32);
      const quantOffset = 16 + group64 * 32;
      const highShift = i32(2 * group64);
      const dstStart = block * 256 + group64 * 64;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const packed0 = u32(load<u8>(blockSrc + usize(quantOffset + lane)));
        const packed1 = u32(load<u8>(blockSrc + usize(quantOffset + 16 + lane)));
        const high0 = u32(load<u8>(blockSrc + usize(144 + lane))) >> highShift;
        const high1 = u32(load<u8>(blockSrc + usize(160 + lane))) >> highShift;
        const index0 = (packed0 & 15) | ((high0 & 1) << 4);
        const index1 = (packed1 & 15) | ((high1 & 1) << 4);
        const index2 = (packed0 >> 4) | ((high0 & 2) << 3);
        const index3 = (packed1 >> 4) | ((high1 & 2) << 3);
        writeF32(dst, dstStart + lane, scale0 * iqKCodebookValue(4, (extra & 1) != 0, index0));
        writeF32(dst, dstStart + 16 + lane, scale1 * iqKCodebookValue(4, (extra & 2) != 0, index1));
        writeF32(dst, dstStart + 32 + lane, scale2 * iqKCodebookValue(4, (extra & 4) != 0, index2));
        writeF32(dst, dstStart + 48 + lane, scale3 * iqKCodebookValue(4, (extra & 8) != 0, index3));
      }
      extra >>= 4;
    }
  }
}

export function quantize_iq6_k(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  const groupScales = new StaticArray<f32>(16);
  const weights = new StaticArray<f32>(16);
  const levels = new StaticArray<u8>(16);
  const fit = new StaticArray<f32>(4);
  const result = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < k / 256; block++) {
    const srcStart = block * 256;
    const blockDst = dst + usize(block * 212);
    for (let byte: u32 = 0; byte < 212; byte++) store<u8>(blockDst + usize(byte), 0);
    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, srcStart + element);
      sumSquares += value * value;
    }
    const sigma2: f32 = 2.0 * sumSquares / 256.0;
    let extra: u32 = 0;
    let maxScale: f32 = 0.0;
    let maxAbsScale: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const groupStart = srcStart + group * 16;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        weights[i32(lane)] = 0.25 * sigma2 + value * value;
      }
      quantizeIqKGroup(src, groupStart, 5, 5, 1.0, weights, levels, fit, result);
      const scale = result[0];
      groupScales[i32(group)] = scale;
      if (result[1] != 0.0) extra |= u32(1) << i32(group);
      const magnitude = absF32(scale);
      if (magnitude > maxAbsScale) {
        maxAbsScale = magnitude;
        maxScale = scale;
      }
    }
    if (maxAbsScale < 1.0e-30) continue;

    const baseScale = -maxScale / 127.0;
    store<u16>(blockDst, f32ToFp16(baseScale));
    store<u16>(blockDst + 2, u16(extra));
    const inverseBaseScale: f32 = 1.0 / baseScale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let group: u32 = 0; group < 16; group++) {
      const scaleLevel = clampQuant(roundNearestEven(inverseBaseScale * groupScales[i32(group)]), -127, 127);
      store<i8>(blockDst + usize(4 + group), i8(scaleLevel));
      const groupScale = baseScale * f32(scaleLevel);
      if (groupScale == 0.0) continue;

      const groupStart = srcStart + group * 16;
      const shifted = (extra & (u32(1) << i32(group))) != 0;
      const inverseGroupScale: f32 = 1.0 / groupScale;
      const group32 = group / 2;
      const halfOffset = 16 * (group & 1);
      const quantOffset = 20 + 32 * (group32 / 2) + halfOffset;
      const highOffset = 148 + 32 * (group32 / 4) + halfOffset;
      const quantShift = i32(4 * (group32 & 1));
      const highShift = i32(2 * (group32 & 3));
      for (let lane: u32 = 0; lane < 16; lane++) {
        const value = readF32(src, groupStart + lane);
        const weight: f32 = 0.25 * sigma2 + value * value;
        const index = bestIqKIndex(5, shifted, inverseGroupScale * value);
        const quantAddress = blockDst + usize(quantOffset + lane);
        const highAddress = blockDst + usize(highOffset + lane);
        store<u8>(quantAddress, load<u8>(quantAddress) | u8((index & 15) << quantShift));
        store<u8>(highAddress, load<u8>(highAddress) | u8((index >> 4) << highShift));
        const quant = iqKCodebookValue(5, shifted, index) * f32(scaleLevel);
        sumQx += weight * quant * value;
        sumQ2 += weight * quant * quant;
      }
    }
    if (sumQ2 > 0.0) store<u16>(blockDst, f32ToFp16(sumQx / sumQ2));
  }
}

export function dequantize_iq6_k(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const k = rowElementCount(nrows, n_per_row, 256);
  for (let block: u32 = 0; block < k / 256; block++) {
    const blockSrc = src + usize(block * 212);
    const d = fp16ToF32(load<u16>(blockSrc));
    let extra = u32(load<u16>(blockSrc + 2));
    for (let group64: u32 = 0; group64 < 4; group64++) {
      const scale0 = d * f32(load<i8>(blockSrc + usize(4 + 4 * group64)));
      const scale1 = d * f32(load<i8>(blockSrc + usize(5 + 4 * group64)));
      const scale2 = d * f32(load<i8>(blockSrc + usize(6 + 4 * group64)));
      const scale3 = d * f32(load<i8>(blockSrc + usize(7 + 4 * group64)));
      const quantOffset = 20 + group64 * 32;
      const highOffset = 148 + 32 * (group64 / 2);
      const highShift = i32(4 * (group64 & 1));
      const dstStart = block * 256 + group64 * 64;
      const shift0: f32 = (extra & 1) != 0 ? 1.0 : 0.0;
      const shift1: f32 = (extra & 2) != 0 ? 1.0 : 0.0;
      const shift2: f32 = (extra & 4) != 0 ? 1.0 : 0.0;
      const shift3: f32 = (extra & 8) != 0 ? 1.0 : 0.0;
      for (let lane: u32 = 0; lane < 16; lane++) {
        const packed0 = u32(load<u8>(blockSrc + usize(quantOffset + lane)));
        const packed1 = u32(load<u8>(blockSrc + usize(quantOffset + 16 + lane)));
        const high0 = u32(load<u8>(blockSrc + usize(highOffset + lane))) >> highShift;
        const high1 = u32(load<u8>(blockSrc + usize(highOffset + 16 + lane))) >> highShift;
        const q0 = f32((packed0 & 15) | ((high0 & 3) << 4));
        const q1 = f32((packed1 & 15) | ((high1 & 3) << 4));
        const q2 = f32((packed0 >> 4) | ((high0 & 12) << 2));
        const q3 = f32((packed1 >> 4) | ((high1 & 12) << 2));
        const value0: f32 = -127.0 + q0 * (6.2568 + q0 * (-0.11218 + q0 * 0.0011972)) + shift0;
        const value1: f32 = -127.0 + q1 * (6.2568 + q1 * (-0.11218 + q1 * 0.0011972)) + shift1;
        const value2: f32 = -127.0 + q2 * (6.2568 + q2 * (-0.11218 + q2 * 0.0011972)) + shift2;
        const value3: f32 = -127.0 + q3 * (6.2568 + q3 * (-0.11218 + q3 * 0.0011972)) + shift3;
        writeF32(dst, dstStart + lane, scale0 * value0);
        writeF32(dst, dstStart + 16 + lane, scale1 * value1);
        writeF32(dst, dstStart + 32 + lane, scale2 * value2);
        writeF32(dst, dstStart + 48 + lane, scale3 * value3);
      }
      extra >>= 4;
    }
  }
}

const IQ2_KL_INDEX: StaticArray<i32> = StaticArray.fromArray<i32>([
  -1, -2, 0, -3, -4, 1, -5, -6, 2, -7, -8, 3, -9, 4, -10, 5,
  -11, 6, 7, -12, 8, 9, 10, -13, 11, -14, -15, -16, 12, 13, -17, 14,
  -18, -19, 15, 16, 17, 18, 19, -20, -21, 20, 21, 22, 23, 24, -22, -23,
  25, -24, 26, -25, 27, -26, 28, 29, -27, -28, 30, -29, -30, 31, -31, -32,
]);

const IQ2_KL_NEIGHBORS: StaticArray<i32> = StaticArray.fromArray<i32>([
  2, 0, 6, 11, 7, 3, 8, 15,
  0, 2, 3, 6, 7, 1, 8, 4,
  0, 1, 3, 4, 8, 7, 9, 6,
  1, 0, 3, 4, 8, 9, 7, 10,
  1, 4, 5, 10, 9, 3, 8, 0,
  5, 1, 4, 10, 9, 14, 8, 3,
  6, 2, 7, 0, 3, 11, 8, 15,
  3, 7, 0, 6, 8, 4, 12, 9,
  3, 4, 8, 9, 1, 7, 12, 10,
  4, 10, 5, 9, 1, 8, 13, 14,
  11, 2, 6, 7, 20, 15, 25, 21,
  8, 7, 3, 12, 9, 16, 17, 13,
  14, 5, 10, 19, 9, 13, 4, 18,
  6, 15, 7, 11, 20, 21, 16, 2,
  15, 7, 16, 6, 21, 12, 17, 22,
  12, 16, 17, 8, 15, 7, 13, 22,
  19, 10, 13, 18, 14, 9, 12, 24,
  11, 20, 25, 6, 15, 2, 21, 7,
  20, 15, 21, 6, 11, 7, 16, 26,
  14, 19, 29, 10, 28, 18, 13, 24,
  25, 11, 20, 21, 15, 6, 26, 30,
  19, 24, 28, 18, 29, 23, 13, 17,
  29, 19, 14, 28, 24, 18, 10, 13,
  20, 26, 21, 25, 30, 15, 22, 16,
  27, 26, 22, 23, 21, 30, 16, 24,
  27, 24, 28, 31, 23, 18, 22, 17,
  25, 30, 20, 26, 21, 11, 15, 22,
  30, 26, 25, 20, 21, 27, 22, 15,
  30, 27, 31, 26, 22, 23, 21, 24,
  31, 27, 30, 26, 28, 23, 22, 24,
  31, 28, 29, 27, 24, 23, 19, 18,
  29, 28, 31, 24, 19, 27, 14, 18,
]);

const IQ2_KL_VALUES: StaticArray<u16> = StaticArray.fromArray<u16>([
  0xe9c1, 0x0dc1, 0xc1d8, 0xf6d8, 0x0dd8, 0x2fd8, 0xd8e9, 0xe9e9,
  0x01e9, 0x0de9, 0x1ce9, 0xc1f6, 0x01f6, 0x0df6, 0x2ff6, 0xe901,
  0xf601, 0x0101, 0x0d01, 0x1c01, 0xd80d, 0xe90d, 0xf60d, 0x010d,
  0x0d0d, 0xc11c, 0xe91c, 0x011c, 0x1c1c, 0x2f1c, 0xe92f, 0x0d2f,
]);

function iq2KlGridValue(index: u32, lane: u32): f32 {
  const packed = unchecked(IQ2_KL_VALUES[i32(index)]);
  const byteValue = lane == 0 ? u32(packed & 0xff) : u32(packed >> 8);
  return f32(i32(i8(byteValue)));
}

function iq2KlIndex(id: f32, value0: f32, value1: f32, weight0: f32, weight1: f32): u32 {
  const level0 = bestIqKIndex(2, false, id * value0);
  const level1 = bestIqKIndex(2, false, id * value1);
  const mapped = unchecked(IQ2_KL_INDEX[i32(8 * level0 + level1)]);
  if (mapped >= 0) return u32(mapped);
  const neighborGroup = u32(-mapped - 1);
  let bestIndex: u32 = 0;
  let bestScore: f32 = 3.4028235e38;
  for (let candidate: u32 = 0; candidate < 8; candidate++) {
    const index = u32(unchecked(IQ2_KL_NEIGHBORS[i32(neighborGroup * 8 + candidate)]));
    const difference0 = iq2KlGridValue(index, 0) - id * value0;
    const difference1 = iq2KlGridValue(index, 1) - id * value1;
    const score = weight0 * difference0 * difference0 + weight1 * difference1 * difference1;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function quantize_iq2_kl(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const groupsPerRow = n_per_row / 32;
  const rowSize = 2 + blocksPerRow * 86;
  const groupScales = new StaticArray<f32>(groupsPerRow);
  const weights = new StaticArray<f32>(32);

  for (let row: u32 = 0; row < nrows; row++) {
    const srcRow = row * n_per_row;
    const rowDst = dst + usize(row * rowSize);
    store<u16>(rowDst, 0);
    let rowMaxScale: f32 = 0.0;
    let rowMaxAbsScale: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 86);
      for (let byte: u32 = 0; byte < 86; byte++) store<u8>(blockDst + usize(byte), 0);
      const blockStart = srcRow + block * 256;
      let sumSquares: f32 = 0.0;
      for (let element: u32 = 0; element < 256; element++) {
        const value = readF32(src, blockStart + element);
        sumSquares += value * value;
      }
      const sigma2: f32 = 2.25 * sumSquares / 256.0;
      for (let group: u32 = 0; group < 8; group++) {
        const groupStart = blockStart + group * 32;
        let maxValue: f32 = 0.0;
        let maxMagnitude: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const value = readF32(src, groupStart + lane);
          weights[i32(lane)] = absF32(value);
          const magnitude = absF32(value);
          if (magnitude > maxMagnitude) {
            maxMagnitude = magnitude;
            maxValue = value;
          }
        }
        if (maxMagnitude < 1.0e-16) {
          groupScales[i32(block * 8 + group)] = 0.0;
          continue;
        }
        let scale = -maxValue / f32(unchecked(IQ3_K_VALUES[0]));
        let best: f32 = 0.0;
        for (let attempt: i32 = -5; attempt <= 5; attempt++) {
          const inverseScale = (f32(attempt) + f32(unchecked(IQ3_K_VALUES[0]))) / maxValue;
          let sumQxPositive: f32 = 0.0;
          let sumQ2Positive: f32 = 0.0;
          let sumQxNegative: f32 = 0.0;
          let sumQ2Negative: f32 = 0.0;
          for (let pair: u32 = 0; pair < 16; pair++) {
            const value0 = readF32(src, groupStart + 2 * pair);
            const value1 = readF32(src, groupStart + 2 * pair + 1);
            const weight0 = weights[i32(2 * pair)];
            const weight1 = weights[i32(2 * pair + 1)];
            const index0 = iq2KlIndex(inverseScale, value0, value1, weight0, weight1);
            const index1 = iq2KlIndex(-inverseScale, value0, value1, weight0, weight1);
            const q00 = iq2KlGridValue(index0, 0);
            const q01 = iq2KlGridValue(index0, 1);
            const q10 = iq2KlGridValue(index1, 0);
            const q11 = iq2KlGridValue(index1, 1);
            sumQxPositive += weight0 * q00 * value0 + weight1 * q01 * value1;
            sumQ2Positive += weight0 * q00 * q00 + weight1 * q01 * q01;
            sumQxNegative += weight0 * q10 * value0 + weight1 * q11 * value1;
            sumQ2Negative += weight0 * q10 * q10 + weight1 * q11 * q11;
          }
          if (sumQ2Positive > 0.0 && sumQxPositive * sumQxPositive > best * sumQ2Positive) {
            scale = sumQxPositive / sumQ2Positive;
            best = scale * sumQxPositive;
          }
          if (sumQ2Negative > 0.0 && sumQxNegative * sumQxNegative > best * sumQ2Negative) {
            scale = sumQxNegative / sumQ2Negative;
            best = scale * sumQxNegative;
          }
        }
        groupScales[i32(block * 8 + group)] = scale;
        const magnitude = absF32(scale);
        if (magnitude > rowMaxAbsScale) {
          rowMaxAbsScale = magnitude;
          rowMaxScale = scale;
        }
      }
    }
    if (rowMaxAbsScale == 0.0) continue;

    const rowScale: f32 = -rowMaxScale / 32.0;
    const inverseRowScale: f32 = f32(1.0) / rowScale;
    let sumQx: f32 = 0.0;
    let sumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockDst = rowDst + usize(2 + block * 86);
      const blockStart = srcRow + block * 256;
      for (let group: u32 = 0; group < 8; group++) {
        const scale = groupScales[i32(block * 8 + group)];
        let level = clampQuant(roundNearestEven(inverseRowScale * scale), -32, 31);
        const storedLevel = u32(level + 32);
        store<u8>(blockDst + usize(2 + (group & 3)),
          load<u8>(blockDst + usize(2 + (group & 3))) | u8((storedLevel & 15) << i32(4 * (group / 4))));
        store<u16>(blockDst, load<u16>(blockDst) | u16((storedLevel >> 4) << i32(2 * group)));
        if (level == 0) continue;
        const groupScale = rowScale * f32(level);
        const inverseGroupScale: f32 = f32(1.0) / groupScale;
        const groupStart = blockStart + group * 32;
        for (let pair: u32 = 0; pair < 16; pair++) {
          const value0 = readF32(src, groupStart + 2 * pair);
          const value1 = readF32(src, groupStart + 2 * pair + 1);
          const weight0 = absF32(value0);
          const weight1 = absF32(value1);
          const index = iq2KlIndex(inverseGroupScale, value0, value1, weight0, weight1);
          const qsAddress = blockDst + usize(6 + 16 * (group / 2) + pair);
          store<u8>(qsAddress, load<u8>(qsAddress) | u8((index & 15) << i32(4 * (group & 1))));
          store<u8>(blockDst + usize(70 + pair), load<u8>(blockDst + usize(70 + pair)) | u8((index >> 4) << i32(group)));
          const quant0 = f32(level) * iq2KlGridValue(index, 0);
          const quant1 = f32(level) * iq2KlGridValue(index, 1);
          sumQx += weight0 * quant0 * value0 + weight1 * quant1 * value1;
          sumQ2 += weight0 * quant0 * quant0 + weight1 * quant1 * quant1;
        }
      }
    }
    store<u16>(rowDst, f32ToFp16(f32(sumQ2 > 0.0 ? sumQx / sumQ2 : rowScale)));
  }
}

export function dequantize_iq2_kl(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  const blocksPerRow = n_per_row / 256;
  const rowSize = 2 + blocksPerRow * 86;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const rowDst = row * n_per_row;
    const d = fp16ToF32(load<u16>(rowSrc));
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSrc = rowSrc + usize(2 + block * 86);
      const scalesHigh = load<u16>(blockSrc);
      for (let half: u32 = 0; half < 4; half++) {
        const nibbleShift = i32(4 * (half / 2));
        const scaleByte0 = u32(load<u8>(blockSrc + usize(2 + (2 * half) % 4)));
        const scaleByte1 = u32(load<u8>(blockSrc + usize(2 + (2 * half + 1) % 4)));
        const level0 = i32((scaleByte0 >> nibbleShift) & 15) | (i32((u32(scalesHigh) >> i32(4 * half)) & 3) << 4);
        const level1 = i32((scaleByte1 >> nibbleShift) & 15) | (i32((u32(scalesHigh) >> i32(4 * half + 2)) & 3) << 4);
        const scale0 = d * f32(level0 - 32);
        const scale1 = d * f32(level1 - 32);
        const quantOffset = 6 + half * 16;
        const highShift0 = i32(2 * half);
        const highShift1 = i32(2 * half + 1);
        const outputStart = rowDst + block * 256 + half * 64;
        for (let pair: u32 = 0; pair < 16; pair++) {
          const packed = u32(load<u8>(blockSrc + usize(quantOffset + pair)));
          const high = u32(load<u8>(blockSrc + usize(70 + pair)));
          const index0 = (packed & 15) | (((high >> highShift0) & 1) << 4);
          const index1 = (packed >> 4) | (((high >> highShift1) & 1) << 4);
          writeF32(dst, outputStart + 2 * pair, scale0 * iq2KlGridValue(index0, 0));
          writeF32(dst, outputStart + 2 * pair + 1, scale0 * iq2KlGridValue(index0, 1));
          writeF32(dst, outputStart + 32 + 2 * pair, scale1 * iq2KlGridValue(index1, 0));
          writeF32(dst, outputStart + 32 + 2 * pair + 1, scale1 * iq2KlGridValue(index1, 1));
        }
      }
    }
  }
}

const KT_IQ1_VALUE_COUNT: u32 = 8192;
const KT_IQ2_VALUE_COUNT: u32 = 65536;
const KT_IQ3_VALUE_COUNT: u32 = 65536;
const KT_IQ4_VALUE_COUNT: u32 = 32768;
const KT_IQ1_CLUSTER_COUNT: u32 = 256;
const KT_IQ2_CLUSTER_COUNT: u32 = 256;
const KT_IQ3_CLUSTER_COUNT: u32 = 256;
const KT_IQ4_CLUSTER_COUNT: u32 = 625;
const KT_IQ1_NEIGHBOURS: u32 = 32;
const KT_IQ2_NEIGHBOURS: u32 = 8;
const KT_IQ3_NEIGHBOURS: u32 = 8;
const KT_IQ4_NEIGHBOURS: u32 = 6;

const KT_IQ1_VALUES: StaticArray<f32> = new StaticArray<f32>(KT_IQ1_VALUE_COUNT * 8);
const KT_IQ2_VALUES: StaticArray<f32> = new StaticArray<f32>(KT_IQ2_VALUE_COUNT * 8);
const KT_IQ3_VALUES: StaticArray<f32> = new StaticArray<f32>(KT_IQ3_VALUE_COUNT * 8);
const KT_IQ4_VALUES: StaticArray<f32> = new StaticArray<f32>(KT_IQ4_VALUE_COUNT * 4);
const KT_IQ4_OFFSET_VALUES: StaticArray<f32> = new StaticArray<f32>(KT_IQ4_VALUE_COUNT * 4);

const KT_IQ1_MID: StaticArray<f32> = new StaticArray<f32>(8);
const KT_IQ2_MID: StaticArray<f32> = new StaticArray<f32>(8);
const KT_IQ3_MID: StaticArray<f32> = new StaticArray<f32>(8);
const KT_IQ4_MID: StaticArray<f32> = new StaticArray<f32>(4);
const KT_IQ4_OFFSET_MID: StaticArray<f32> = new StaticArray<f32>(4);

const KT_IQ1_CENTERS: StaticArray<f32> = new StaticArray<f32>(KT_IQ1_CLUSTER_COUNT * 8);
const KT_IQ2_CENTERS: StaticArray<f32> = new StaticArray<f32>(KT_IQ2_CLUSTER_COUNT * 8);
const KT_IQ3_CENTERS: StaticArray<f32> = new StaticArray<f32>(KT_IQ3_CLUSTER_COUNT * 8);
const KT_IQ4_CENTERS: StaticArray<f32> = new StaticArray<f32>(KT_IQ4_CLUSTER_COUNT * 4);
const KT_IQ4_OFFSET_CENTERS: StaticArray<f32> = new StaticArray<f32>(KT_IQ4_CLUSTER_COUNT * 4);

const KT_IQ1_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ1_CLUSTER_COUNT);
const KT_IQ2_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ2_CLUSTER_COUNT);
const KT_IQ3_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ3_CLUSTER_COUNT);
const KT_IQ4_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ4_CLUSTER_COUNT);
const KT_IQ4_OFFSET_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ4_CLUSTER_COUNT);
const KT_IQ1_OFFSETS: StaticArray<u32> = new StaticArray<u32>(KT_IQ1_CLUSTER_COUNT);
const KT_IQ2_OFFSETS: StaticArray<u32> = new StaticArray<u32>(KT_IQ2_CLUSTER_COUNT);
const KT_IQ3_OFFSETS: StaticArray<u32> = new StaticArray<u32>(KT_IQ3_CLUSTER_COUNT);
const KT_IQ4_OFFSETS: StaticArray<u32> = new StaticArray<u32>(KT_IQ4_CLUSTER_COUNT);
const KT_IQ4_OFFSET_OFFSETS: StaticArray<u32> = new StaticArray<u32>(KT_IQ4_CLUSTER_COUNT);

const KT_IQ1_CANDIDATES: StaticArray<u16> = new StaticArray<u16>(KT_IQ1_VALUE_COUNT * KT_IQ1_NEIGHBOURS + KT_IQ1_CLUSTER_COUNT * 7);
const KT_IQ2_CANDIDATES: StaticArray<u16> = new StaticArray<u16>(KT_IQ2_VALUE_COUNT * KT_IQ2_NEIGHBOURS + KT_IQ2_CLUSTER_COUNT * 7);
const KT_IQ3_CANDIDATES: StaticArray<u16> = new StaticArray<u16>(KT_IQ3_VALUE_COUNT * KT_IQ3_NEIGHBOURS + KT_IQ3_CLUSTER_COUNT * 7);
const KT_IQ4_CANDIDATES: StaticArray<u16> = new StaticArray<u16>(KT_IQ4_VALUE_COUNT * KT_IQ4_NEIGHBOURS + KT_IQ4_CLUSTER_COUNT * 7);
const KT_IQ4_OFFSET_CANDIDATES: StaticArray<u16> = new StaticArray<u16>(KT_IQ4_VALUE_COUNT * KT_IQ4_NEIGHBOURS + KT_IQ4_CLUSTER_COUNT * 7);

const KT_INDEX_ASSIGNMENTS: StaticArray<u16> = new StaticArray<u16>(KT_IQ2_VALUE_COUNT * KT_IQ2_NEIGHBOURS);
const KT_INDEX_WORK_COUNTS: StaticArray<u32> = new StaticArray<u32>(KT_IQ4_CLUSTER_COUNT);
const KT_INDEX_WORK_BEST: StaticArray<f32> = new StaticArray<f32>(32);
const KT_INDEX_WORK_CLUSTERS: StaticArray<u32> = new StaticArray<u32>(32);
const KT_INDEX_WORK_SELECTED: StaticArray<u16> = new StaticArray<u16>(7);
const KT_INDEX_WORK_HISTOGRAM: StaticArray<u32> = new StaticArray<u32>(253);

let KT_IQ1_VALUES_READY: bool = false;
let KT_IQ2_VALUES_READY: bool = false;
let KT_IQ3_VALUES_READY: bool = false;
let KT_IQ4_VALUES_READY: bool = false;
let KT_IQ4_OFFSET_VALUES_READY: bool = false;
let KT_IQ1_INDEX_READY: bool = false;
let KT_IQ2_INDEX_READY: bool = false;
let KT_IQ3_INDEX_READY: bool = false;
let KT_IQ4_INDEX_READY: bool = false;
let KT_IQ4_OFFSET_INDEX_READY: bool = false;

function ktSetIntValues(values: StaticArray<f32>, valueCount: u32, groupSize: u32, offset: u32, useAbs: bool): void {
  for (let code: u32 = 0; code < valueCount; code++) {
    let hash = code + offset;
    for (let lane: u32 = 0; lane < groupSize; lane++) {
      hash = u32(0xcbac1fed) * hash;
      const packed = hash & 0x3f3f3f3f;
      let value = i32(packed & 0xff) + i32((packed >> 8) & 0xff) +
        i32((packed >> 16) & 0xff) + i32(packed >> 24) - 126;
      if (useAbs && value < 0) value = -value;
      values[i32(code * groupSize + lane)] = f32(value);
    }
  }
}

function ktEnsureValues(kind: u32, offsetMode: bool): void {
  if (kind == 1) {
    if (!KT_IQ1_VALUES_READY) {
      ktSetIntValues(KT_IQ1_VALUES, KT_IQ1_VALUE_COUNT, 8, 4096, false);
      KT_IQ1_VALUES_READY = true;
    }
  } else if (kind == 2) {
    if (!KT_IQ2_VALUES_READY) {
      ktSetIntValues(KT_IQ2_VALUES, KT_IQ2_VALUE_COUNT, 8, 4096, false);
      KT_IQ2_VALUES_READY = true;
    }
  } else if (kind == 3) {
    if (!KT_IQ3_VALUES_READY) {
      ktSetIntValues(KT_IQ3_VALUES, KT_IQ3_VALUE_COUNT, 8, 4096, true);
      KT_IQ3_VALUES_READY = true;
    }
  } else if (offsetMode) {
    if (!KT_IQ4_OFFSET_VALUES_READY) {
      ktSetIntValues(KT_IQ4_OFFSET_VALUES, KT_IQ4_VALUE_COUNT, 4, 4096 + 32768, false);
      KT_IQ4_OFFSET_VALUES_READY = true;
    }
  } else if (!KT_IQ4_VALUES_READY) {
    ktSetIntValues(KT_IQ4_VALUES, KT_IQ4_VALUE_COUNT, 4, 4096, false);
    KT_IQ4_VALUES_READY = true;
  }
}

function ktValue(kind: u32, offsetMode: bool, index: u32, lane: u32): f32 {
  if (kind == 1) return unchecked(KT_IQ1_VALUES[i32(index * 8 + lane)]);
  if (kind == 2) return unchecked(KT_IQ2_VALUES[i32(index * 8 + lane)]);
  if (kind == 3) return unchecked(KT_IQ3_VALUES[i32(index * 8 + lane)]);
  if (offsetMode) return unchecked(KT_IQ4_OFFSET_VALUES[i32(index * 4 + lane)]);
  return unchecked(KT_IQ4_VALUES[i32(index * 4 + lane)]);
}

function ktBin5(value: f32): u32 {
  if (value < -48.0) return 0;
  if (value < -16.0) return 1;
  if (value < 16.0) return 2;
  if (value < 48.0) return 3;
  return 4;
}

function ktClusterForCode(values: StaticArray<f32>, index: u32, groupSize: u32, mid: StaticArray<f32>): u32 {
  if (groupSize == 4) {
    let cluster: u32 = 0;
    let multiplier: u32 = 1;
    for (let lane: u32 = 0; lane < 4; lane++) {
      cluster += multiplier * ktBin5(unchecked(values[i32(index * 4 + lane)]));
      multiplier *= 5;
    }
    return cluster;
  }
  let cluster: u32 = 0;
  for (let lane: u32 = 0; lane < 8; lane++) {
    if (unchecked(values[i32(index * 8 + lane)]) > unchecked(mid[i32(lane)])) {
      cluster |= u32(1) << i32(lane);
    }
  }
  return cluster;
}

function ktClusterForInput(src: FloatPtr, srcStart: u32, inverseScale: f32, groupSize: u32, mid: StaticArray<f32>, useAbs: bool): u32 {
  if (groupSize == 4) {
    let cluster: u32 = 0;
    let multiplier: u32 = 1;
    for (let lane: u32 = 0; lane < 4; lane++) {
      cluster += multiplier * ktBin5(inverseScale * readF32(src, srcStart + lane));
      multiplier *= 5;
    }
    return cluster;
  }
  let cluster: u32 = 0;
  for (let lane: u32 = 0; lane < 8; lane++) {
    const value = useAbs ? absF32(readF32(src, srcStart + lane)) : readF32(src, srcStart + lane);
    if (inverseScale * value > unchecked(mid[i32(lane)])) {
      cluster |= u32(1) << i32(lane);
    }
  }
  return cluster;
}

function ktMedianValue(histogram: StaticArray<u32>, target: u32): f32 {
  let count: u32 = 0;
  for (let index: u32 = 0; index < 253; index++) {
    count += histogram[i32(index)];
    if (count > target) return f32(i32(index) - 126);
  }
  return 126.0;
}

function ktBuildIndex(
  values: StaticArray<f32>,
  valueCount: u32,
  groupSize: u32,
  clusterCount: u32,
  neighbourCount: u32,
  useAbs: bool,
  mid: StaticArray<f32>,
  centers: StaticArray<f32>,
  counts: StaticArray<u32>,
  offsets: StaticArray<u32>,
  candidates: StaticArray<u16>,
): void {
  if (groupSize == 8) {
    for (let lane: u32 = 0; lane < groupSize; lane++) {
      if (useAbs) {
        for (let index: u32 = 0; index < 253; index++) KT_INDEX_WORK_HISTOGRAM[i32(index)] = 0;
        for (let point: u32 = 0; point < valueCount; point++) {
          const value = i32(unchecked(values[i32(point * groupSize + lane)]));
          KT_INDEX_WORK_HISTOGRAM[value + 126]++;
        }
        mid[i32(lane)] = 0.5 * (ktMedianValue(KT_INDEX_WORK_HISTOGRAM, valueCount / 2) +
          ktMedianValue(KT_INDEX_WORK_HISTOGRAM, valueCount / 2 - 1));
      } else {
        let minimum = 3.4028235e38;
        let maximum = -3.4028235e38;
        for (let point: u32 = 0; point < valueCount; point++) {
          const value = unchecked(values[i32(point * groupSize + lane)]);
          if (value < minimum) minimum = value;
          if (value > maximum) maximum = value;
        }
        mid[i32(lane)] = f32(0.5 * (minimum + maximum));
      }
    }
  }

  for (let cluster: u32 = 0; cluster < clusterCount; cluster++) {
    counts[i32(cluster)] = 0;
    for (let lane: u32 = 0; lane < groupSize; lane++) centers[i32(cluster * groupSize + lane)] = 0.0;
  }
  for (let point: u32 = 0; point < valueCount; point++) {
    const cluster = ktClusterForCode(values, point, groupSize, mid);
    counts[i32(cluster)]++;
    for (let lane: u32 = 0; lane < groupSize; lane++) {
      centers[i32(cluster * groupSize + lane)] += unchecked(values[i32(point * groupSize + lane)]);
    }
  }
  for (let cluster: u32 = 0; cluster < clusterCount; cluster++) {
    const count = counts[i32(cluster)];
    if (count != 0) {
      for (let lane: u32 = 0; lane < groupSize; lane++) {
        centers[i32(cluster * groupSize + lane)] /= f32(count);
      }
    }
  }

  for (let cluster: u32 = 0; cluster < clusterCount; cluster++) KT_INDEX_WORK_COUNTS[i32(cluster)] = 0;
  for (let point: u32 = 0; point < valueCount; point++) {
    for (let neighbour: u32 = 0; neighbour < neighbourCount; neighbour++) {
      KT_INDEX_WORK_BEST[i32(neighbour)] = 3.4028235e38;
      KT_INDEX_WORK_CLUSTERS[i32(neighbour)] = 0;
    }
    for (let cluster: u32 = 0; cluster < clusterCount; cluster++) {
      let distance: f32 = 0.0;
      for (let lane: u32 = 0; lane < groupSize; lane++) {
        const difference = unchecked(values[i32(point * groupSize + lane)]) -
          centers[i32(cluster * groupSize + lane)];
        distance += difference * difference;
      }
      for (let neighbour: u32 = 0; neighbour < neighbourCount; neighbour++) {
        if (distance < KT_INDEX_WORK_BEST[i32(neighbour)]) {
          for (let shift: u32 = neighbourCount - 1; shift > neighbour; shift--) {
            KT_INDEX_WORK_BEST[i32(shift)] = KT_INDEX_WORK_BEST[i32(shift - 1)];
            KT_INDEX_WORK_CLUSTERS[i32(shift)] = KT_INDEX_WORK_CLUSTERS[i32(shift - 1)];
          }
          KT_INDEX_WORK_BEST[i32(neighbour)] = distance;
          KT_INDEX_WORK_CLUSTERS[i32(neighbour)] = cluster;
          break;
        }
      }
    }
    for (let neighbour: u32 = 0; neighbour < neighbourCount; neighbour++) {
      const assignment = KT_INDEX_WORK_CLUSTERS[i32(neighbour)];
      KT_INDEX_WORK_COUNTS[i32(assignment)]++;
      KT_INDEX_ASSIGNMENTS[i32(point * neighbourCount + neighbour)] = u16(assignment);
    }
  }

  let candidateTotal: u32 = 0;
  for (let cluster: u32 = 0; cluster < clusterCount; cluster++) {
    const count = KT_INDEX_WORK_COUNTS[i32(cluster)];
    offsets[i32(cluster)] = candidateTotal;
    const capacity = count == 0 ? 0 : ((count + 7) / 8) * 8;
    counts[i32(cluster)] = capacity;
    candidateTotal += capacity;
    KT_INDEX_WORK_COUNTS[i32(cluster)] = 0;
  }
  for (let point: u32 = 0; point < valueCount; point++) {
    for (let neighbour: u32 = 0; neighbour < neighbourCount; neighbour++) {
      const cluster = u32(KT_INDEX_ASSIGNMENTS[i32(point * neighbourCount + neighbour)]);
      const slot = offsets[i32(cluster)] + KT_INDEX_WORK_COUNTS[i32(cluster)]++;
      candidates[i32(slot)] = u16(point);
    }
  }

  for (let cluster: u32 = 0; cluster < clusterCount; cluster++) {
    const initialCount = KT_INDEX_WORK_COUNTS[i32(cluster)];
    const count = counts[i32(cluster)];
    const needed = count - initialCount;
    for (let add: u32 = 0; add < needed; add++) {
      let bestPoint: u32 = 0;
      let bestDistance: f32 = 3.4028235e38;
      for (let point: u32 = 0; point < valueCount; point++) {
        let assigned = false;
        for (let neighbour: u32 = 0; neighbour < neighbourCount; neighbour++) {
          if (u32(KT_INDEX_ASSIGNMENTS[i32(point * neighbourCount + neighbour)]) == cluster) {
            assigned = true;
            break;
          }
        }
        if (assigned) continue;
        let alreadySelected = false;
        for (let previous: u32 = 0; previous < add; previous++) {
          if (u32(KT_INDEX_WORK_SELECTED[i32(previous)]) == point) {
            alreadySelected = true;
            break;
          }
        }
        if (alreadySelected) continue;
        let distance: f32 = 0.0;
        for (let lane: u32 = 0; lane < groupSize; lane++) {
          const difference = unchecked(values[i32(point * groupSize + lane)]) -
            centers[i32(cluster * groupSize + lane)];
          distance += difference * difference;
        }
        if (distance < bestDistance || (distance == bestDistance && point < bestPoint)) {
          bestDistance = distance;
          bestPoint = point;
        }
      }
      KT_INDEX_WORK_SELECTED[i32(add)] = u16(bestPoint);
      candidates[i32(offsets[i32(cluster)] + initialCount + add)] = u16(bestPoint);
    }
  }
}

function ktEnsureIndex(kind: u32, offsetMode: bool): void {
  if (kind == 1) {
    if (!KT_IQ1_INDEX_READY) {
      ktEnsureValues(1, false);
      ktBuildIndex(KT_IQ1_VALUES, KT_IQ1_VALUE_COUNT, 8, KT_IQ1_CLUSTER_COUNT, KT_IQ1_NEIGHBOURS,
        false, KT_IQ1_MID, KT_IQ1_CENTERS, KT_IQ1_COUNTS, KT_IQ1_OFFSETS, KT_IQ1_CANDIDATES);
      KT_IQ1_INDEX_READY = true;
    }
  } else if (kind == 2) {
    if (!KT_IQ2_INDEX_READY) {
      ktEnsureValues(2, false);
      ktBuildIndex(KT_IQ2_VALUES, KT_IQ2_VALUE_COUNT, 8, KT_IQ2_CLUSTER_COUNT, KT_IQ2_NEIGHBOURS,
        false, KT_IQ2_MID, KT_IQ2_CENTERS, KT_IQ2_COUNTS, KT_IQ2_OFFSETS, KT_IQ2_CANDIDATES);
      KT_IQ2_INDEX_READY = true;
    }
  } else if (kind == 3) {
    if (!KT_IQ3_INDEX_READY) {
      ktEnsureValues(3, false);
      ktBuildIndex(KT_IQ3_VALUES, KT_IQ3_VALUE_COUNT, 8, KT_IQ3_CLUSTER_COUNT, KT_IQ3_NEIGHBOURS,
        true, KT_IQ3_MID, KT_IQ3_CENTERS, KT_IQ3_COUNTS, KT_IQ3_OFFSETS, KT_IQ3_CANDIDATES);
      KT_IQ3_INDEX_READY = true;
    }
  } else if (offsetMode) {
    if (!KT_IQ4_OFFSET_INDEX_READY) {
      ktEnsureValues(4, true);
      ktBuildIndex(KT_IQ4_OFFSET_VALUES, KT_IQ4_VALUE_COUNT, 4, KT_IQ4_CLUSTER_COUNT, KT_IQ4_NEIGHBOURS,
        false, KT_IQ4_OFFSET_MID, KT_IQ4_OFFSET_CENTERS, KT_IQ4_OFFSET_COUNTS, KT_IQ4_OFFSET_OFFSETS, KT_IQ4_OFFSET_CANDIDATES);
      KT_IQ4_OFFSET_INDEX_READY = true;
    }
  } else if (!KT_IQ4_INDEX_READY) {
    ktEnsureValues(4, false);
    ktBuildIndex(KT_IQ4_VALUES, KT_IQ4_VALUE_COUNT, 4, KT_IQ4_CLUSTER_COUNT, KT_IQ4_NEIGHBOURS,
      false, KT_IQ4_MID, KT_IQ4_CENTERS, KT_IQ4_COUNTS, KT_IQ4_OFFSETS, KT_IQ4_CANDIDATES);
    KT_IQ4_INDEX_READY = true;
  }
}

function ktIndexCount(kind: u32, offsetMode: bool, cluster: u32): u32 {
  if (kind == 1) return KT_IQ1_COUNTS[i32(cluster)];
  if (kind == 2) return KT_IQ2_COUNTS[i32(cluster)];
  if (kind == 3) return KT_IQ3_COUNTS[i32(cluster)];
  if (offsetMode) return KT_IQ4_OFFSET_COUNTS[i32(cluster)];
  return KT_IQ4_COUNTS[i32(cluster)];
}

function ktIndexOffset(kind: u32, offsetMode: bool, cluster: u32): u32 {
  if (kind == 1) return KT_IQ1_OFFSETS[i32(cluster)];
  if (kind == 2) return KT_IQ2_OFFSETS[i32(cluster)];
  if (kind == 3) return KT_IQ3_OFFSETS[i32(cluster)];
  if (offsetMode) return KT_IQ4_OFFSET_OFFSETS[i32(cluster)];
  return KT_IQ4_OFFSETS[i32(cluster)];
}

function ktIndexCandidate(kind: u32, offsetMode: bool, index: u32): u32 {
  if (kind == 1) return u32(KT_IQ1_CANDIDATES[i32(index)]);
  if (kind == 2) return u32(KT_IQ2_CANDIDATES[i32(index)]);
  if (kind == 3) return u32(KT_IQ3_CANDIDATES[i32(index)]);
  if (offsetMode) return u32(KT_IQ4_OFFSET_CANDIDATES[i32(index)]);
  return u32(KT_IQ4_CANDIDATES[i32(index)]);
}

function ktFindBestMatch(
  kind: u32,
  offsetMode: bool,
  src: FloatPtr,
  srcStart: u32,
  weights: StaticArray<f32>,
  weightStart: u32,
  scale: f32,
  result: StaticArray<u16>,
): void {
  const groupSize: u32 = kind == 4 ? 4 : 8;
  const groupCount: u32 = kind == 4 ? 8 : 4;
  ktEnsureIndex(kind, offsetMode);
  if (scale == 0.0) {
    for (let group: u32 = 0; group < groupCount; group++) result[i32(group)] = 0;
    return;
  }
  const mid = kind == 1 ? KT_IQ1_MID : kind == 2 ? KT_IQ2_MID : kind == 3 ? KT_IQ3_MID :
    (offsetMode ? KT_IQ4_OFFSET_MID : KT_IQ4_MID);
  const inverseScale = f32(1.0) / scale;
  for (let group: u32 = 0; group < groupCount; group++) {
    const groupStart = srcStart + group * groupSize;
    const weightOffset = weightStart + group * groupSize;
    const cluster = ktClusterForInput(src, groupStart, inverseScale, groupSize, mid, kind == 3);
    const candidateStart = ktIndexOffset(kind, offsetMode, cluster);
    const candidateCount = ktIndexCount(kind, offsetMode, cluster);
    let bestDistance: f32 = 3.4028235e38;
    let bestIndex: u32 = 0;
    for (let candidate: u32 = 0; candidate < candidateCount; candidate++) {
      const valueIndex = ktIndexCandidate(kind, offsetMode, candidateStart + candidate);
      let distance: f32 = 0.0;
      for (let lane: u32 = 0; lane < groupSize; lane++) {
        const sourceValue = kind == 3 ? absF32(readF32(src, groupStart + lane)) : readF32(src, groupStart + lane);
        const difference = ktValue(kind, offsetMode, valueIndex, lane) - inverseScale * sourceValue;
        if (groupSize == 4) {
          const magnitude = absF32(difference);
          distance += weights[i32(weightOffset + lane)] * magnitude * magnitude * magnitude;
        } else {
          distance += weights[i32(weightOffset + lane)] * difference * difference;
        }
      }
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = valueIndex;
      }
    }
    result[i32(group)] = u16(bestIndex);
  }
}

function ktFindBestScale(
  kind: u32,
  offsetMode: bool,
  src: FloatPtr,
  srcStart: u32,
  weights: StaticArray<f32>,
  weightStart: u32,
  indices: StaticArray<u16>,
  result: StaticArray<f32>,
): void {
  const groupSize: u32 = kind == 4 ? 4 : 8;
  const groupCount: u32 = kind == 4 ? 8 : 4;
  let sumQx: f32 = 0.0;
  let sumQ2: f32 = 0.0;
  for (let group: u32 = 0; group < groupCount; group++) {
    const valueIndex = u32(indices[i32(group)]);
    for (let lane: u32 = 0; lane < groupSize; lane++) {
      const sourceValue = kind == 3 ? absF32(readF32(src, srcStart + group * groupSize + lane)) :
        readF32(src, srcStart + group * groupSize + lane);
      const weight = weights[i32(weightStart + group * groupSize + lane)];
      const quant = ktValue(kind, offsetMode, valueIndex, lane);
      sumQx += weight * quant * sourceValue;
      sumQ2 += weight * quant * quant;
    }
  }
  result[0] = sumQ2 > 0.0 ? sumQx / sumQ2 : 0.0;
  result[1] = sumQ2 > 0.0 ? sumQx * sumQx / sumQ2 : 0.0;
}

function ktSetWeights(src: FloatPtr, srcStart: u32, nPerRow: u32, weights: StaticArray<f32>): void {
  const blocksPerRow = nPerRow / 256;
  for (let block: u32 = 0; block < blocksPerRow; block++) {
    const blockStart = srcStart + block * 256;
    let sumSquares: f32 = 0.0;
    for (let element: u32 = 0; element < 256; element++) {
      const value = readF32(src, blockStart + element);
      sumSquares += value * value;
    }
    if (sumSquares < 1.0e-14 * 256.0) {
      for (let element: u32 = 0; element < 256; element++) weights[i32(block * 256 + element)] = 1.0e-4;
    } else {
      const sigma2 = 2.0 * sumSquares / 256.0;
      for (let element: u32 = 0; element < 256; element++) {
        const value = readF32(src, blockStart + element);
        weights[i32(block * 256 + element)] = f32(0.25 * sigma2 + value * value);
      }
    }
  }
}

function ktNearestInt(value: f32): i32 {
  const shifted = value + 12582912.0;
  const bits = reinterpret<u32>(shifted);
  return i32((bits & 0x007fffff) - 0x00400000);
}

function ktBestScaleIndex(value: f32): u32 {
  return bestIq4NlIndex(value);
}

export function quantize_iq1_kt(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 56;
  const weights = new StaticArray<f32>(n_per_row);
  const scales = new StaticArray<f32>(blocksPerRow * 8);
  const indices = new StaticArray<u16>(blocksPerRow * 32);
  const positive = new StaticArray<u16>(4);
  const negative = new StaticArray<u16>(4);
  const best = new StaticArray<u16>(4);
  const fit = new StaticArray<f32>(2);
  const fitSecond = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = row * n_per_row;
    const rowDestination = dst + usize(row * rowSize);
    store<f32>(rowDestination, 0.0);
    for (let byte: u32 = 0; byte < blocksPerRow * 56; byte++) store<u8>(rowDestination + usize(4 + byte), 0);
    ktSetWeights(src, rowSource, n_per_row, weights);

    let amaxRow: f32 = 0.0;
    for (let element: u32 = 0; element < n_per_row; element++) {
      const magnitude = absF32(readF32(src, rowSource + element));
      if (magnitude > amaxRow) amaxRow = magnitude;
    }
    let amaxScale: f32 = 0.0;
    let maxScale: f32 = 0.0;

    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 56);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const subBlockSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        let amax: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const magnitude = absF32(readF32(src, subBlockSource + lane));
          if (magnitude > amax) amax = magnitude;
        }
        const scaleIndex = block * 8 + subBlock;
        const indexStart = scaleIndex * 4;
        if (amax < 1.0e-16) {
          scales[i32(scaleIndex)] = 0.0;
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = 0;
          continue;
        }

        const scale0 = amax > 0.0 && 124.0 * amax / amaxRow > 90.0 ? 124.0 * amax / amaxRow : 90.0;
        ktFindBestMatch(1, false, src, subBlockSource, weights, weightStart, f32(amax / scale0), positive);
        ktFindBestScale(1, false, src, subBlockSource, weights, weightStart, positive, fit);
        ktFindBestMatch(1, false, src, subBlockSource, weights, weightStart, f32(-amax / scale0), negative);
        ktFindBestScale(1, false, src, subBlockSource, weights, weightStart, negative, fitSecond);
        let chosenScore = fit[1];
        if (chosenScore > fitSecond[1]) {
          scales[i32(scaleIndex)] = fit[0];
          for (let group: u32 = 0; group < 4; group++) {
            best[i32(group)] = positive[i32(group)];
            indices[i32(indexStart + group)] = best[i32(group)];
          }
        } else {
          scales[i32(scaleIndex)] = fitSecond[0];
          chosenScore = fitSecond[1];
          for (let group: u32 = 0; group < 4; group++) {
            best[i32(group)] = negative[i32(group)];
            indices[i32(indexStart + group)] = best[i32(group)];
          }
        }

        const secondScale0 = scale0 - 8.0;
        ktFindBestMatch(1, false, src, subBlockSource, weights, weightStart, f32(amax / secondScale0), positive);
        ktFindBestScale(1, false, src, subBlockSource, weights, weightStart, positive, fit);
        ktFindBestMatch(1, false, src, subBlockSource, weights, weightStart, f32(-amax / secondScale0), negative);
        ktFindBestScale(1, false, src, subBlockSource, weights, weightStart, negative, fitSecond);
        if (fit[1] > chosenScore || fitSecond[1] > chosenScore) {
          if (fit[1] > fitSecond[1]) {
            scales[i32(scaleIndex)] = fit[0];
            for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = positive[i32(group)];
          } else {
            scales[i32(scaleIndex)] = fitSecond[0];
            for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = negative[i32(group)];
          }
        }

        const magnitude = absF32(scales[i32(scaleIndex)]);
        if (magnitude > amaxScale) {
          amaxScale = magnitude;
          maxScale = scales[i32(scaleIndex)];
        }
      }
    }

    if (maxScale == 0.0) continue;
    let d = maxScale / f32(unchecked(IQ4_K_VALUES[0]));
    let bestScore: f32 = 0.0;
    for (let attempt: i32 = -9; attempt <= 9; attempt++) {
      const inverseScale = (f32(attempt) + f32(unchecked(IQ4_K_VALUES[0]))) / maxScale;
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let block: u32 = 0; block < blocksPerRow; block++) {
        const blockSource = rowSource + block * 256;
        for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
          const scaleIndex = block * 8 + subBlock;
          const scaleLevel = ktBestScaleIndex(inverseScale * scales[i32(scaleIndex)]);
          const scaleValue = f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)]));
          const indexStart = scaleIndex * 4;
          const groupSource = blockSource + subBlock * 32;
          for (let group: u32 = 0; group < 4; group++) {
            const valueIndex = u32(indices[i32(indexStart + group)]);
            for (let lane: u32 = 0; lane < 8; lane++) {
              const sourceValue = readF32(src, groupSource + group * 8 + lane);
              const weight = weights[i32(indexStart * 8 + group * 8 + lane)];
              const quant = scaleValue * ktValue(1, false, valueIndex, lane);
              sumQx += weight * sourceValue * quant;
              sumQ2 += weight * quant * quant;
            }
          }
        }
      }
      if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        d = sumQx / sumQ2;
        bestScore = d * sumQx;
      }
    }

    store<f32>(rowDestination, d);
    if (d == 0.0) continue;
    const inverseD = f32(1.0) / d;
    let finalSumQx: f32 = 0.0;
    let finalSumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 56);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const scaleIndex = block * 8 + subBlock;
        store<u8>(blockDestination + usize(subBlock), u8(ktBestScaleIndex(inverseD * scales[i32(scaleIndex)])));
      }
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const groupSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        const scaleIndex = block * 8 + subBlock;
        const scaleLevel = i32(load<u8>(blockDestination + usize(subBlock)) & 15);
        const blockScale = d * f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)]));
        ktFindBestMatch(1, false, src, groupSource, weights, weightStart, blockScale, best);
        const indexStart = scaleIndex * 4;
        let msePrevious: f32 = 0.0;
        let mseCandidate: f32 = 0.0;
        for (let group: u32 = 0; group < 4; group++) {
          const previousIndex = u32(indices[i32(indexStart + group)]);
          const candidateIndex = u32(best[i32(group)]);
          for (let lane: u32 = 0; lane < 8; lane++) {
            const sourceValue = readF32(src, groupSource + group * 8 + lane);
            const weight = weights[i32(weightStart + group * 8 + lane)];
            const previousDifference = sourceValue - blockScale * ktValue(1, false, previousIndex, lane);
            const candidateDifference = sourceValue - blockScale * ktValue(1, false, candidateIndex, lane);
            msePrevious += weight * previousDifference * previousDifference;
            mseCandidate += weight * candidateDifference * candidateDifference;
          }
        }
        if (msePrevious < mseCandidate) {
          for (let group: u32 = 0; group < 4; group++) best[i32(group)] = indices[i32(indexStart + group)];
        } else {
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = best[i32(group)];
        }
        for (let group: u32 = 0; group < 4; group++) {
          const valueIndex = u32(best[i32(group)]);
          store<u8>(blockDestination + usize(8 + subBlock * 4 + group), u8(valueIndex & 0xff));
          const highAddress = blockDestination + usize(40 + (subBlock % 4) * 4 + group);
          store<u8>(highAddress, load<u8>(highAddress) | u8(((valueIndex >> 8) & 15) << i32(4 * (subBlock / 4))));
          store<u8>(blockDestination + usize(subBlock),
            load<u8>(blockDestination + usize(subBlock)) | u8((valueIndex >> 12) << i32(4 + group)));
          for (let lane: u32 = 0; lane < 8; lane++) {
            const sourceValue = readF32(src, groupSource + group * 8 + lane);
            const weight = weights[i32(weightStart + group * 8 + lane)];
            const quant = f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)])) * ktValue(1, false, valueIndex, lane);
            finalSumQx += weight * sourceValue * quant;
            finalSumQ2 += weight * quant * quant;
          }
        }
      }
    }
    if (finalSumQ2 > 0.0) store<f32>(rowDestination, finalSumQx / finalSumQ2);
  }
}

export function dequantize_iq1_kt(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 56;
  ktEnsureValues(1, false);
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = src + usize(row * rowSize);
    const rowDestination = row * n_per_row;
    const d = load<f32>(rowSource);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + usize(4 + block * 56);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const scaleLevel = u32(load<u8>(blockSource + usize(subBlock))) & 15;
        const scale = d * f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)]));
        for (let group: u32 = 0; group < 4; group++) {
          const low = u32(load<u8>(blockSource + usize(8 + subBlock * 4 + group)));
          const high = u32(load<u8>(blockSource + usize(40 + (subBlock % 4) * 4 + group)));
          const index = low | ((high << i32(8 - 4 * (subBlock / 4))) & 0xf00) |
            ((u32(load<u8>(blockSource + usize(subBlock))) << i32(8 - group)) & 0x1000);
          const outputStart = rowDestination + block * 256 + subBlock * 32 + group * 8;
          for (let lane: u32 = 0; lane < 8; lane++) {
            writeF32(dst, outputStart + lane, scale * ktValue(1, false, index, lane));
          }
        }
      }
    }
  }
}

export function quantize_iq2_kt(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 68;
  const weights = new StaticArray<f32>(n_per_row);
  const scales = new StaticArray<f32>(blocksPerRow * 8);
  const indices = new StaticArray<u16>(blocksPerRow * 32);
  const positive = new StaticArray<u16>(4);
  const negative = new StaticArray<u16>(4);
  const best = new StaticArray<u16>(4);
  const fit = new StaticArray<f32>(2);
  const fitSecond = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = row * n_per_row;
    const rowDestination = dst + usize(row * rowSize);
    store<f32>(rowDestination, 0.0);
    for (let byte: u32 = 0; byte < blocksPerRow * 68; byte++) store<u8>(rowDestination + usize(4 + byte), 0);
    ktSetWeights(src, rowSource, n_per_row, weights);

    let amaxRow: f32 = 0.0;
    for (let element: u32 = 0; element < n_per_row; element++) {
      const magnitude = absF32(readF32(src, rowSource + element));
      if (magnitude > amaxRow) amaxRow = magnitude;
    }
    let amaxScale: f32 = 0.0;
    let maxScale: f32 = 0.0;

    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 68);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const subBlockSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        let amax: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const magnitude = absF32(readF32(src, subBlockSource + lane));
          if (magnitude > amax) amax = magnitude;
        }
        const scaleIndex = block * 8 + subBlock;
        const indexStart = scaleIndex * 4;
        if (amax < 1.0e-16) {
          scales[i32(scaleIndex)] = 0.0;
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = 0;
          continue;
        }

        const scale0 = 124.0 * amax / amaxRow > 90.0 ? 124.0 * amax / amaxRow : 90.0;
        ktFindBestMatch(2, false, src, subBlockSource, weights, weightStart, f32(amax / scale0), positive);
        ktFindBestScale(2, false, src, subBlockSource, weights, weightStart, positive, fit);
        ktFindBestMatch(2, false, src, subBlockSource, weights, weightStart, f32(-amax / scale0), negative);
        ktFindBestScale(2, false, src, subBlockSource, weights, weightStart, negative, fitSecond);
        if (fit[1] > fitSecond[1]) {
          scales[i32(scaleIndex)] = fit[0];
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = positive[i32(group)];
        } else {
          scales[i32(scaleIndex)] = fitSecond[0];
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = negative[i32(group)];
        }

        const magnitude = absF32(scales[i32(scaleIndex)]);
        if (magnitude > amaxScale) {
          amaxScale = magnitude;
          maxScale = scales[i32(scaleIndex)];
        }
      }
    }

    if (maxScale == 0.0) continue;
    let d = maxScale / f32(unchecked(IQ4_K_VALUES[0]));
    let bestScore: f32 = 0.0;
    for (let attempt: i32 = -9; attempt <= 9; attempt++) {
      const inverseScale = (f32(attempt) + f32(unchecked(IQ4_K_VALUES[0]))) / maxScale;
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let block: u32 = 0; block < blocksPerRow; block++) {
        const blockSource = rowSource + block * 256;
        for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
          const scaleIndex = block * 8 + subBlock;
          const scaleLevel = ktBestScaleIndex(inverseScale * scales[i32(scaleIndex)]);
          const scaleValue = f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)]));
          const indexStart = scaleIndex * 4;
          const groupSource = blockSource + subBlock * 32;
          for (let group: u32 = 0; group < 4; group++) {
            const valueIndex = u32(indices[i32(indexStart + group)]);
            for (let lane: u32 = 0; lane < 8; lane++) {
              const sourceValue = readF32(src, groupSource + group * 8 + lane);
              const weight = weights[i32(indexStart * 8 + group * 8 + lane)];
              const quant = scaleValue * ktValue(2, false, valueIndex, lane);
              sumQx += weight * sourceValue * quant;
              sumQ2 += weight * quant * quant;
            }
          }
        }
      }
      if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        d = sumQx / sumQ2;
        bestScore = d * sumQx;
      }
    }

    store<f32>(rowDestination, d);
    if (d == 0.0) continue;
    const inverseD = f32(1.0) / d;
    let finalSumQx: f32 = 0.0;
    let finalSumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 68);
      for (let half: u32 = 0; half < 4; half++) {
        const lowLevel = ktBestScaleIndex(inverseD * scales[block * 8 + half]);
        const highLevel = ktBestScaleIndex(inverseD * scales[block * 8 + half + 4]);
        store<u8>(blockDestination + usize(half), u8(lowLevel | (highLevel << 4)));
      }
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const groupSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        const scaleByte = load<u8>(blockDestination + usize(subBlock % 4));
        const scaleLevel = (subBlock < 4 ? u32(scaleByte & 15) : u32(scaleByte >> 4));
        const blockScale = d * f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)]));
        ktFindBestMatch(2, false, src, groupSource, weights, weightStart, blockScale, best);
        const indexStart = (block * 8 + subBlock) * 4;
        let msePrevious: f32 = 0.0;
        let mseCandidate: f32 = 0.0;
        for (let group: u32 = 0; group < 4; group++) {
          const previousIndex = u32(indices[i32(indexStart + group)]);
          const candidateIndex = u32(best[i32(group)]);
          for (let lane: u32 = 0; lane < 8; lane++) {
            const sourceValue = readF32(src, groupSource + group * 8 + lane);
            const weight = weights[i32(weightStart + group * 8 + lane)];
            const previousDifference = sourceValue - blockScale * ktValue(2, false, previousIndex, lane);
            const candidateDifference = sourceValue - blockScale * ktValue(2, false, candidateIndex, lane);
            msePrevious += weight * previousDifference * previousDifference;
            mseCandidate += weight * candidateDifference * candidateDifference;
          }
        }
        if (msePrevious < mseCandidate) {
          for (let group: u32 = 0; group < 4; group++) best[i32(group)] = indices[i32(indexStart + group)];
        } else {
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = best[i32(group)];
        }
        for (let group: u32 = 0; group < 4; group++) {
          const valueIndex = u32(best[i32(group)]);
          store<u16>(blockDestination + usize(4 + 2 * (subBlock * 4 + group)), valueIndex);
          for (let lane: u32 = 0; lane < 8; lane++) {
            const sourceValue = readF32(src, groupSource + group * 8 + lane);
            const weight = weights[i32(weightStart + group * 8 + lane)];
            const quant = f32(unchecked(IQ4_K_VALUES[i32(scaleLevel)])) * ktValue(2, false, valueIndex, lane);
            finalSumQx += weight * sourceValue * quant;
            finalSumQ2 += weight * quant * quant;
          }
        }
      }
    }
    if (finalSumQ2 > 0.0) store<f32>(rowDestination, finalSumQx / finalSumQ2);
  }
}

export function dequantize_iq2_kt(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 68;
  ktEnsureValues(2, false);
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = src + usize(row * rowSize);
    const rowDestination = row * n_per_row;
    const d = load<f32>(rowSource);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + usize(4 + block * 68);
      for (let half: u32 = 0; half < 4; half++) {
        const scaleByte = u32(load<u8>(blockSource + usize(half)));
        const scaleLow = d * f32(i32(scaleByte & 15) - 8);
        const scaleHigh = d * f32(i32(scaleByte >> 4) - 8);
        const outputLow = rowDestination + block * 256 + half * 32;
        const outputHigh = outputLow + 128;
        for (let group: u32 = 0; group < 4; group++) {
          const lowIndex = u32(load<u16>(blockSource + usize(4 + 2 * (half * 4 + group))));
          const highIndex = u32(load<u16>(blockSource + usize(4 + 2 * (16 + half * 4 + group))));
          const lowOutput = outputLow + group * 8;
          const highOutput = outputHigh + group * 8;
          for (let lane: u32 = 0; lane < 8; lane++) {
            writeF32(dst, lowOutput + lane, scaleLow * ktValue(2, false, lowIndex, lane));
            writeF32(dst, highOutput + lane, scaleHigh * ktValue(2, false, highIndex, lane));
          }
        }
      }
    }
  }
}

export function quantize_iq3_kt(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 100;
  const weights = new StaticArray<f32>(n_per_row);
  const scales = new StaticArray<f32>(blocksPerRow * 8);
  const indices = new StaticArray<u16>(blocksPerRow * 32);
  const qValues = new StaticArray<f32>(n_per_row);
  const best = new StaticArray<u16>(4);
  const fit = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = row * n_per_row;
    const rowDestination = dst + usize(row * rowSize);
    store<f32>(rowDestination, 0.0);
    for (let byte: u32 = 0; byte < blocksPerRow * 100; byte++) store<u8>(rowDestination + usize(4 + byte), 0);
    ktSetWeights(src, rowSource, n_per_row, weights);

    let amaxRow: f32 = 0.0;
    for (let element: u32 = 0; element < n_per_row; element++) {
      const magnitude = absF32(readF32(src, rowSource + element));
      if (magnitude > amaxRow) amaxRow = magnitude;
    }
    if (amaxRow == 0.0) continue;
    let amaxScale: f32 = 0.0;
    let maxScale: f32 = 0.0;

    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const subBlockSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        let amax: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const magnitude = absF32(readF32(src, subBlockSource + lane));
          if (magnitude > amax) amax = magnitude;
        }
        const scaleIndex = block * 8 + subBlock;
        const indexStart = scaleIndex * 4;
        if (amax < 1.0e-16) {
          scales[i32(scaleIndex)] = 0.0;
          for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = 0;
          continue;
        }
        const scale0 = 123.0 * amax / amaxRow > 84.0 ? 123.0 * amax / amaxRow : 84.0;
        let bestScore: f32 = 0.0;
        for (let attempt: i32 = -3; attempt <= 3; attempt++) {
          const denominator = scale0 + 8.0 * f32(attempt);
          ktFindBestMatch(3, false, src, subBlockSource, weights, weightStart, f32(amax / denominator), best);
          ktFindBestScale(3, false, src, subBlockSource, weights, weightStart, best, fit);
          if (fit[1] > bestScore) {
            bestScore = fit[1];
            scales[i32(scaleIndex)] = fit[0];
            for (let group: u32 = 0; group < 4; group++) indices[i32(indexStart + group)] = best[i32(group)];
          }
        }
        for (let group: u32 = 0; group < 4; group++) {
          const valueIndex = u32(indices[i32(indexStart + group)]);
          for (let lane: u32 = 0; lane < 8; lane++) {
            qValues[i32(weightStart + group * 8 + lane)] = ktValue(3, false, valueIndex, lane);
          }
        }
        const magnitude = absF32(scales[i32(scaleIndex)]);
        if (magnitude > amaxScale) {
          amaxScale = magnitude;
          maxScale = scales[i32(scaleIndex)];
        }
      }
    }

    let d = maxScale / 15.0;
    let bestScore: f32 = 0.0;
    for (let attempt: i32 = -9; attempt <= 9; attempt++) {
      const inverseScale = (f32(attempt) * 0.2 + 15.0) / maxScale;
      let sumQx: f32 = 0.0;
      let sumQ2: f32 = 0.0;
      for (let block: u32 = 0; block < blocksPerRow; block++) {
        const blockSource = rowSource + block * 256;
        for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
          const scaleIndex = block * 8 + subBlock;
          let scaleLevel = ktNearestInt(f32(inverseScale * scales[i32(scaleIndex)]));
          scaleLevel = clampQuant(scaleLevel, 0, 15);
          const groupSource = blockSource + subBlock * 32;
          for (let lane: u32 = 0; lane < 32; lane++) {
            const sourceValue = absF32(readF32(src, groupSource + lane));
            const weight = weights[i32(scaleIndex * 32 + lane)];
            const quant = f32(scaleLevel) * qValues[i32(scaleIndex * 32 + lane)];
            sumQx += weight * sourceValue * quant;
            sumQ2 += weight * quant * quant;
          }
        }
      }
      if (sumQ2 > 0.0 && sumQx * sumQx > bestScore * sumQ2) {
        d = sumQx / sumQ2;
        bestScore = d * sumQx;
      }
    }

    store<f32>(rowDestination, d);
    const inverseD = d != 0.0 ? f32(1.0) / d : 0.0;
    let finalSumQx: f32 = 0.0;
    let finalSumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 100);
      for (let half: u32 = 0; half < 4; half++) {
        let lowLevel = ktNearestInt(f32(inverseD * scales[block * 8 + half]));
        let highLevel = ktNearestInt(f32(inverseD * scales[block * 8 + half + 4]));
        lowLevel = clampQuant(lowLevel, 0, 15);
        highLevel = clampQuant(highLevel, 0, 15);
        store<u8>(blockDestination + usize(half), u8(lowLevel | (highLevel << 4)));
      }
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const groupSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        const scaleByte = load<u8>(blockDestination + usize(subBlock % 4));
        const scaleLevel = subBlock < 4 ? u32(scaleByte & 15) : u32(scaleByte >> 4);
        const blockScale = d * f32(scaleLevel);
        ktFindBestMatch(3, false, src, groupSource, weights, weightStart, blockScale, best);
        for (let lane: u32 = 0; lane < 32; lane++) {
          if (readF32(src, groupSource + lane) < 0.0) {
            const signAddress = blockDestination + usize(68 + lane);
            store<u8>(signAddress, load<u8>(signAddress) | u8(u32(1) << i32(subBlock)));
          }
        }
        for (let group: u32 = 0; group < 4; group++) {
          const valueIndex = u32(best[i32(group)]);
          store<u16>(blockDestination + usize(4 + 2 * (subBlock * 4 + group)), valueIndex);
          for (let lane: u32 = 0; lane < 8; lane++) {
            const sourceValue = absF32(readF32(src, groupSource + group * 8 + lane));
            const weight = weights[i32(weightStart + group * 8 + lane)];
            const quant = f32(scaleLevel) * ktValue(3, false, valueIndex, lane);
            finalSumQx += weight * sourceValue * quant;
            finalSumQ2 += weight * quant * quant;
          }
        }
      }
    }
    if (finalSumQ2 > 0.0) store<f32>(rowDestination, finalSumQx / finalSumQ2);
  }
}

export function dequantize_iq3_kt(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 100;
  ktEnsureValues(3, false);
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = src + usize(row * rowSize);
    const rowDestination = row * n_per_row;
    const d = load<f32>(rowSource);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + usize(4 + block * 100);
      for (let half: u32 = 0; half < 4; half++) {
        const scaleByte = u32(load<u8>(blockSource + usize(half)));
        const scaleLow = d * f32(scaleByte & 15);
        const scaleHigh = d * f32(scaleByte >> 4);
        const outputLow = rowDestination + block * 256 + half * 32;
        const outputHigh = outputLow + 128;
        for (let group: u32 = 0; group < 4; group++) {
          const lowIndex = u32(load<u16>(blockSource + usize(4 + 2 * (half * 4 + group))));
          const highIndex = u32(load<u16>(blockSource + usize(4 + 2 * (16 + half * 4 + group))));
          const lowOutput = outputLow + group * 8;
          const highOutput = outputHigh + group * 8;
          const lowMask = u32(1) << i32(half);
          const highMask = u32(1) << i32(half + 4);
          for (let lane: u32 = 0; lane < 8; lane++) {
            const lowSign = (u32(load<u8>(blockSource + usize(68 + group * 8 + lane))) & lowMask) != 0;
            const highSign = (u32(load<u8>(blockSource + usize(68 + group * 8 + lane))) & highMask) != 0;
            const lowValue = scaleLow * ktValue(3, false, lowIndex, lane);
            const highValue = scaleHigh * ktValue(3, false, highIndex, lane);
            writeF32(dst, lowOutput + lane, lowSign ? -lowValue : lowValue);
            writeF32(dst, highOutput + lane, highSign ? -highValue : highValue);
          }
        }
      }
    }
  }
}

export function quantize_iq4_kt(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 128;
  const weights = new StaticArray<f32>(n_per_row);
  const scales = new StaticArray<f32>(blocksPerRow * 8);
  const modes = new StaticArray<u8>(blocksPerRow * 8);
  const positive = new StaticArray<u16>(8);
  const negative = new StaticArray<u16>(8);
  const best = new StaticArray<u16>(8);
  const fit = new StaticArray<f32>(2);
  const fitSecond = new StaticArray<f32>(2);

  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = row * n_per_row;
    const rowDestination = dst + usize(row * rowSize);
    store<f32>(rowDestination, 0.0);
    for (let byte: u32 = 0; byte < blocksPerRow * 128; byte++) store<u8>(rowDestination + usize(4 + byte), 0);
    ktSetWeights(src, rowSource, n_per_row, weights);

    let amaxRow: f32 = 0.0;
    for (let element: u32 = 0; element < n_per_row; element++) {
      const magnitude = absF32(readF32(src, rowSource + element));
      if (magnitude > amaxRow) amaxRow = magnitude;
    }
    if (amaxRow == 0.0) continue;
    let amaxScale: f32 = 0.0;
    let maxScale: f32 = 0.0;

    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const subBlockSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        let amax: f32 = 0.0;
        for (let lane: u32 = 0; lane < 32; lane++) {
          const magnitude = absF32(readF32(src, subBlockSource + lane));
          if (magnitude > amax) amax = magnitude;
        }
        const scaleIndex = block * 8 + subBlock;
        if (amax < 1.0e-16) {
          scales[i32(scaleIndex)] = 0.0;
          modes[i32(scaleIndex)] = 0;
          continue;
        }
        const scale0 = 124.0 * amax / amaxRow > 90.0 ? 124.0 * amax / amaxRow : 90.0;
        let bestScore: f32 = 0.0;
        modes[i32(scaleIndex)] = 0;
        for (let attempt: i32 = -2; attempt <= 2; attempt++) {
          const denominator = scale0 + 8.0 * f32(attempt);
          ktFindBestMatch(4, false, src, subBlockSource, weights, weightStart, f32(amax / denominator), positive);
          ktFindBestScale(4, false, src, subBlockSource, weights, weightStart, positive, fit);
          if (fit[1] > bestScore) {
            bestScore = fit[1];
            scales[i32(scaleIndex)] = fit[0];
          }
          ktFindBestMatch(4, false, src, subBlockSource, weights, weightStart, f32(-amax / denominator), negative);
          ktFindBestScale(4, false, src, subBlockSource, weights, weightStart, negative, fitSecond);
          if (fitSecond[1] > bestScore) {
            bestScore = fitSecond[1];
            scales[i32(scaleIndex)] = fitSecond[0];
          }
        }
        ktFindBestMatch(4, true, src, subBlockSource, weights, weightStart, scales[i32(scaleIndex)], positive);
        ktFindBestScale(4, true, src, subBlockSource, weights, weightStart, positive, fit);
        if (fit[1] > bestScore) {
          scales[i32(scaleIndex)] = fit[0];
          modes[i32(scaleIndex)] = 1;
        }
        let withOffset = false;
        for (let attempt: i32 = -2; attempt <= 2; attempt++) {
          const denominator = scale0 + 8.0 * f32(attempt);
          ktFindBestMatch(4, true, src, subBlockSource, weights, weightStart, f32(amax / denominator), positive);
          ktFindBestScale(4, true, src, subBlockSource, weights, weightStart, positive, fit);
          ktFindBestMatch(4, true, src, subBlockSource, weights, weightStart, f32(-amax / denominator), negative);
          ktFindBestScale(4, true, src, subBlockSource, weights, weightStart, negative, fitSecond);
          if (fit[1] > bestScore || fitSecond[1] > bestScore) {
            withOffset = true;
            if (fit[1] > fitSecond[1]) {
              bestScore = fit[1];
              scales[i32(scaleIndex)] = fit[0];
            } else {
              bestScore = fitSecond[1];
              scales[i32(scaleIndex)] = fitSecond[0];
            }
          }
        }
        if (withOffset) modes[i32(scaleIndex)] = 1;
        const magnitude = absF32(scales[i32(scaleIndex)]);
        if (magnitude > amaxScale) {
          amaxScale = magnitude;
          maxScale = scales[i32(scaleIndex)];
        }
      }
    }

    let d = -maxScale / 64.0;
    store<f32>(rowDestination, d);
    if (d == 0.0) continue;
    const inverseD = f32(1.0) / d;
    let finalSumQx: f32 = 0.0;
    let finalSumQ2: f32 = 0.0;
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + block * 256;
      const blockDestination = rowDestination + usize(4 + block * 128);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const scaleIndex = block * 8 + subBlock;
        let scaleLevel = ktNearestInt(f32(inverseD * scales[i32(scaleIndex)]));
        if (scaleLevel > 63) scaleLevel = 63;
        const scaleWord = u32(u32(scaleLevel + 64) << 1) | u32(modes[i32(scaleIndex)] & 1);
        store<u32>(blockDestination + usize(4 * subBlock), scaleWord);
      }
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const groupSource = blockSource + subBlock * 32;
        const weightStart = block * 256 + subBlock * 32;
        const scaleWordAddress = blockDestination + usize(4 * subBlock);
        const scaleWord = load<u32>(scaleWordAddress);
        const offsetMode = (scaleWord & 1) != 0;
        const scaleLevel = i32((scaleWord & 0xff) >> 1) - 64;
        const blockScale = d * f32(scaleLevel);
        ktFindBestMatch(4, offsetMode, src, groupSource, weights, weightStart, blockScale, best);
        for (let group: u32 = 0; group < 8; group++) {
          const valueIndex = u32(best[i32(group)]);
          const qlAddress = blockDestination + usize(32 + subBlock * 8 + group);
          store<u8>(qlAddress, u8(valueIndex & 0xff));
          const highIndex = subBlock * 8 + group;
          const qhAddress = blockDestination + usize(96 + (highIndex % 32));
          store<u8>(qhAddress, load<u8>(qhAddress) | u8(((valueIndex >> 8) & 15) << i32(4 * (highIndex / 32))));
          store<u32>(scaleWordAddress, load<u32>(scaleWordAddress) |
            u32((valueIndex >> 12) << i32(8 + 3 * group)));
          for (let lane: u32 = 0; lane < 4; lane++) {
            const sourceValue = readF32(src, groupSource + group * 4 + lane);
            const weight = weights[i32(weightStart + group * 4 + lane)];
            const quant = f32(scaleLevel) * ktValue(4, offsetMode, valueIndex, lane);
            finalSumQx += weight * sourceValue * quant;
            finalSumQ2 += weight * quant * quant;
          }
        }
      }
    }
    if (finalSumQ2 > 0.0) store<f32>(rowDestination, finalSumQx / finalSumQ2);
  }
}

export function dequantize_iq4_kt(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 256);
  const blocksPerRow = n_per_row / 256;
  const rowSize = 4 + blocksPerRow * 128;
  ktEnsureValues(4, false);
  ktEnsureValues(4, true);
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSource = src + usize(row * rowSize);
    const rowDestination = row * n_per_row;
    const d = load<f32>(rowSource);
    for (let block: u32 = 0; block < blocksPerRow; block++) {
      const blockSource = rowSource + usize(4 + block * 128);
      for (let subBlock: u32 = 0; subBlock < 8; subBlock++) {
        const scaleWord = load<u32>(blockSource + usize(4 * subBlock));
        const offsetMode = (scaleWord & 1) != 0;
        const scaleLevel = i32((scaleWord & 0xff) >> 1) - 64;
        const scale = d * f32(scaleLevel);
        for (let group: u32 = 0; group < 8; group++) {
          const indexPosition = subBlock * 8 + group;
          const low = u32(load<u8>(blockSource + usize(32 + indexPosition)));
          const high = u32(load<u8>(blockSource + usize(96 + (indexPosition % 32))));
          const index = low | ((high << i32(8 - 4 * (indexPosition / 32))) & 0xf00) |
            (((scaleWord >> i32(8 + 3 * group)) & 7) << 12);
          const outputStart = rowDestination + block * 256 + subBlock * 32 + group * 4;
          for (let lane: u32 = 0; lane < 4; lane++) {
            writeF32(dst, outputStart + lane, scale * ktValue(4, offsetMode, index, lane));
          }
        }
      }
    }
  }
}

// OQ64 block: four f32 scales, four packed zero points, then four packed 64-value subblocks.
export function info_oq2_64(): u32 { return packInfo(8, 81, 0); }
export function info_oq4_64(): u32 { return packInfo(8, 146, 0); }
export function info_oq4_c(): u32 { return packInfo(5, 16, 5); }

function oqScaleAndZero(src: FloatPtr, start: u32, count: u32, maxLevel: i32, result: StaticArray<f32>): void {
  let minValue: f32 = 0.0;
  let maxValue: f32 = 0.0;
  for (let index: u32 = 0; index < count; index++) {
    const value = readF32(src, start + index);
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }
  const scale = (maxValue - minValue) / f32(maxLevel);
  result[0] = scale;
  result[1] = scale != 0.0 ? f32(clampQuant(roundNearestEven(-minValue / scale), 0, maxLevel)) : 0.0;
}

function oqQuant(value: f32, inverseScale: f32, zeroPoint: i32, maxLevel: i32): u32 {
  return u32(clampQuant(roundNearestEven(value * inverseScale) + zeroPoint, 0, maxLevel));
}

function quantizeOq64(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32, bits: u32): void {
  const total = rowElementCount(nrows, n_per_row, 256);
  const maxLevel = i32((u32(1) << bits) - 1);
  const zeroBytes = bits / 2;
  const bytesPerSubBlock: u32 = u32(8) * bits;
  const blockSize = 16 + zeroBytes + 4 * bytesPerSubBlock;
  const valuesPerByte: u32 = u32(8) / bits;
  const params = new StaticArray<f32>(2);

  for (let block: u32 = 0; block < total / 256; block++) {
    const blockDst = dst + usize(block * blockSize);
    for (let byte: u32 = 0; byte < zeroBytes; byte++) store<u8>(blockDst + usize(16 + byte), 0);
    for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
      const start = block * 256 + subBlock * 64;
      oqScaleAndZero(src, start, 64, maxLevel, params);
      const scale = params[0];
      const zeroPoint = i32(params[1]);
      const inverseScale: f32 = scale != 0.0 ? f32(1.0) / scale : 0.0;
      store<f32>(blockDst + usize(subBlock * 4), scale);
      const zeroAddress = blockDst + usize(16 + (subBlock * bits / 8));
      store<u8>(zeroAddress, load<u8>(zeroAddress) | u8(u32(zeroPoint) << i32((subBlock * bits) & 7)));

      for (let byte: u32 = 0; byte < bytesPerSubBlock; byte++) {
        let packed: u32 = 0;
        for (let lane: u32 = 0; lane < valuesPerByte; lane++) {
          const value = readF32(src, start + lane * bytesPerSubBlock + byte);
          packed |= oqQuant(value, inverseScale, zeroPoint, maxLevel) << i32(lane * bits);
        }
        store<u8>(blockDst + usize(16 + zeroBytes + subBlock * bytesPerSubBlock + byte), u8(packed));
      }
    }
  }
}

function dequantizeOq64(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32, bits: u32): void {
  const total = rowElementCount(nrows, n_per_row, 256);
  const zeroBytes = bits / 2;
  const bytesPerSubBlock: u32 = u32(8) * bits;
  const blockSize = 16 + zeroBytes + 4 * bytesPerSubBlock;
  const valuesPerByte: u32 = u32(8) / bits;
  const mask = (u32(1) << bits) - 1;

  for (let block: u32 = 0; block < total / 256; block++) {
    const blockSrc = src + usize(block * blockSize);
    for (let subBlock: u32 = 0; subBlock < 4; subBlock++) {
      const scale = load<f32>(blockSrc + usize(subBlock * 4));
      const zeros = u32(load<u8>(blockSrc + usize(16 + subBlock * bits / 8)));
      const zeroPoint = i32((zeros >> i32((subBlock * bits) & 7)) & mask);
      const start = block * 256 + subBlock * 64;
      for (let byte: u32 = 0; byte < bytesPerSubBlock; byte++) {
        const packed = u32(load<u8>(blockSrc + usize(16 + zeroBytes + subBlock * bytesPerSubBlock + byte)));
        for (let lane: u32 = 0; lane < valuesPerByte; lane++) {
          const quant = i32((packed >> i32(lane * bits)) & mask);
          writeF32(dst, start + lane * bytesPerSubBlock + byte, f32(quant - zeroPoint) * scale);
        }
      }
    }
  }
}

export function quantize_oq2_64(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeOq64(src, dst, nrows, n_per_row, 2);
}

export function dequantize_oq2_64(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  dequantizeOq64(src, dst, nrows, n_per_row, 2);
}

export function quantize_oq4_64(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  quantizeOq64(src, dst, nrows, n_per_row, 4);
}

export function dequantize_oq4_64(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  dequantizeOq64(src, dst, nrows, n_per_row, 4);
}

export function quantize_oq4_c(src: FloatPtr, dst: BytePtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 32);
  const rowSize = 5 + n_per_row / 2;
  const params = new StaticArray<f32>(2);
  for (let row: u32 = 0; row < nrows; row++) {
    const rowDst = dst + usize(row * rowSize);
    const start = row * n_per_row;
    oqScaleAndZero(src, start, n_per_row, 15, params);
    const scale = params[0];
    const zeroPoint = i32(params[1]);
    const inverseScale: f32 = scale != 0.0 ? f32(1.0) / scale : 0.0;
    store<f32>(rowDst, scale);
    store<u8>(rowDst + 4, u8(zeroPoint));
    for (let block: u32 = 0; block < n_per_row / 32; block++) {
      const blockStart = start + block * 32;
      for (let byte: u32 = 0; byte < 16; byte++) {
        const low = oqQuant(readF32(src, blockStart + byte), inverseScale, zeroPoint, 15);
        const high = oqQuant(readF32(src, blockStart + 16 + byte), inverseScale, zeroPoint, 15);
        store<u8>(rowDst + usize(5 + block * 16 + byte), u8(low | (high << 4)));
      }
    }
  }
}

export function dequantize_oq4_c(src: BytePtr, dst: FloatPtr, nrows: u32, n_per_row: u32): void {
  requireBlockAligned(n_per_row, 32);
  const rowSize = 5 + n_per_row / 2;
  for (let row: u32 = 0; row < nrows; row++) {
    const rowSrc = src + usize(row * rowSize);
    const start = row * n_per_row;
    const scale = load<f32>(rowSrc);
    const zeroPoint = i32(load<u8>(rowSrc + 4) & 0x0f);
    for (let block: u32 = 0; block < n_per_row / 32; block++) {
      const blockStart = start + block * 32;
      for (let byte: u32 = 0; byte < 16; byte++) {
        const packed = load<u8>(rowSrc + usize(5 + block * 16 + byte));
        writeF32(dst, blockStart + byte, f32(i32(packed & 0x0f) - zeroPoint) * scale);
        writeF32(dst, blockStart + 16 + byte, f32(i32(packed >> 4) - zeroPoint) * scale);
      }
    }
  }
}
