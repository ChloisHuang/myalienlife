"""Run with Blender --background --python tools/test-mermaid.py."""
import ast
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

source = Path(__file__).with_name('create-ocean.py')
tree = ast.parse(source.read_text())
nodes = [node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef))
         or isinstance(node, ast.Assign) and any(
             isinstance(target, ast.Name) and target.id == 'M'
             or isinstance(target, ast.Subscript) and isinstance(target.value, ast.Name) and target.value.id == 'M'
             for target in node.targets)]
scope = dict(rebuild_back=False, rebuild_houses=False, rebuild_pools=False)
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'), scope)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scope['mermaid']()
bpy.context.view_layer.update()
shells = [o for o in bpy.context.scene.objects if o.name.startswith('scalloped shell bodice')]
skin = scope['M']['mermaidSkin']
assert len(shells) == 2
for shell in shells:
    color = shell.data.materials[0].diffuse_color
    assert sum((color[i] - skin.diffuse_color[i]) ** 2 for i in range(3)) ** .5 > .5, 'shell color too close to skin'
print('PASS: shell color contrast')
vertices, faces = [], []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH' or obj.data.materials[0] != skin or abs(obj.location.x) > .001 or not 1.5 < obj.location.z < 1.9:
        continue
    offset = len(vertices)
    vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
    faces.extend(tuple(offset + i for i in p.vertices) for p in obj.data.polygons)
body = BVHTree.FromPolygons(vertices, faces)
for shell in shells:
    for vertex in shell.data.vertices:
        point = shell.matrix_world @ vertex.co
        hit, _, _, distance = body.ray_cast(point + Vector((0, -.1, 0)), Vector((0, 1, 0)))
        assert hit is not None, 'shell extends beyond body'
        assert -.01 <= distance - .1 <= .012, f'shell-body gap: {distance - .1:.4f}'
print('PASS: both shells conform to the actual skin mesh without a gap')
