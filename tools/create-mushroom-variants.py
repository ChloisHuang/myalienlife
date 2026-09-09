"""Run in a dedicated Blender session; export variants and their editable scene."""
import bpy
import math
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
# Reserve the glTF material names before import; Blender otherwise suffixes duplicates.
for material in list(bpy.data.materials):
    if material.name in ['Nebula mushroom', 'Luminous gills', 'Pearl stem', 'Bioluminescence', 'Mutant cap', 'Mutant gills', 'Mutant stem', 'Mutant spores']:
        material.name = 'Previous ' + material.name
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/mushroom.glb'))
source = list(bpy.context.selected_objects)
collection = bpy.data.collections.new('Crop variants')
bpy.context.scene.collection.children.link(collection)
palette = {'Nebula mushroom': ('Mutant cap', (.12, .66, .48, 1)),
           'Luminous gills': ('Mutant gills', (.65, .95, .16, 1)),
           'Pearl stem': ('Mutant stem', (.30, .65, .64, 1)),
           'Bioluminescence': ('Mutant spores', (1, .57, .14, 1))}
mutant_materials = {}
for name, (label, color) in palette.items():
    material = bpy.data.materials[name].copy()
    material.name = label
    material.diffuse_color = color
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = color
    node.inputs['Emission Color'].default_value = color
    node.inputs['Emission Strength'].default_value = .35
    mutant_materials[name] = material

for variant in ['giant', 'cluster', 'mutant', 'mutant-cluster']:
    parts = []
    cluster = 'cluster' in variant
    mutant = 'mutant' in variant
    placements = [(-.7, 0, .7), (.7, .15, .64), (0, -.65, .86)] if cluster else [(0, 0, 1)]
    for x, y, scale in placements:
        transform = Matrix.Translation((x, y, 0)) @ Matrix.Scale(scale, 4)
        for original in source:
            if original.type != 'MESH':
                continue
            obj = original.copy()
            obj.data = original.data.copy()
            collection.objects.link(obj)
            obj.matrix_world = transform @ original.matrix_world
            if mutant:
                for slot in obj.material_slots:
                    if slot.material.name in mutant_materials:
                        slot.material = mutant_materials[slot.material.name]
                if original.name.startswith('Mushroom crown'):
                    for vertex in obj.data.vertices:
                        angle = math.atan2(vertex.co.y, vertex.co.x)
                        vertex.co.z += .15 * math.sin(angle * 5)
            if variant == 'giant' and original.name.startswith('Mushroom stalk'):
                obj.scale.x *= 1.6
                obj.scale.y *= 1.6
            parts.append(obj)
        if mutant:
            for i in range(5):
                angle = i * math.tau / 5
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1,
                    location=(x + math.cos(angle) * .7 * scale, y + math.sin(angle) * .7 * scale, 3.0 * scale))
                bud = bpy.context.object
                for owner in list(bud.users_collection):
                    owner.objects.unlink(bud)
                collection.objects.link(bud)
                bud.name = 'Mutation crystal bud'
                bud.scale = (.12 * scale, .12 * scale, .4 * scale)
                bud.data.materials.append(mutant_materials['Bioluminescence'])
                parts.append(bud)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / f'public/assets/mushroom-{variant}.glb'), use_selection=True)
    for obj in parts:
        obj.location.x += 6 * (['giant', 'cluster', 'mutant', 'mutant-cluster'].index(variant) + 1)

for obj in source:
    bpy.data.objects.remove(obj, do_unlink=True)
asset_scene = bpy.data.scenes.new('Mushroom variants')
asset_scene.collection.children.link(collection)
bpy.context.window.scene = asset_scene
for scene in list(bpy.data.scenes):
    if scene != asset_scene:
        bpy.data.scenes.remove(scene)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'artifacts/mushroom-variants.blend'))
print('Exported giant, cluster, mutant and mutant-cluster crops.')
