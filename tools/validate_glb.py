#!/usr/bin/env python3
"""STARFALL GLB structural validator. Standard library only."""
from __future__ import annotations
import argparse, hashlib, json, math, struct, sys
from pathlib import Path

PROFILES = {
    "ship": {"max_triangles": 9000, "max_meshes": 12, "max_materials": 3, "max_texture": 2048, "max_file_mb": 5},
    "generic": {"max_triangles": 250000, "max_meshes": 500, "max_materials": 64, "max_texture": 8192, "max_file_mb": 100},
}
MARKER_PREFIXES = ("GUN_", "MUZZLE_", "WEAPON_", "LASER_", "CANNON_", "ENG_", "ENGINE_", "THRUSTER_", "EXHAUST_", "NOZZLE_")

class ValidationError(Exception): pass

def read_glb(path: Path):
    data = path.read_bytes()
    if len(data) < 20: raise ValidationError("GLB header/chunks truncated")
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF": raise ValidationError("invalid GLB magic")
    if version != 2: raise ValidationError(f"unsupported GLB version: {version}")
    if total != len(data): raise ValidationError(f"header length {total} != file length {len(data)}")
    offset, doc, bin_chunk = 12, None, None
    while offset < len(data):
        if offset + 8 > len(data): raise ValidationError("truncated chunk header")
        size, kind = struct.unpack_from("<I4s", data, offset); offset += 8
        if size % 4: raise ValidationError("chunk size is not 4-byte aligned")
        if offset + size > len(data): raise ValidationError("chunk exceeds file")
        payload = data[offset:offset+size]; offset += size
        if kind == b"JSON":
            if doc is not None: raise ValidationError("multiple JSON chunks")
            try: doc = json.loads(payload.decode("utf-8").rstrip(" \t\r\n\0"))
            except Exception as e: raise ValidationError(f"invalid JSON chunk: {e}")
        elif kind == b"BIN\x00":
            if bin_chunk is not None: raise ValidationError("multiple BIN chunks")
            bin_chunk = payload
    if doc is None: raise ValidationError("missing JSON chunk")
    if doc.get("asset", {}).get("version") != "2.0": raise ValidationError("asset.version must be 2.0")
    return doc, bin_chunk, data

def validate(path: Path, category="generic", config_path=None):
    if category not in PROFILES: raise ValidationError(f"unknown category profile: {category}")
    profile = dict(PROFILES[category])
    cfg = {}
    if config_path:
        cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
        budget = cfg.get("budget", {})
        profile["max_triangles"] = int(budget.get("triangles", profile["max_triangles"]))
        if cfg.get("maxFileMB"): profile["max_file_mb"] = float(cfg["maxFileMB"])
    doc, binary, raw = read_glb(path)
    errors, warnings = [], []
    if len(raw) > profile["max_file_mb"] * 1024 * 1024: errors.append(f"file exceeds {profile['max_file_mb']} MB")
    buffers = doc.get("buffers", [])
    if len(buffers) > 1: errors.append("GLB should use one embedded buffer")
    if buffers:
        if binary is None: errors.append("buffer declared but BIN chunk missing")
        elif buffers[0].get("byteLength", 0) > len(binary): errors.append("buffer byteLength exceeds BIN chunk")
    for i, buf in enumerate(buffers):
        if buf.get("uri"): errors.append(f"buffer[{i}] has external URI; self-contained GLB required")
    for i, image in enumerate(doc.get("images", [])):
        if image.get("uri"): errors.append(f"image[{i}] has external URI")
        if "bufferView" in image and image["bufferView"] >= len(doc.get("bufferViews", [])): errors.append(f"image[{i}] bufferView out of range")
    views, accessors = doc.get("bufferViews", []), doc.get("accessors", [])
    for i, view in enumerate(views):
        if view.get("buffer", 0) >= len(buffers): errors.append(f"bufferView[{i}] buffer index out of range")
        if view.get("byteOffset", 0) + view.get("byteLength", 0) > (buffers[view.get("buffer", 0)].get("byteLength", 0) if view.get("buffer", 0) < len(buffers) else 0):
            errors.append(f"bufferView[{i}] exceeds buffer")
    for i, acc in enumerate(accessors):
        if "bufferView" in acc and acc["bufferView"] >= len(views): errors.append(f"accessor[{i}] bufferView out of range")
        if not isinstance(acc.get("count"), int) or acc["count"] < 1: errors.append(f"accessor[{i}] invalid count")
        for field in ("min", "max"):
            vals=acc.get(field, [])
            if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in vals): errors.append(f"accessor[{i}] has non-finite {field}")
    meshes=doc.get("meshes",[]); materials=doc.get("materials",[])
    triangles=0; primitives=0
    for mi, mesh in enumerate(meshes):
        for pi, prim in enumerate(mesh.get("primitives", [])):
            primitives += 1
            idx=prim.get("indices")
            if idx is not None:
                if idx >= len(accessors): errors.append(f"mesh[{mi}].primitive[{pi}] indices accessor out of range")
                else: count=accessors[idx].get("count",0)
            else:
                pos=prim.get("attributes",{}).get("POSITION")
                count=accessors[pos].get("count",0) if isinstance(pos,int) and pos<len(accessors) else 0
            mode=prim.get("mode",4)
            if mode == 4: triangles += count // 3
            elif mode == 5 or mode == 6: triangles += max(0,count-2)
            else: warnings.append(f"mesh[{mi}].primitive[{pi}] is not triangle topology (mode={mode})")
            if prim.get("material") is not None and prim["material"] >= len(materials): errors.append(f"mesh[{mi}] material index out of range")
            for semantic, ai in prim.get("attributes",{}).items():
                if not isinstance(ai,int) or ai<0 or ai>=len(accessors): errors.append(f"mesh[{mi}] invalid accessor for {semantic}")
    if len(meshes)>profile["max_meshes"]: errors.append(f"meshes {len(meshes)} > budget {profile['max_meshes']}")
    if len(materials)>profile["max_materials"]: errors.append(f"materials {len(materials)} > budget {profile['max_materials']}")
    if triangles>profile["max_triangles"]: errors.append(f"triangles {triangles} > budget {profile['max_triangles']}")
    texture_dimensions=[]
    for i, tex in enumerate(doc.get("textures",[])):
        src=tex.get("source")
        if src is not None and src>=len(doc.get("images",[])): errors.append(f"texture[{i}] source out of range")
    for i, image in enumerate(doc.get("images",[])):
        mime=image.get("mimeType")
        if mime not in ("image/png","image/jpeg","image/webp"): warnings.append(f"image[{i}] has unusual/unspecified MIME type")
        dims=None
        if "bufferView" in image and image["bufferView"] < len(views) and binary is not None:
            view=views[image["bufferView"]]; start=view.get("byteOffset",0); payload=binary[start:start+view.get("byteLength",0)]
            if mime=="image/png" and len(payload)>=24 and payload[:8]==b"\\x89PNG\\r\\n\\x1a\\n":
                dims=struct.unpack(">II",payload[16:24])
            elif mime=="image/jpeg" and payload[:2]==b"\\xff\\xd8":
                pos=2
                while pos+9<len(payload):
                    if payload[pos]!=0xff: pos+=1; continue
                    marker=payload[pos+1]; pos+=2
                    if marker in (0xd8,0xd9) or 0xd0<=marker<=0xd7: continue
                    if pos+2>len(payload): break
                    length=int.from_bytes(payload[pos:pos+2],"big")
                    if length<2 or pos+length>len(payload): break
                    if marker in (0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf):
                        dims=(int.from_bytes(payload[pos+5:pos+7],"big"),int.from_bytes(payload[pos+3:pos+5],"big")); break
                    pos+=length
        texture_dimensions.append({"image":i,"width":dims[0],"height":dims[1]} if dims else {"image":i,"width":None,"height":None})
        if dims and max(dims)>profile["max_texture"]: errors.append(f"image[{i}] dimensions {dims[0]}x{dims[1]} exceed {profile['max_texture']} px")
        if dims is None: warnings.append(f"image[{i}] dimensions could not be inspected (format/header unsupported)")
    nodes=doc.get("nodes",[]); names={}; markers=[]
    for i,node in enumerate(nodes):
        name=node.get("name","")
        if name:
            if name in names: errors.append(f"duplicate node name: {name}")
            names[name]=i
            if name.upper().startswith(MARKER_PREFIXES): markers.append(name)
        for child in node.get("children",[]):
            if child>=len(nodes): errors.append(f"node[{i}] child index out of range")
        for field in ("translation","rotation","scale"):
            vals=node.get(field,[])
            if any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in vals): errors.append(f"node[{i}] non-finite {field}")
        q=node.get("rotation")
        if q and len(q)==4 and sum(x*x for x in q)<1e-12: errors.append(f"node[{i}] zero quaternion")
    scenes=doc.get("scenes",[])
    if not scenes: errors.append("no scenes defined")
    for i,scene in enumerate(scenes):
        for node in scene.get("nodes",[]):
            if node>=len(nodes): errors.append(f"scene[{i}] node index out of range")
    required=set(doc.get("extensionsRequired",[])); used=set(doc.get("extensionsUsed",[]))\n    if not required.issubset(used): errors.append("extensionsRequired contains entries missing from extensionsUsed")\n    extensions=doc.get("extensionsUsed",[])
    unsupported=sorted(set(extensions)-{"KHR_materials_unlit"})
    if unsupported: warnings.append("extensions require runtime support review: "+", ".join(unsupported))
    if not binary and buffers: errors.append("missing embedded BIN data")
    report={
      "file":str(path),"category":category,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),
      "triangles":triangles,"meshes":len(meshes),"primitives":primitives,"materials":len(materials),
      "textures":len(doc.get("textures",[])),"texture_dimensions":texture_dimensions,"nodes":len(nodes),"markers":markers,
      "animations":len(doc.get("animations",[])),"skins":len(doc.get("skins",[])),
      "extensions":extensions,"errors":errors,"warnings":warnings,
      "result":"FAIL" if errors else ("PASS_WITH_WARNINGS" if warnings else "PASS")
    }
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("glb",type=Path); p.add_argument("--category",choices=PROFILES,default="generic")
    p.add_argument("--config",type=Path); p.add_argument("--json",action="store_true")
    a=p.parse_args()
    try: result=validate(a.glb,a.category,a.config)
    except Exception as e:
        print(json.dumps({"result":"FAIL","errors":[str(e)]},ensure_ascii=False,indent=2)); return 2
    if a.json: print(json.dumps(result,ensure_ascii=False,indent=2))
    else:
        print(f"{result['result']}: {result['file']}"); print(f"SHA256 {result['sha256']}")
        print(f"triangles={result['triangles']} meshes={result['meshes']} materials={result['materials']} textures={result['textures']} nodes={result['nodes']}")
        for x in result["errors"]: print("ERROR:",x)
        for x in result["warnings"]: print("WARN:",x)
    return 1 if result["errors"] else 0

if __name__=="__main__": sys.exit(main())
