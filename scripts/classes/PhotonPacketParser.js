const EventEmitter = require('node:events');

// Albion's current traffic uses Photon Protocol18 (GpBinaryV18), whose compact
// type codes and lengths differ from the old Protocol16 deserializer.
class Reader {
  constructor(buffer) { this.buffer = Buffer.from(buffer); this.offset = 0; }
  get remaining() { return this.buffer.length - this.offset; }
  ensure(size) { if (!Number.isInteger(size) || size < 0 || size > this.remaining) throw new Error(`Truncated Protocol18 value at ${this.offset} (need ${size}, have ${this.remaining})`); }
  byte() { this.ensure(1); return this.buffer[this.offset++]; }
  bytes(size) { this.ensure(size); const out = this.buffer.subarray(this.offset, this.offset + size); this.offset += size; return out; }
  u16le() { this.ensure(2); const n = this.buffer.readUInt16LE(this.offset); this.offset += 2; return n; }
  i16le() { this.ensure(2); const n = this.buffer.readInt16LE(this.offset); this.offset += 2; return n; }
  f32le() { this.ensure(4); const n = this.buffer.readFloatLE(this.offset); this.offset += 4; return n; }
  f64le() { this.ensure(8); const n = this.buffer.readDoubleLE(this.offset); this.offset += 8; return n; }
  varuint(maxBits = 64) {
    let value = 0n, shift = 0n;
    while (shift < BigInt(maxBits)) {
      const b = this.byte();
      value |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return value;
      shift += 7n;
    }
    throw new Error(`Invalid Protocol18 varint at ${this.offset}`);
  }
  count() {
    const n = this.varuint(32);
    if (n > 65536n) throw new Error(`Protocol18 collection is too large: ${n}`);
    return Number(n);
  }
  vint32() { const v = this.varuint(32); return Number((v >> 1n) ^ BigInt.asUintN(32, -(v & 1n))); }
  vint64() { const v = this.varuint(64); return (v >> 1n) ^ BigInt.asUintN(64, -(v & 1n)); }
  string() { const size = this.count(); return this.bytes(size).toString('utf8'); }
}

const T = {
  unknown: 0, boolean: 2, byte: 3, short: 4, float: 5, double: 6,
  string: 7, null: 8, compressedInt: 9, compressedLong: 10,
  int1: 11, int1Neg: 12, int2: 13, int2Neg: 14,
  long1: 15, long1Neg: 16, long2: 17, long2Neg: 18,
  custom: 19, dictionary: 20, hashtable: 21, objectArray: 23,
  operationRequest: 24, operationResponse: 25, eventData: 26,
  boolFalse: 27, boolTrue: 28, shortZero: 29, intZero: 30,
  longZero: 31, floatZero: 32, doubleZero: 33, byteZero: 34, array: 0x40,
  customSlimBase: 0x80,
};

function jsonSafeObject(entries) {
  const out = {};
  for (const [key, value] of entries) out[key] = value;
  return out;
}

function deserializeCustom(reader, typeCode) {
  if (typeCode < T.customSlimBase) reader.byte(); // custom type id
  const size = reader.count();
  return Array.from(reader.bytes(size));
}

function deserializeArray(reader, elementType, size) {
  if (size > 65536) throw new Error(`Protocol18 array is too large: ${size}`);
  if (elementType === T.boolean) {
    const packed = reader.bytes(Math.ceil(size / 8));
    return Array.from({ length: size }, (_, i) => (packed[i >> 3] & (1 << (i & 7))) !== 0);
  }
  if (elementType === T.byte) return Array.from(reader.bytes(size));
  const readOne = () => deserialize(reader, elementType);
  return Array.from({ length: size }, readOne);
}

function deserializeTypedArray(reader, typeCode) {
  const size = reader.count();
  if (typeCode === T.custom) {
    reader.byte(); // shared custom type id
    return Array.from({ length: size }, () => deserializeCustom(reader, T.customSlimBase));
  }
  return deserializeArray(reader, typeCode, size);
}

function deserializeDictionary(reader) {
  const keyType = reader.byte();
  const valueType = reader.byte();
  const size = reader.count();
  const entries = [];
  for (let i = 0; i < size; i++) {
    const kt = keyType === T.unknown ? reader.byte() : keyType;
    const vt = valueType === T.unknown ? reader.byte() : valueType;
    entries.push([deserialize(reader, kt), deserialize(reader, vt)]);
  }
  return jsonSafeObject(entries.map(([key, value]) => [String(key), value]));
}

function parameterTable(reader) {
  const size = reader.count();
  const params = {};
  for (let i = 0; i < size; i++) {
    const key = reader.byte();
    params[key] = deserialize(reader, reader.byte());
  }
  return params;
}

function deserialize(reader, typeCode) {
  if (typeCode >= T.customSlimBase) return deserializeCustom(reader, typeCode);
  switch (typeCode) {
    case T.unknown: case T.null: return null;
    case T.boolean: return reader.byte() !== 0;
    case T.byte: return reader.byte();
    case T.short: return reader.i16le();
    case T.float: return reader.f32le();
    case T.double: return reader.f64le();
    case T.string: return reader.string();
    case T.compressedInt: return reader.vint32();
    case T.compressedLong: return reader.vint64();
    case T.int1: return reader.byte();
    case T.int1Neg: return -reader.byte();
    case T.int2: return reader.u16le();
    case T.int2Neg: return -reader.u16le();
    case T.long1: return BigInt(reader.byte());
    case T.long1Neg: return -BigInt(reader.byte());
    case T.long2: return BigInt(reader.u16le());
    case T.long2Neg: return -BigInt(reader.u16le());
    case T.custom: return deserializeCustom(reader, typeCode);
    case T.dictionary: case T.hashtable: return deserializeDictionary(reader);
    case T.objectArray: return Array.from({ length: reader.count() }, () => deserialize(reader, reader.byte()));
    case T.operationRequest: return deserializeOperationRequest(reader);
    case T.operationResponse: return deserializeOperationResponse(reader);
    case T.eventData: return deserializeEvent(reader);
    case T.boolFalse: return false;
    case T.boolTrue: return true;
    case T.shortZero: return 0;
    case T.intZero: return 0;
    case T.longZero: return 0n;
    case T.floatZero: return 0;
    case T.doubleZero: return 0;
    case T.byteZero: return 0;
    case T.array: {
      const size = reader.count();
      return deserializeArray(reader, reader.byte(), size);
    }
    default:
      if ((typeCode & T.array) !== 0) return deserializeTypedArray(reader, typeCode & ~T.array);
      throw new Error(`Protocol18 type code 0x${typeCode.toString(16)} is not implemented`);
  }
}

function deserializeEvent(reader) {
  const code = reader.byte();
  return { code, parameters: parameterTable(reader) };
}

function deserializeOperationRequest(reader) {
  const operationCode = reader.byte();
  return { operationCode, parameters: parameterTable(reader) };
}

function deserializeOperationResponse(reader) {
  const operationCode = reader.byte();
  const returnCode = reader.i16le();
  const debugType = reader.byte();
  const debugValue = deserialize(reader, debugType);
  const parameters = parameterTable(reader);
  if (Array.isArray(debugValue) && debugValue.every((x) => typeof x === 'string')) parameters[0] = debugValue;
  return { operationCode, returnCode, debugMessage: typeof debugValue === 'string' ? debugValue : '', parameters };
}

function decodeMessage(messageType, data, parent) {
  if (messageType === 131) return; // encrypted payload; no plaintext decode available here
  if (![2, 3, 4, 7].includes(messageType)) return;
  const reader = new Reader(data);
  if (messageType === 2) {
    const request = deserializeOperationRequest(reader);
    if (!Object.hasOwn(request.parameters, 253)) request.parameters[253] = request.operationCode;
    parent.emit('request', request);
  } else if (messageType === 3 || messageType === 7) {
    const response = deserializeOperationResponse(reader);
    if (!Object.hasOwn(response.parameters, 253)) response.parameters[253] = response.operationCode;
    parent.emit('response', response);
  } else {
    const event = deserializeEvent(reader);
    if (!Object.hasOwn(event.parameters, 252)) event.parameters[252] = event.code;
    if (event.code === 3 && Array.isArray(event.parameters[1]) && event.parameters[1].length >= 17 && event.parameters[1][0] === 3) {
      const bytes = Buffer.from(event.parameters[1]);
      const x = bytes.readFloatLE(9);
      const y = bytes.readFloatLE(13);
      if (Number.isFinite(x) && Number.isFinite(y)) { event.parameters[4] = x; event.parameters[5] = y; }
    }
    parent.emit('event', event);
  }
}

class PhotonPacketParser extends EventEmitter {
  constructor() { super(); this.pendingSegments = new Map(); }

  handle(payload) {
    const packet = Buffer.from(payload);
    if (packet.length < 12) throw new Error(`Photon payload is shorter than 12 bytes (${packet.length})`);
    const flags = packet[2];
    if (flags === 1) return;
    const commandCount = packet[3];
    let offset = 12;
    for (let i = 0; i < commandCount; i++) offset = this.handleCommand(packet, offset);
  }

  handleCommand(packet, offset) {
    if (offset + 12 > packet.length) throw new Error('Truncated Photon command header');
    const commandType = packet[offset];
    // Photon command header has a reserved byte after the flags, then the
    // 32-bit command length and sequence number.
    const commandLength = packet.readUInt32BE(offset + 4);
    const end = offset + commandLength;
    if (commandLength < 12 || end > packet.length) throw new Error(`Invalid Photon command length ${commandLength}`);
    let dataOffset = offset + 12;
    let dataLength = commandLength - 12;
    if (commandType === 4) return end;
    if (commandType === 7) {
      if (dataLength < 4) return end;
      dataOffset += 4;
      dataLength -= 4;
    }
    if (commandType === 6 || commandType === 7) {
      if (dataLength < 2) return end;
      const messageType = packet[dataOffset + 1];
      const body = packet.subarray(dataOffset + 2, dataOffset + dataLength);
      decodeMessage(messageType, body, this);
    } else if (commandType === 8) {
      this.handleFragment(packet.subarray(dataOffset, dataOffset + dataLength));
    }
    return end;
  }

  handleFragment(data) {
    if (data.length < 20) throw new Error('Truncated Photon fragment header');
    const sequence = data.readUInt32BE(0);
    const totalLength = data.readUInt32BE(12);
    const fragmentOffset = data.readUInt32BE(16);
    const fragment = data.subarray(20);
    if (totalLength > 1048576 || fragmentOffset + fragment.length > totalLength) throw new Error('Invalid Photon fragment bounds');
    let state = this.pendingSegments.get(sequence);
    if (!state) { state = { buffer: Buffer.alloc(totalLength), seen: new Set(), written: 0, total: totalLength }; this.pendingSegments.set(sequence, state); }
    if (!state.seen.has(fragmentOffset)) { fragment.copy(state.buffer, fragmentOffset); state.seen.add(fragmentOffset); state.written += fragment.length; }
    if (state.written >= state.total) {
      this.pendingSegments.delete(sequence);
      if (state.buffer.length >= 2) decodeMessage(state.buffer[1], state.buffer.subarray(2), this);
    }
  }
}

module.exports = PhotonPacketParser;
