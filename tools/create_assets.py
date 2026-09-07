"""Rebuild original Orbit Life assets with Blender: blender -b -t 2 --python tools/create_assets.py."""
import bpy, math, os
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name,color,metal=0,glow=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes.clear()
    p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    out=m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(p.outputs['BSDF'],out.inputs['Surface'])
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.38;p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow
    return m
mint=mat('Alien skin',(.36,.83,.65));eye=mat('Obsidian eyes',(.017,.025,.045),.25)
suit=mat('Ivory flight suit',(.88,.9,.82));pink=mat('Coral accents',(.9,.34,.45))
cap=mat('Nebula mushroom',(.55,.21,.5));gill=mat('Luminous gills',(.95,.42,.66),0,.45)
stem=mat('Pearl stem',(.67,.74,.75));dot=mat('Bioluminescence',(.72,1,.7),0,1.3)
def uv(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o
def rod(name,a,b,r,material):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(material)
    bevel=o.modifiers.new('Soft edges','BEVEL');bevel.width=.05;bevel.segments=3
    o.modifiers.new('Smooth normals','WEIGHTED_NORMAL');return o
def export(name,start):
    bpy.ops.object.select_all(action='DESELECT')
    for o in list(bpy.context.scene.objects):
        if o.name not in start:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True)

def parent_to(obj,parent):
    world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world
    return obj
def joint(name,loc,parent=None):
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);obj.location=loc
    bpy.context.view_layer.update()
    if parent:parent_to(obj,parent)
    return obj
def part(obj,parent):
    bpy.context.view_layer.update();return parent_to(obj,parent)

start=set(o.name for o in bpy.context.scene.objects)
root=joint('RigRoot',(0,0,0))
hips=joint('Hips',(0,0,1.0),root)
spine=joint('Spine',(0,0,1.18),hips)
head=joint('Head',(0,0,1.65),spine)
part(uv('Torso',(0,0,1.24),(.245,.175,.30),suit),spine)
part(uv('Pelvis',(0,0,1.0),(.23,.16,.17),suit),hips)
part(uv('Skull',(0,0,1.78),(.34,.255,.36),mint),head)
for side,label in [(-1,'Left'),(1,'Right')]:
    o=uv(label+'Eye',(.145*side,-.218,1.80),(.105,.058,.145),eye);o.rotation_euler[1]=-.25*side;part(o,head)
    part(uv(label+'Glint',(.12*side,-.269,1.87),(.027,.013,.036),suit),head)
    antenna=joint(label+'Antenna',(.17*side,0,2.04),head)
    part(rod(label+'AntennaStem',(.17*side,0,2.04),(.26*side,0,2.29),.025,mint),antenna)
    part(uv(label+'AntennaLight',(.26*side,0,2.29),(.065,.065,.065),dot),antenna)
    part(uv(label+'ElderBrow',(.14*side,-.23,1.98),(.14,.035,.036),suit),head)
    upper=joint(label+'UpperArm',(.25*side,0,1.40),spine)
    forearm=joint(label+'Forearm',(.30*side,0,1.12),upper)
    hand=joint(label+'Hand',(.32*side,0,.89),forearm)
    part(uv(label+'Shoulder',(.25*side,0,1.40),(.10,.10,.10),suit),upper)
    part(rod(label+'UpperSleeve',(.25*side,0,1.40),(.30*side,0,1.12),.075,suit),upper)
    part(uv(label+'Elbow',(.30*side,0,1.12),(.075,.075,.075),pink),forearm)
    part(rod(label+'LowerSleeve',(.30*side,0,1.12),(.32*side,0,.89),.065,suit),forearm)
    part(uv(label+'Palm',(.32*side,0,.87),(.077,.073,.09),mint),hand)
    thigh=joint(label+'Thigh',(.13*side,0,.98),hips)
    shin=joint(label+'Shin',(.13*side,0,.53),thigh)
    foot=joint(label+'Foot',(.13*side,0,.12),shin)
    part(rod(label+'UpperLeg',(.13*side,0,.98),(.13*side,0,.53),.085,suit),thigh)
    part(uv(label+'Knee',(.13*side,0,.53),(.085,.085,.085),pink),shin)
    part(rod(label+'LowerLeg',(.13*side,0,.53),(.13*side,0,.12),.07,suit),shin)
    part(uv(label+'Boot',(.13*side,-.055,.10),(.105,.17,.10),pink),foot)
part(uv('SuitInsignia',(0,-.173,1.32),(.063,.025,.065),pink),spine)
export('alien',start)
root.location.x+=8
start=set(o.name for o in bpy.context.scene.objects)
rod('Mushroom stalk',(0,0,0),(.12,0,2.2),.23,stem)
uv('Mushroom crown',(.12,0,2.15),(1.55,1.45,.59),cap)
uv('Luminous underside',(.12,0,2.02),(1.45,1.34,.13),gill)
for i in range(12):
    a=i*math.tau/12;r=.9 if i%2 else .55
    uv('Glowing spore',(.12+math.cos(a)*r,math.sin(a)*r,2.15+.57*math.sqrt(1-(r/1.55)**2)),(.095,.095,.028),dot)
for i in range(16):
    a=i*math.tau/16
    rod('Gill',(.12+math.cos(a)*.26,math.sin(a)*.26,1.96),(.12+math.cos(a)*1.32,math.sin(a)*1.23,2.0),.018,gill)
export('mushroom',start)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'orbit-assets.blend'))
print('ORBIT_ASSETS_READY',OUT)
