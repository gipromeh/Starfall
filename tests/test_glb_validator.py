import json, struct, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.validate_glb import validate, read_glb, ValidationError

def make_glb(doc, payload=b"\x00\x00\x00\x00"):
    raw=json.dumps(doc,separators=(",",":")).encode()
    raw+=b" "*((4-len(raw)%4)%4)
    payload+=b"\x00"*((4-len(payload)%4)%4)
    chunks=struct.pack("<I4s",len(raw),b"JSON")+raw
    if payload: chunks+=struct.pack("<I4s",len(payload),b"BIN\x00")+payload
    return struct.pack("<4sII",b"glTF",2,12+len(chunks))+chunks

class GLBValidatorTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.path=Path(self.tmp.name)/"fixture.glb"
        self.doc={"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":"ROOT","children":[1]},{"name":"GUN_0","translation":[0,0,-1]}],"meshes":[],"materials":[],"buffers":[{"byteLength":4}],"bufferViews":[],"accessors":[]}
    def tearDown(self): self.tmp.cleanup()
    def write(self,doc=None,data=None): self.path.write_bytes(data if data is not None else make_glb(doc or self.doc))
    def test_valid_minimal_glb(self):
        self.write(); self.assertEqual(validate(self.path)["result"],"PASS")
    def test_detects_wrong_magic(self):
        self.write(data=b"NOPE"+b"\x00"*20)
        with self.assertRaises(ValidationError): validate(self.path)
    def test_detects_external_buffer(self):
        d=json.loads(json.dumps(self.doc));d["buffers"][0]["uri"]="external.bin";self.write(d)
        self.assertTrue(any("external URI" in x for x in validate(self.path)["errors"]))
    def test_detects_duplicate_node_names(self):
        d=json.loads(json.dumps(self.doc));d["nodes"].append({"name":"GUN_0"});self.write(d)
        self.assertTrue(any("duplicate node name" in x for x in validate(self.path)["errors"]))
    def test_detects_invalid_child_index(self):
        d=json.loads(json.dumps(self.doc));d["nodes"][0]["children"]=[99];self.write(d)
        self.assertTrue(any("child index" in x for x in validate(self.path)["errors"]))
    def test_marker_inventory(self):
        self.write();self.assertIn("GUN_0",validate(self.path)["markers"])
    def test_truncated_chunk(self):
        self.write(data=struct.pack("<4sII",b"glTF",2,40)+b"\x00"*8)
        with self.assertRaises(ValidationError): validate(self.path)

if __name__=="__main__": unittest.main()
