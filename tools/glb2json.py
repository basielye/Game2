"""Convert .glb files to JSON glTF with the binary chunk embedded as a base64 data URI (for hosts that only serve .json).
Usage: python3 tools/glb2json.py <in.glb> <out.json>"""
import base64, json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
magic, ver, total = struct.unpack('<III', b[:12])
assert magic == 0x46546C67, 'not a GLB'
off, doc, binc = 12, None, b''
while off < total:
    ln, typ = struct.unpack('<II', b[off:off + 8])
    chunk = b[off + 8:off + 8 + ln]
    if typ == 0x4E4F534A: doc = json.loads(chunk)
    elif typ == 0x004E4942: binc = chunk
    off += 8 + ln
if binc:
    doc['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
json.dump(doc, open(dst, 'w'), separators=(',', ':'))
