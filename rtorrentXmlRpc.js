// Minimal XML-RPC request builder + response parser for rTorrent/ruTorrent's httprpc plugin
// (plugins/httprpc/action.php) — confirmed via ruTorrent's real source (Novik/ruTorrent) to
// forward genuine XML-RPC over SCGI to the rTorrent daemon when the POST body isn't ruTorrent's
// own private urlencoded UI protocol. Only the subset actually needed here is supported: string,
// int/i4, boolean, base64, and array param/return values — rTorrent's d.*/load.*/system.* calls
// never need structs, so that XML-RPC type is intentionally not implemented.
const { XMLParser } = require('fast-xml-parser');

// parseTagValue: false is load-bearing, not stylistic — an all-digit torrent hash inside
// <string> would otherwise get auto-coerced to a JS number by fast-xml-parser's default numeric
// detection, silently losing precision (e.g. a 40-digit hash collapsing into "1.23e+39"). Typed
// XML-RPC values (<int>, <i4>, ...) are still converted explicitly and deliberately in parseValue.
const rpcParser = new XMLParser({ isArray: (name) => name === 'value', parseTagValue: false });

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Base64 content (e.g. a .torrent file's raw bytes for load.raw_start) needs the XML-RPC
// <base64> type, not <string> — the base64 alphabet itself never contains XML metacharacters,
// so it's safe to embed directly with no escaping.
function base64Value(base64) {
  return { __xmlrpcBase64: base64 };
}

function buildValue(v) {
  if (v != null && typeof v === 'object' && '__xmlrpcBase64' in v) return `<value><base64>${v.__xmlrpcBase64}</base64></value>`;
  if (typeof v === 'number') return `<value><i4>${Math.trunc(v)}</i4></value>`;
  if (typeof v === 'boolean') return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  return `<value><string>${xmlEscape(v)}</string></value>`;
}

function buildMethodCall(methodName, params = []) {
  const paramsXml = params.map((p) => `<param>${buildValue(p)}</param>`).join('');
  return `<?xml version="1.0"?><methodCall><methodName>${xmlEscape(methodName)}</methodName><params>${paramsXml}</params></methodCall>`;
}

// `isArray: name === 'value'` forces every <value> occurrence into an array wrapper (needed so a
// 1-torrent multicall response doesn't collapse into a bare object instead of an array) — this
// node itself is one of those forced 1-element arrays, so callers pass node[0].
function parseValue(node) {
  if (node == null) return null;
  const v = Array.isArray(node) ? node[0] : node;
  if (v == null || typeof v !== 'object') return v == null ? '' : String(v);
  if ('string' in v) return v.string === true ? '' : String(v.string);
  if ('int' in v) return Number(v.int);
  if ('i4' in v) return Number(v.i4);
  // rTorrent's own byte-count fields (d.size_bytes, d.down.rate, ...) have historically returned
  // i8 for values that could exceed a 32-bit int — not part of the base XML-RPC spec, but real.
  if ('i8' in v) return Number(v.i8);
  if ('boolean' in v) return v.boolean === 1 || v.boolean === '1' || v.boolean === true;
  if ('double' in v) return Number(v.double);
  if ('base64' in v) return v.base64 === true ? '' : String(v.base64);
  if ('array' in v) {
    const items = v.array?.data?.value;
    if (items === undefined) return [];
    return (Array.isArray(items) ? items : [items]).map((item) => parseValue([item]));
  }
  return '';
}

/** Parses a raw methodResponse/fault XML-RPC body into { value } or { fault: { code, message } }. */
function parseMethodResponse(xmlText) {
  const parsed = rpcParser.parse(xmlText);
  const resp = parsed?.methodResponse;
  if (!resp) return { fault: { code: 0, message: 'Malformed XML-RPC response' } };
  if (resp.fault) {
    const faultStruct = resp.fault.value?.[0]?.struct;
    const members = faultStruct ? (Array.isArray(faultStruct.member) ? faultStruct.member : [faultStruct.member]) : [];
    const get = (name) => members.find((m) => m?.name === name)?.value;
    return { fault: { code: Number(parseValue(get('faultCode'))) || 0, message: String(parseValue(get('faultString')) || 'Unknown fault') } };
  }
  return { value: parseValue(resp.params?.param?.value) };
}

module.exports = { buildMethodCall, parseMethodResponse, base64Value };
