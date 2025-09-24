import { readU8, readPk } from '../consts';
const bs58 = require('bs58');
const toHex = (b: Buffer) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function decodePrintrInit(base58Data: string) {
  const raw = Buffer.from(bs58.default.decode(base58Data));
  if (raw.length < 16) throw new Error('Data too short');
  const payload = raw.subarray(16); // skip ix + event discriminators

  let o = 0;

  // 1) protocolVersion (u8)
  const protocolVersion = readU8(payload, o);
  o += 1;

  // 2) printrTokenId: variable-length bytes (whatever remains before the 2 pubkeys)
  //    Two trailing pubkeys = 64 bytes total.
  const tokenIdLen = payload.length - o - 64;
  if (tokenIdLen < 0) throw new Error('Malformed payload (too short for two pubkeys)');
  const printrTokenIdBytes = payload.subarray(o, o + tokenIdLen);
  const printrTokenId = toHex(printrTokenIdBytes);
  o += tokenIdLen;

  // 3) quoteMint (Pubkey), 4) creatorOnSolana (Pubkey)
  const quoteMint = readPk(payload, o);
  o += 32;
  const creatorOnSolana = readPk(payload, o);
  o += 32;

  return {
    protocolVersion,
    printrTokenIdHex: printrTokenId, // hex string of the raw token id bytes
    quoteMint,
    creatorOnSolana,
  };
}
