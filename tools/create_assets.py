"""Rebuild original Orbit Life assets with Blender: blender -b -t 2 --python tools/create_assets.py."""
import bpy, math, os, sys
from mathutils import Vector
from mathutils.geometry import interpolate_bezier

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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=loc)
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

def tendril(name,points,material,radius=.095,radii=None):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12
    curve.bevel_depth=radius;curve.bevel_resolution=3;curve.use_fill_caps=True
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for i,(p,co) in enumerate(zip(spline.bezier_points,points)):
        p.co=co;p.handle_left_type=p.handle_right_type='AUTO';p.radius=radii[i] if radii else 1-i/(len(points)-1)*.65
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.context.view_layer.update();samples=[]
    for a,b in zip(spline.bezier_points,spline.bezier_points[1:]):samples.extend(interpolate_bezier(a.co,a.handle_right,b.handle_left,b.co,25)[:-1])
    samples.append(spline.bezier_points[-1].co.copy())
    bpy.ops.object.convert(target='MESH');return bpy.context.object,samples

def sample_path(points,t):
    lengths=[(b-a).length for a,b in zip(points,points[1:])];distance=sum(lengths)*t
    for i,length in enumerate(lengths):
        if distance<=length:return points[i].lerp(points[i+1],distance/length)
        distance-=length
    return points[-1].copy()

def skin_body(parts,surface,core):
    data=bpy.data.armatures.new('Soft body skeleton');arm=bpy.data.objects.new('SoftBodyArmature',data);bpy.context.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    root_bone=data.edit_bones.new('MotionRoot');root_bone.head=(0,0,1.1);root_bone.tail=(0,0,1.3)
    for name,z in [('TorsoBone',1.1),('HeadBone',1.65)]:
        bone=data.edit_bones.new(name);bone.head=(0,0,z);bone.tail=(0,0,z+.2);bone.parent=root_bone
    for obj,path,count in parts:
        previous=root_bone
        for i in range(count):
            bone=data.edit_bones.new(obj.name+'Bone'+str(i));bone.head=sample_path(path,i/max(1,count-1))
            bone.tail=sample_path(path,(i+1)/max(1,count-1)) if i<count-1 else bone.head+(path[-1]-path[-2]).normalized()*.1
            bone.parent=previous;previous=bone
    bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update();parent_to(arm,core)
    paths=[(obj.name,[sample_path(path,i/80) for i in range(81)],count) for obj,path,count in parts]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in surface+[item[0] for item in parts]:obj.select_set(True)
    bpy.context.view_layer.objects.active=surface[0];bpy.ops.object.join();body=bpy.context.object;body.name='BodySkin'
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    remesh=body.modifiers.new('Unified organic surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.016;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=body.modifiers.new('Soft continuous contour','SMOOTH');smooth.factor=.8;smooth.iterations=10;bpy.ops.object.modifier_apply(modifier=smooth.name)
    for polygon in body.data.polygons:polygon.use_smooth=True
    body.shape_key_add(name='Basis');jaw=body.shape_key_add(name='JawTaper')
    for point in jaw.data:
        world=body.matrix_world@point.co
        if 1.40<world.z<1.86:
            t=max(0,min(1,(world.z-1.40)/.15));upper=max(0,min(1,(1.86-world.z)/.14))
            point.co.x*=1-.30*t*t*(3-2*t)*upper*upper*(3-2*upper)
    body.data.materials.clear();body.data.materials.append(mint)
    groups={bone.name:body.vertex_groups.new(name=bone.name) for bone in data.bones}
    def smoothstep(a,b,x):
        t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
    for vertex in body.data.vertices:
        p=body.matrix_world@vertex.co;head_weight=smoothstep(1.36,1.66,p.z);limb_weight=0;weights={}
        candidates=[]
        for name,samples,count in paths:
            nearest=min(range(len(samples)),key=lambda i:(samples[i]-p).length_squared)
            projections=[]
            for index in range(max(0,nearest-1),min(80,nearest+1)):
                segment=samples[index+1]-samples[index];fraction=max(0,min(1,(p-samples[index]).dot(segment)/segment.length_squared))
                projections.append(((samples[index]+segment*fraction-p).length_squared,index+fraction))
            distance,position=min(projections);candidates.append((distance,name,position,count))
        distance,name,position,count=min(candidates);t=position/80
        if 'Tendril' in name:
            limb_weight=smoothstep(0,.22,t)*(1-smoothstep(.12,.18,math.sqrt(distance)))
        elif p.z<.82:
            limb_weight=(1-smoothstep(.59,.8,p.z))*(1-smoothstep(.14,.20,math.sqrt(distance)))
        if limb_weight>0:
            position=t*(count-1);left=min(count-2,int(position));fraction=position-left
            weights[name+'Bone'+str(left)]=limb_weight*(1-fraction);weights[name+'Bone'+str(left+1)]=limb_weight*fraction
        weights['HeadBone']=(1-limb_weight)*head_weight;weights['TorsoBone']=(1-limb_weight)*(1-head_weight)
        for name,weight in weights.items():
            if weight>0:groups[name].add([vertex.index],weight,'REPLACE')
    modifier=body.modifiers.new('Continuous soft skin','ARMATURE');modifier.object=arm;parent_to(body,arm)

start=set(o.name for o in bpy.context.scene.objects)
root=joint('RigRoot',(0,0,0))
skeletal_parts=[]
core=joint('Core',(0,0,1.10),root)
head=joint('Head',(0,0,1.65),core)
mantle=uv('Mantle',(0,0,1.10),(.205,.145,.51),mint)
for vertex in mantle.data.vertices:
    fullness=.88+.12*abs(vertex.co.z)
    vertex.co.x*=fullness;vertex.co.y*=fullness
part(mantle,core)
skull=uv('Skull',(0,0,1.80),(.30,.27,.41),mint)
for vertex in skull.data.vertices:vertex.co.x*=1+.20*vertex.co.z
part(skull,head)
surface=[mantle,skull]
for side,label in [(-1,'Left'),(1,'Right')]:
    o=uv(label+'Eye',(.145*side,-.218,1.80),(.105,.058,.145),eye);o.rotation_euler[1]=-.25*side;part(o,head)
    part(uv(label+'Glint',(.12*side,-.269,1.87),(.027,.013,.036),suit),head)
    antenna=joint(label+'Antenna',(.17*side,0,2.04),head)
    sensor,_=tendril(label+'AntennaStem',[(.17*side,0,2.04),(.21*side,0,2.18),(.26*side,0,2.29)],mint,.025,[1,1,1]);part(sensor,antenna)
    part(uv(label+'AntennaLight',(.26*side,0,2.29),(.065,.065,.065),dot),antenna)
    part(uv(label+'ElderBrow',(.14*side,-.23,1.98),(.14,.035,.036),suit),head)
    points=[(.045*side,0,1.40),(.265*side,0,1.20),(.35*side,0,.91),(.365*side,0,.65),(.37*side,-.015,.41)]
    for suffix,p in zip(['Base','Guide','Bend','Wrist','Tip'],points):joint(label+'Tendril'+suffix,p,core)
    tube,path=tendril(label+'Tendril',points,mint,.09,[1,.88,.72,.55,.15]);part(tube,root);skeletal_parts.append((tube,path,9))
    surface.append(part(uv(label+'SoftHand',(.37*side,-.015,.44),(.092,.065,.13),mint),root))
    points=[(.075*side,0,.94),(.14*side,0,.62),(.155*side,-.025,.34),(.155*side,-.025,.12),(.155*side,-.14,.08)]
    for suffix,p in zip(['Base','Guide','Bend','Ankle','Tip'],points):joint(label+'Leg'+suffix,p,core)
    limb,path=tendril(label+'Leg',points,mint,.095,[1,.90,.72,.78,.08]);part(limb,root);skeletal_parts.append((limb,path,9))
    surface.append(part(uv(label+'SoftFoot',(.155*side,-.08,.095),(.12,.17,.083),mint),root))
part(uv('Core glow',(0,-.128,1.27),(.022,.008,.033),dot),core)
skin_body(skeletal_parts,surface,core)
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
if '--alien-only' not in sys.argv:export('mushroom',start)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'orbit-assets.blend'))
print('ORBIT_ASSETS_READY',OUT)
