"""Authored, texture-free fairytale kit. Run with Blender --background --python this file."""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, hex_color, emission=0):
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .78
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m

M = {k: material(k, c) for k, c in {
    'ivory':'F5E8C5', 'paper':'DFD2AE', 'page':'F5EDDA', 'cover':'416E63',
    'grass':'83B965', 'grassLight':'A7CC78', 'leaf':'488653', 'leafLight':'79B769',
    'pink':'EBA6AB', 'red':'C95450', 'redLight':'DE7564', 'blue':'639BB8',
    'blueLight':'8EC3D0', 'wood':'86604B', 'gold':'E9BF66', 'water':'77C9C3',
    'white':'FFF2DD', 'dark':'384447', 'soil':'60685C', 'dead':'59605B',
    'bark':'444B46', 'slate':'535D64', 'nightRoof':'38454F', 'rust':'986858',
    'moss':'6A9655', 'stone':'B9B8A0', 'bank':'AEBB8D', 'soilLight':'83856D',
}.items()}
M['glow'] = material('window honey', 'FFD984', .65)
M['poison'] = material('poison apple', 'DE3B48', .12)
M['water'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.18
M['water'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.3

def ground(x,z):
    t=max(0,min(1,(-z-5.4)/2.3))
    return .29+1.35*t*t*(3-2*t)+.65*math.exp(-((abs(x)-11.5)/2.6)**2-((z+2)/3.5)**2)-.37*math.exp(-((z-7.5)/.55)**2)

def raised(build,x,z):
    before=set(bpy.context.scene.objects)
    build()
    parts=list(set(bpy.context.scene.objects)-before)
    for o in parts:o.location.z+=ground(x,z)-.29
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()

def xyz(p):
    return (p[0], -p[2], p[1])

def finish(o, mat, smooth=True):
    o.data.materials.append(M[mat])
    for face in o.data.polygons:
        face.use_smooth = smooth
    return o

def ball(p, s, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=xyz(p))
    o = bpy.context.object
    o.scale = (s[0], s[2], s[1])
    return finish(o, mat)

def canopy(p,s,mat):
    o=ball(p,s,mat)
    for v in o.data.vertices:
        a=math.atan2(v.co.y,v.co.x);h=v.co.z
        v.co*=1+.12*math.sin(a*3+h*2)+.055*math.cos(a*5-h*4)
    o.data.update()
    return o

def box(p, s, mat, bevel=.10):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    o = bpy.context.object
    o.scale = (s[0], s[2], s[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new('soft crafted edges', 'BEVEL')
        b.width = bevel
        b.segments = 2
        bpy.ops.object.modifier_apply(modifier=b.name)
        n = o.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=n.name)
    return finish(o, mat, False)

def rod(a, b, r, mat, tip=None):
    a, b = Vector(xyz(a)), Vector(xyz(b))
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=r if tip is None else tip, depth=(b-a).length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(o, mat)

def curve(points, radius, mat, taper=False):
    c = bpy.data.curves.new('shaped trim', 'CURVE')
    c.dimensions = '3D'
    c.resolution_u = 4
    c.bevel_depth = radius
    c.bevel_resolution = 1
    spline = c.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for i, (p, co) in enumerate(zip(spline.bezier_points, points)):
        p.co = xyz(co)
        p.handle_left_type = p.handle_right_type = 'AUTO'
        if taper:p.radius=max(.045,1-i/(len(points)-1))
    o = bpy.data.objects.new('trim', c)
    bpy.context.collection.objects.link(o)
    c.materials.append(M[mat])
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.select_set(False)
    return o

def lathe(p, profile, mat, segments=16):
    vertices, faces = [], []
    for r, h, offset in profile:
        for i in range(segments):
            a = i * math.tau / segments
            vertices.append(xyz((p[0]+r*math.cos(a)+offset, p[1]+h, p[2]+r*math.sin(a))))
    for j in range(len(profile)-1):
        for i in range(segments):
            a = j*segments+i
            b = j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
    mesh = bpy.data.meshes.new('profile')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    o = bpy.data.objects.new('profile', mesh)
    bpy.context.collection.objects.link(o)
    return finish(o, mat)

def arch(x,y,z,w,h,mat,thick=.12):
    points=[(x-w/2,y,z),(x-w/2,y+h*.64,z)]
    points += [(x+math.cos(math.pi-i*math.pi/8)*w/2,y+h*.64+math.sin(i*math.pi/8)*h*.36,z) for i in range(9)]
    points += [(x+w/2,y,z)]
    curve(points,thick,mat)

def window(x,y,z,w=.5,h=.8):
    box((x,y+h/2,z),(w,h,.10),'glow',min(w/2,.20))
    arch(x,y,z+.08,w+.12,h+.10,'ivory',.065)
    rod((x,y+.06,z+.13),(x,y+h-.02,z+.13),.035,'wood')
    rod((x-w/2,y+h*.48,z+.13),(x+w/2,y+h*.48,z+.13),.035,'wood')

def roof(x,y,z,w,d,h,dark=False,palette=None):
    colors=palette if palette else ['nightRoof','slate'] if dark else ['red','redLight','red','rust']
    def panel(points,mat):
        mesh=bpy.data.meshes.new('roof tile')
        mesh.from_pydata([xyz(p) for p in points],[],[(0,1,2,3)])
        mesh.update()
        o=bpy.data.objects.new('roof tile',mesh)
        bpy.context.collection.objects.link(o)
        finish(o,mat,False)
        solid=o.modifiers.new('tile thickness','SOLIDIFY');solid.thickness=.055
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
    # Thin overlapping shingles follow a normal pitched roof, not a swollen dome.
    for sign in [-1,1]:
        for row in range(4):
            lo=row/4;hi=(row+1)/4+.025
            for col in range(6):
                za=z-d/2+col*d/6+.015;zb=z-d/2+(col+1)*d/6-.015
                xa=x+sign*lo*w/2;xb=x+sign*hi*w/2
                ya=y+h*(1-lo)-.19*math.sin(lo*math.pi)+.17*lo**6+.018*(4-row)
                yb=y+h*(1-hi)-.19*math.sin(hi*math.pi)+.17*hi**6+.018*(4-row)
                points=[(xa,ya,za),(xb,yb,za),(xb,yb,zb),(xa,ya,zb)]
                if sign>0:points.reverse()
                panel(points,colors[(row*3+col)%len(colors)])
        for zz in [z-d/2,z+d/2]:
            curve([(x,y+h+.04,zz),(x+sign*w*.23,y+h*.46,zz),(x+sign*w/2,y+.17,zz)],.075,'slate' if dark else 'wood')
        rod((x+sign*w/2,y,z-d/2),(x+sign*w/2,y,z+d/2),.055,'slate' if dark else 'wood')
    rod((x,y+h+.06,z-d/2-.03),(x,y+h+.06,z+d/2+.03),.075,'slate' if dark else 'redLight')

def cottage(x,z,dark=False):
    wall='dead' if dark else 'ivory'
    timber='bark' if dark else 'wood'
    box((x,1.5,z),(3.25,2.30,2.75),wall,.045)
    # Visible masonry courses and exposed joinery define the silhouette at game scale.
    for row in range(2):
        for col in range(7):
            xx=x-1.48+col*.49+(row%2)*.035
            box((xx,.38+row*.20,z+1.39),(.45,.18,.16),'slate' if dark else 'stone',.045)
    for xx in [x-1.57,x+1.57]:
        box((xx,1.55,z+1.40),(.12,2.35,.10),timber,.018)
        box((xx,1.55,z-1.40),(.12,2.35,.10),timber,.018)
    for yy in [.70,2.60]:
        box((x,yy,z+1.41),(3.3,.11,.12),timber,.018)
        for xx in [x-1.63,x+1.63]:box((xx,yy,z),(.10,.11,2.8),timber,.018)
    for zz in [z-1.38,z+1.38]:
        mesh=bpy.data.meshes.new('plaster gable')
        mesh.from_pydata([xyz((x-1.63,2.64,zz)),xyz((x+1.63,2.64,zz)),xyz((x,4.04,zz))],[],[(0,1,2) if zz>z else (2,1,0)])
        mesh.update();o=bpy.data.objects.new('gable',mesh);bpy.context.collection.objects.link(o);finish(o,wall,False)
        for sign in [-1,1]:rod((x,4,zz+.025),(x+sign*1.6,2.65,zz+.025),.055,timber)
        rod((x,2.66,zz+.03),(x,3.95,zz+.03),.045,timber)
    roof(x,2.60,z,3.85,3.30,1.56,dark)
    # Off-center entrance, recessed glass and shutters avoid dollhouse symmetry.
    door=x+.65
    box((door,1.35,z+1.40),(.82,1.5,.07),timber,.14)
    arch(door,.60,z+1.49,.96,1.70,'stone' if dark else 'paper',.075)
    for dx in [-.23,0,.23]:rod((door+dx,.65,z+1.49),(door+dx,1.92,z+1.49),.012,'rust')
    ball((door+.25,1.22,z+1.54),(.045,.045,.04),'gold')
    for yy in [.70,.87]:box((door,yy-.25,z+1.70), (1.16,.17,.65),'slate' if dark else 'stone',.04)
    wx=x-.84
    box((wx,1.69,z+1.42),(.83,.89,.07),timber,.025)
    box((wx,1.69,z+1.47),(.68,.73,.025),'glow',.015)
    for xx in [wx-.43,wx,wx+.43]:rod((xx,1.24,z+1.51),(xx,2.13,z+1.51),.025,timber)
    rod((wx-.42,1.69,z+1.52),(wx+.42,1.69,z+1.52),.025,timber)
    for sign in [-1,1]:
        box((wx+sign*.57,1.68,z+1.43),(.25,.93,.07),'slate' if dark else 'blue',.025)
        for yy in [1.40,1.68,1.96]:box((wx+sign*.57,yy,z+1.48),(.23,.035,.025),'slate' if dark else 'blueLight',.008)
    box((wx,1.15,z+1.55),(1,.20,.32),timber,.03)
    for dx in [-.30,0,.30]:
        ball((wx+dx,1.31,z+1.57),(.19,.10,.14),'leaf')
        if not dark:ball((wx+dx,1.43,z+1.58),(.095,.09,.08),'pink' if dx else 'white')
    window(x,3.12,z+1.40,.39,.54)
    # Brick chimney with a dark open cap.
    for row in range(5):
        for col in range(2):
            box((x-1.0+(col-.5)*.32,3.43+row*.20,z-.65),(.29,.18,.57),'slate' if dark else 'rust',.025)
    box((x-1,4.45,z-.65),(.78,.15,.76),'slate' if dark else 'stone',.035)
    box((x-1,4.54,z-.65),(.43,.035,.41),'dark',.015)
    # Masonry corners, a round attic opening and an arched entry remain readable from above.
    for xx in [x-1.58,x+1.58]:
        for row in range(6):box((xx,.83+row*.29,z+1.43),(.30,.25,.22),'slate' if dark else 'stone',.035)
    ball((x,3.42,z+1.43),(.29,.29,.06),'glow')
    curve([(x+.32*math.cos(a),3.42+.32*math.sin(a),z+1.51) for a in [i*math.tau/16 for i in range(17)]],.045,timber)
    rod((x,3.12,z+1.54),(x,3.72,z+1.54),.025,timber)
    for dx in [-1.35,-.75,1.45]:
        for j in range(3):
            ball((x+dx+j*.13,.55+j*.09,z+1.8),(.22,.16,.19),'bark' if dark else 'leaf')
            if not dark:ball((x+dx+j*.13,.72+j*.09,z+1.85),(.085,.09,.085),'red' if j%2 else 'pink')
    if dark:
        box((door,1.42,z+1.51),(1.13,1.72,.08),'glow',.25)
        arch(door,.52,z+1.65,1.33,2.0,'bark',.18)
        ball((door,2.82,z+1.60),(.72,.48,.34),'slate')
        ball((door,2.51,z+1.88),(.38,.24,.28),'dead')
        ball((door,2.57,z+2.09),(.16,.11,.12),'dark')
        for sign in [-1,1]:
            rod((door+sign*.58,3.02,z+1.50),(door+sign*.86,3.92,z+1.50),.34,'bark',0)
            rod((door+sign*.58,3.13,z+1.72),(door+sign*.83,3.77,z+1.72),.18,'rust',0)
            ball((door+sign*.34,2.89,z+1.91),(.10,.055,.05),'glow')
            for yy in [1.0,1.8,2.15]:rod((door+sign*.57,yy,z+1.72),(door+sign*.38,yy-.23,z+1.72),.095,'paper',0)
        lathe((x+2.15,.30,z+1),[(.5,0,0),(.65,.3,0),(.60,.70,0),(.50,.77,0)],'nightRoof')
        ball((x+2.15,1.04,z+1),(.45,.025,.45),'leafLight')

def tower(x,z,r,h,dark=False):
    lathe((x,.32,z),[(r*1.1,0,0),(r,.3,0),(r,h-.2,.18 if dark else 0),(r*1.08,h,0)],'dead' if dark else 'ivory')
    if dark:
        lathe((x,.32+h,z),[(r*1.30,0,0),(r*1.26,.22,0),(r*.90,.52,0),(r*.56,1.18,.35),(r*.16,1.90,.6),(.05,2.16,.7)],'nightRoof')
    else:
        for tier in range(7):
            t=tier/7;u=(tier+1)/7
            lathe((x,.32+h,z),[(r*1.32*(1-t)+.025,t*2.2,0),(max(.035,r*1.32*(1-u)),u*2.2+.06,0)],'blueLight' if tier%3==0 else 'blue')
        for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
            dx=math.cos(angle);dz=math.sin(angle)
            curve([(x+dx*r*1.34,h+.32,z+dz*r*1.34),(x+dx*r*.65,h+1.45,z+dz*r*.65),(x,h+2.58,z)],.025,'gold')
    if not dark:ball((x,h+2.52,z),(.14,.15,.14),'gold')
    window(x,h-.75,z+r+.02,.43,.85)
    for yy in [.35,h-.40]:
        lathe((x,.32+yy,z),[(r*1.035,0,0),(r*1.055,.10,0),(r*1.035,.17,0)],'slate' if dark else 'paper')
    for i in range(3):
        yy=.95+i*.68
        for sign in [-1,1]:box((x+sign*r*.64,yy,z+r*.80),(.30,.13,.06),'slate' if dark else 'paper',.035)
    if not dark:
        rod((x,h+2.53,z),(x,h+3.13,z),.025,'gold')
        box((x+.24,h+2.98,z),(.46,.24,.04),'red',.04)

def castle(dark=False):
    z=-8.35
    box((0,.50,z),(8.2,.45,3.2),'slate' if dark else 'paper',.25)
    box((0,2.4,z),(4.9,3.8,2.7),'dead' if dark else 'ivory',.28)
    if dark:
        for x in [-2,0,2]:box((x,4.55,z+.1),(.70,.7,2.7),'dead',.18)
    else:
        roof(0,4.15,z,5.3,3.05,1.30,palette=['blue','blueLight','blue'])
        for x in [-1.4,1.4]:
            box((x,4.65,z+1.15),(.78,.85,.65),'ivory',.035)
            window(x,4.35,z+1.51,.35,.55)
            roof(x,5.05,z+1.12,1.04,.96,.65,palette=['blue','blueLight'])
        for x,h in [(-2.15,5.0),(2.05,5.65)]:tower(x,z-.75,.37,h)
    for x,h in [(-3.1,3.7),(3.1,4.3)]:tower(x,z,.98 if dark else .76,h,dark)
    tower(.3,z-1.05,1.15 if dark else .78,6,dark)
    box((0,1.35,z+1.4),(1.4,2.0,.16),'wood',.50)
    arch(0,.34,z+1.56,1.7,2.45,'rust' if dark else 'white',.16)
    for x in [-1.55,1.55]:window(x,2.35,z+1.39,.46,.9)
    for x in [-1.95,1.95]:
        box((x,2.95,z+1.46),(.33,1.30,.09),'rust' if dark else 'red',.05)
        ball((x,3.15,z+1.54),(.10,.12,.03),'gold')
    for yy in [.85,1.35,1.85]:
        for xx in [-2,-1.35,1.35,2]:box((xx,yy,z+1.365),(.48,.05,.025),'slate' if dark else 'paper',.01)
    for x in [-3,3]:
        box((x,.65,z+1.7),(2.25,.4,.5),'slate' if dark else 'stone',.16)
    if not dark:
        for w,h in [(2.1,2.65),(2.40,2.87)]:arch(0,.33,z+1.61,w,h,'paper' if w<2.2 else 'ivory',.075)
        for x in [-1.22,1.22]:
            rod((x,.5,z+1.65),(x,3.5,z+1.65),.095,'ivory')
            lathe((x,3.48,z+1.65),[(.18,0,0),(.02,.55,0)],'gold')
        ball((0,3.52,z+1.44),(.38,.38,.035),'blueLight')
        curve([(.42*math.cos(a),3.52+.42*math.sin(a),z+1.51) for a in [i*math.tau/24 for i in range(25)]],.05,'gold')
        for i in range(8):
            a=i*math.tau/8;rod((0,3.52,z+1.55),(.36*math.cos(a),3.52+.36*math.sin(a),z+1.55),.022,'ivory')
        for x in [-2.9,2.9]:
            curve([(x-.60,2.9,z+.9),(x,2.9,z+1.2),(x+.6,2.9,z+.9)],.05,'gold')
            for dx in [-.48,-.24,0,.24,.48]:rod((x+dx,2.58,z+1.1),(x+dx,2.9,z+1.1),.027,'ivory')
    if dark:
        for x in [-3.9,3.9]:
            curve([(x,.4,z+1),(x-.4,2,z+1.2),(x+.3,4,z),(x-.3,5.7,z)],.15,'bark')
            rod((x+.1,3.7,z),(x+1,4.4,z),.13,'bark',.01)

def tree(x,z,s=1,dark=False,apple=False):
    if dark:
        before=set(bpy.context.scene.objects)
        curled_tree(x,z,s,apple)
        angle={-12:-.4,-9.5:.25,11:.6,13:-.5,-13:.25,8:-.6,-7.5:.5,12:-.3,-11.5:.45}.get(x,0)
        pivot=Vector(xyz((x,0,z)));rotation=Matrix.Translation(pivot)@Matrix.Rotation(angle,4,'Z')@Matrix.Translation(-pivot)
        for o in set(bpy.context.scene.objects)-before:o.matrix_world=rotation@o.matrix_world
        return
    rod((x,.3,z),(x+.12*s,2.8*s,z),.26*s,'bark' if dark else 'wood',.14*s)
    for dx,dz,h in [(-.8,.1,2.2),(.7,.25,2.5),(.15,-.7,3.1)]:
        rod((x,1.4*s,z),(x+dx*s,h*s,z+dz*s),.13*s,'bark' if dark else 'wood',.055*s)
        if dark:
            rod((x+dx*s,h*s,z+dz*s),(x+dx*1.5*s,(h+.7)*s,z+(dz+.25)*s),.055*s,'bark',.008)
        else:
            canopy((x+dx*s,h*s,z+dz*s),(1.0*s,.95*s,.9*s),'leafLight' if dz>0 else 'leaf')
    if apple:
        for dx,h,dz in ([(.7,2.4,.35)] if dark else [(-.8,1.9,.7),(.8,2.3,.9),(.15,3,.1),(-.3,2.6,.6)]):
            ball((x+dx*s,h*s,z+dz*s),(.22*s,.24*s,.21*s),'poison' if dark else 'red')

def curled_tree(x,z,s,apple=False):
    # Asymmetric S-shaped trunks with open spiral tips, matching the silhouette reference.
    trunk=[(0,0,0),(-.24,.9,.03),(.20,1.8,0),(.55,2.6,-.08),(.25,3.35,0),(-.3,3.85,.05)]
    spiral=[(-.55+.43*math.cos(a),3.64+.43*math.sin(a),.05) for a in [1.0,1.8,2.6,3.4,4.2,5.0,5.8]]
    points=trunk+spiral
    curve([(x+a*s,.3+b*s,z+c*s) for a,b,c in points],.27*s,'bark',True)
    for index,(sign,yy,zz) in enumerate([(-1,1.1,.35),(1,1.9,-.3),(-1,2.45,-.1)]):
        branch=[(.1,yy,0),(sign*.65,yy+.3,zz),(sign*1.05,yy+.95,zz),(sign*.95,yy+1.25,zz)]
        if index==0:branch += [(sign*.65,yy+1.32,zz),(sign*.54,yy+1.1,zz),(sign*.72,yy+1.02,zz)]
        curve([(x+a*s,.3+b*s,z+c*s) for a,b,c in branch],.12*s,'bark',True)
        for a,b in [(sign*.55,yy+.3),(sign*.99,yy+.83)]:
            rod((x+a*s,.3+b*s,z+zz*s),(x+(a+sign*.33)*s,.3+(b+.31)*s,z+zz*s),.075*s,'bark',.005)
        curve([(x+sign*.8*s,(yy+.6)*s,z+zz*s),(x+sign*1.25*s,(yy+.70)*s,z+(zz+.15)*s),(x+sign*1.45*s,(yy+1)*s,z+(zz+.15)*s)],.055*s,'bark',True)
    for dx,yy in [(-.24,.9),(.28,1.65),(.5,2.5),(.25,3.1),(-.16,3.6)]:
        sign=-1 if yy<2 else 1
        rod((x+dx*s,.3+yy*s,z),(x+(dx+sign*.34)*s,.3+(yy+.33)*s,z+.07),.12*s,'bark',.005)
    for dx,dz in [(-.65,.45),(.7,.2),(.1,-.7)]:
        curve([(x+dx*s,.30,z+dz*s),(x+dx*.4*s,.48,z+dz*.4*s),(x,.7,z)],.10*s,'bark')
    if apple:
        rod((x+.95*s,2.60*s,z+.15),(x+.95*s,2.20*s,z+.15),.025,'wood')
        ball((x+.95*s,2.06*s,z+.15),(.25,.28,.24),'poison')

def flower(x,z,s=1):
    rod((x,.32,z),(x,.32+s,z),.045,'leaf')
    for i in range(5):
        a=i*math.tau/5
        ball((x+math.cos(a)*.27*s,.32+s,z+math.sin(a)*.27*s),(.25*s,.11*s,.25*s),'white')
    ball((x,.45+s,z),(.18*s,.12*s,.18*s),'gold')

def bench():
    for x in [-.68,.68]:
        box((x,.36,0),(.15,.70,.65),'wood')
        box((x,.83,-.26),(.12,1.12,.13),'wood')
    for z in [-.23,.02,.27]:box((0,.64,z),(1.7,.13,.19),'blue',.06)
    for y in [.99,1.23]:box((0,y,-.28),(1.7,.17,.12),'blueLight',.07)
    for x in [-.8,.8]:curve([(x,.72,.35),(x,1,.2),(x,1,-.28)],.065,'ivory')

def lantern():
    lathe((0,0,0),[(.30,0,0),(.33,.13,0),(.12,.24,0),(.085,1.30,0)],'cover')
    box((0,1.55,0),(.40,.49,.40),'glow',.09)
    for x in [-.23,.23]:
        for z in [-.23,.23]:rod((x,1.29,z),(x,1.81,z),.035,'cover')
    lathe((0,1.80,0),[(.37,0,0),(.30,.12,0),(.08,.30,0)],'cover')
    ball((0,2.12,0),(.08,.09,.08),'gold')

def planter():
    box((0,.27,0),(1.2,.54,.65),'red',.14)
    box((0,.56,0),(1.27,.12,.72),'redLight',.06)
    for x in [-.38,0,.38]:
        ball((x,.65,0),(.27,.18,.23),'leaf')
        ball((x,.82,.03),(.18,.17,.16),'pink' if x else 'white')

def book(dark):
    def slab(y,mat,layer):
        verts=[]
        for scale,yy in [(.99,y+.045),(1,y+.01),(1,y-.055),(.99,y-.07)]:
            for i in range(80):
                a=i*math.tau/80
                flutter=.10*math.sin(a*7+layer*.8)+.07*math.sin(a*13-layer*.6)
                tear=(.19 if dark else .035)*max(0,math.sin(a*19+layer*1.7))**6
                x=math.copysign(abs(math.cos(a))**.45,math.cos(a))*(14.9+flutter-tear)*scale
                z=math.copysign(abs(math.sin(a))**.45,math.sin(a))*(10.6+flutter-tear)*scale
                curl=.09*math.sin(a*3)+.035*math.sin(a*9)+.018*math.sin(a*7+layer*.6)
                verts.append(xyz((x,yy+.08*math.sin(x*.32)+curl,z)))
        faces=[tuple(reversed(range(80))),tuple(range(240,320))]
        for row in range(3):
            for i in range(80):
                a=row*80+i;b=row*80+(i+1)%80;faces.append((a,b,b+80,a+80))
        mesh=bpy.data.meshes.new('sculpted page');mesh.from_pydata(verts,[],faces);mesh.update()
        o=bpy.data.objects.new('page',mesh);bpy.context.collection.objects.link(o);finish(o,mat,False)
    for i in range(8):slab(-1.15+i*.15,'cover' if i==0 else 'page' if i%2 else 'paper',i)
    # Height field with painted vertex colors: hills, castle terrace and a shallow stream bed.
    verts=[];faces=[];nx=64;nz=48
    for j in range(nz+1):
        v=-1+2*j/nz
        for i in range(nx+1):
            u=-1+2*i/nx
            k=max(abs(u),abs(v))/(abs(u)**4.44+abs(v)**4.44)**(1/4.44) if u or v else 1
            x=14.8*u*k;z=10.4*v*k
            verts.append(xyz((x,ground(x,z),z)))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+nx+1,a+nx+2,a+1))
    edge=[j*(nx+1) for j in range(nz+1)]+[nz*(nx+1)+i for i in range(1,nx+1)]+[j*(nx+1)+nx for j in range(nz-1,-1,-1)]+[i for i in range(nx-1,0,-1)]
    for a,b in zip(edge,edge[1:]+edge[:1]):
        c=len(verts);verts.extend([(verts[a][0],verts[a][1],-.10),(verts[b][0],verts[b][1],-.10)]);faces.append((a,b,c+1,c))
    mesh=bpy.data.meshes.new('sculpted terrain');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('terrain',mesh);bpy.context.collection.objects.link(o)
    paint=material('painted reverse earth' if dark else 'painted meadow','FFFFFF')
    attr=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    c1=M['soil' if dark else 'grass'].diffuse_color;c2=M['soilLight' if dark else 'grassLight'].diffuse_color;c3=M['slate' if dark else 'bank'].diffuse_color
    for i,(x,yy,h) in enumerate(verts):
        z=-yy;t=.5+.23*math.sin(x*.48+z*.17)+.18*math.cos(z*.74-x*.21);bank=math.exp(-((z-7.5)/1.15)**2)*.80
        attr.data[i].color=tuple((c1[k]*(1-t)+c2[k]*t)*(1-bank)+c3[k]*bank for k in range(3))+(1,)
    vcol=paint.node_tree.nodes.new('ShaderNodeVertexColor');vcol.layer_name='Col';paint.node_tree.links.new(vcol.outputs['Color'],paint.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    o.data.materials.append(paint)
    for p in mesh.polygons:p.use_smooth=True
    box((0,-.7,0),(.55,.85,20.2),'cover',.22)
    # A single bookmark is a large readable detail instead of dense edge decoration.
    box((-4,-.15,10.65),(1.25,.08,2.0),'rust' if dark else 'red',.06)

def island(dark=False):
    marked=set(bpy.context.scene.objects)
    def stage(progress):
        nonlocal marked
        current=set(bpy.context.scene.objects)
        for o in current-marked:o['revealAt']=progress
        marked=current
    book(dark)
    stage(0)
    # Authored meadow beds leave the central building plots clear; blades share one mesh.
    verts=[];faces=[]
    for cx,cz in [(-7,1),(-5,5),(5,5),(8,1),(-8,-5),(8,-5),(-10,8.5),(5,9),(-3,-5)]:
        for i in range(32):
            a=i*2.39996;r=.20+1.2*math.sqrt(i/32)
            x=cx+math.cos(a)*r;z=cz+math.sin(a)*r*.62;y=ground(x,z)+.02
            for j in range(3):
                angle=a+j*2.1;dx=math.cos(angle)*.055;dz=math.sin(angle)*.055
                k=len(verts);verts.extend([xyz((x-dx,y,z-dz)),xyz((x+dx,y,z+dz)),xyz((x+dx*2,y+.16+(i%4)*.045,z+dz*2))]);faces.append((k,k+1,k+2))
        for i in range(4):
            x=cx+math.cos(i*2.3)*.8;z=cz+math.sin(i*2.3)*.55
            if not dark:raised(lambda x=x,z=z:flower(x,z,.19),x,z)
            else:ball((x,ground(x,z)+.04,z),(.20,.075,.13),'slate')
    mesh=bpy.data.meshes.new('meadow blades');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('meadow blades',mesh);bpy.context.collection.objects.link(o);finish(o,'soilLight' if dark else 'leaf',False)
    stage(.2)
    castle_x=6.5 if dark else 0
    before=set(bpy.context.scene.objects)
    raised(lambda:castle(dark),castle_x,-8.35)
    for o in set(bpy.context.scene.objects)-before:o.location.x+=castle_x
    stage(1)
    raised(lambda:cottage(-11,1.8,dark),-11,1.8)
    stage(.4)
    raised(lambda:tree(11.6,4.6,1.3,dark,True),11.6,4.6)
    spots=[(-12,-7,1.15),(-9.5,-8,1.35),(11,-7,1.4),(13,-3,1.2),(-13,6,1),(8,-9,1.25)]
    if dark:
        spots=[(0,-8,1.4) if x==11 else (-3,-9,1.25) if x==8 else (x,z,s) for x,z,s in spots]
        spots += [(-13,-2,1.5),(-7.5,-9,1.05),(12,1,1.3),(12,7.5,1.15),(-11.5,8,1.0)]
    for x,z,s in spots:raised(lambda x=x,z=z,s=s:tree(x,z,s,dark),x,z)
    stage(.2)
    for i in range(7):
        z=-5.9-i*.27;y=ground(castle_x,z)
        box((castle_x,y+.06,z),(2.4,.15,.28),'slate' if dark else 'ivory',.04)
    # Designed yellow-brick axis; the center remains flat for the existing movement system.
    for i in range(24):
        z=9-i*.67;x=1.3*math.sin(z*.35)
        if dark:
            t=max(0,min(1,(-z+.5)/6.4));x=x*(1-t)+castle_x*t*t*(3-2*t)
        if 6.6<z<8.7:continue
        for dx in [-.45,.45]:box((x+dx,ground(x+dx,z)+.025,z),(.84,.045,.60),'paper' if dark else 'gold',.075)
    for i in range(9):box((-2-i,ground(-2-i,3.7)+.025,3.7),(.84,.045,.8),'paper' if dark else 'gold',.075)
    stage(0)
    # Shallow garden stream runs outside the build grid; the bridge is also level.
    for i in range(12):
        x=-12+i*2.1;z=7.5
        box((x,-.055,z),(2.2,.025,.70),'dark' if dark else 'bank',.07)
        for j in range(3):ball((x-.6+j*.55,-.015,z+.16*math.sin(i+j)),(.18,.045,.12),'slate' if dark else 'stone')
        for sign in [-1,1]:ball((x,ground(x,z+sign*.66),z+sign*.66),(.25,.16,.19),'slate' if dark else 'stone')
    stage(0)
    box((.55,.31,7.7),(2.3,.07,2.1),'wood' if dark else 'ivory',.12)
    for x in [-.7,1.8]:
        curve([(x,.35,6.6),(x,.85,7.6),(x,.35,8.7)],.10,'bark' if dark else 'paper')
        for z in [7.1,7.65,8.2]:rod((x,.32,z),(x,.70,z),.07,'bark' if dark else 'ivory')
    stage(.6)
    for x,z in [(-13,4),(-8,-8),(9,7.8),(13,1),(-6,8.5)]:
        if dark:
            rod((x,.3,z),(x+.25,1.4,z),.09,'bark',.005)
        else:raised(lambda x=x,z=z:flower(x,z,.8 if x<0 else 1.1),x,z)
    for x,z in [(-8,6),(8,6),(-7,-6),(7,-6)]:
        start=set(bpy.context.scene.objects);lantern()
        for o in set(bpy.context.scene.objects)-start:o.location+=Vector(xyz((x,ground(x,z),z)))
    for x in [-12,-10,-8,8,10,12]:
        box((x,.76,9.25),(.19,.9,.18),'bark' if dark else 'ivory',.08)
    for x in [-10,10]:
        for y in [.55,.95]:box((x,y,9.25),(4.1,.13,.12),'bark' if dark else 'ivory',.06)
    stage(.8)

def facility(kind):
    if kind=='pod':
        for x in [-.60,.60]:
            for z in [-1.1,1.1]:rod((x,0,z),(x,1.05,z),.10,'wood');ball((x,1.08,z),(.13,.13,.13),'gold')
        box((0,.45,0),(1.5,.3,2.5),'wood',.16)
        box((0,.68,0),(1.37,.25,2.32),'white',.18)
        box((0,.83,.35),(1.38,.15,1.55),'blue',.15)
        box((0,.86,-.80),(1.05,.25,.46),'pink',.18)
        box((0,1.02,-1.17),(1.46,.80,.15),'blueLight',.20)
    elif kind=='food':
        box((0,.60,0),(1.50,1.15,.85),'red',.18)
        box((0,1.22,0),(1.68,.13,1),'ivory',.08)
        for x in [-.68,.68]:rod((x,1.23,-.30),(x,2.15,-.30),.055,'wood')
        roof(0,2.10,0,1.9,1.35,.45)
        for x in [-.4,0,.4]:ball((x,1.42,.1),(.19,.20,.18),'redLight' if x else 'leafLight')
    elif kind=='shower':
        lathe((0,0,0),[(.7,0,0),(.8,.15,0),(.75,.7,0),(.62,.76,0),(.56,.6,0),(.52,.2,0)],'ivory')
        ball((0,.45,0),(.54,.03,.54),'water')
        curve([(0,.1,-.65),(0,1.6,-.65),(0,2.25,-.4),(0,2.3,0)],.075,'gold')
        ball((0,2.21,.05),(.28,.10,.24),'gold')
    elif kind in ['lab','blueprintTable','constructionTerminal']:
        for x in [-.65,.65]:box((x,.48,0),(.16,.96,.65),'wood')
        box((0,1,0),(1.8,.18,1),'wood')
        for x in [-.36,.12]:box((x,1.14,0),(.44,.09,.65),'page',.04)
        ball((.62,1.4,-.16),(.20,.27,.20),'blueLight')
        rod((-.75,1.08,-.25),(-.75,1.55,-.25),.06,'gold');ball((-.75,1.63,-.25),(.08,.14,.08),'glow')
    elif kind=='portal':
        for x in [-1.3,1.3]:rod((x,0,0),(x,2.5,0),.22,'ivory')
        arch(0,0,0,2.6,3.1,'ivory',.23)
        arch(0,.15,.01,2.1,2.7,'gold',.045)
        for x in [-1.35,1.35]:ball((x,2.2,0),(.30,.38,.30),'leaf')
        ball((0,3.1,0),(.20,.22,.20),'pink')
    elif kind=='music':
        box((0,.55,0),(1,.90,.8),'wood')
        rod((0,1,0),(.3,1.5,0),.06,'gold')
        lathe((.3,1.3,0),[(.12,0,0),(.17,.3,0),(.60,.65,0),(.64,.72,0)],'gold')

def star(x,y,z,size,mat):
    verts=[]
    for depth in [-.055,.055]:
        for i in range(10):
            a=math.pi/2+i*math.pi/5;r=size*(1 if i%2==0 else .44)
            verts.append(xyz((x+math.cos(a)*r,y+math.sin(a)*r,z+depth)))
    faces=[tuple(reversed(range(10))),tuple(range(10,20))]
    for i in range(10):faces.append((i,(i+1)%10,(i+1)%10+10,i+10))
    mesh=bpy.data.meshes.new('bookmark star');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('star',mesh);bpy.context.collection.objects.link(o);finish(o,mat,False)

def front_story_moon():
    ball((0,0,0),(2.4,2.4,2.4),'ivory')
    for x,y,s in [(-.85,.9,.43),(.9,.2,.31),(-.1,-1,.24)]:
        z=math.sqrt(2.4**2-x*x-y*y)
        ball((x,y,z-.07),(s,s,.10),'paper')
    ring=[]
    for i in range(49):
        a=i*math.tau/48;ring.append((3.65*math.cos(a),.40*math.sin(a),2.85*math.sin(a)))
    curve(ring,.095,'gold')
    for x,y,z in [(-2.8,-1.3,1.4),(2.4,-1.5,1.9),(.4,-2.7,2.5)]:
        rod((x,y+.8,z),(x,y,z),.025,'gold')
        star(x,y-.20,z,.29,'glow')

def story_fragment(dark=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
    o=bpy.context.object;o.scale=(1.05,.75,.62);o.location.z=-.15;finish(o,'slate' if dark else 'stone',False)
    for i in range(3):
        box((0,.27+i*.09,0),(1.9,.08,1.2),'paper' if i%2 else 'page',.10)
    if dark:
        box((0,.56,0),(1.85,.10,1.15),'bark',.09)
        curve([(.3,.55,0),(.9,.25,.1),(1,-.4,.15),(.7,-.85,.3),(.35,-.9,.3),(.3,-.7,.3)],.12,'bark',True)
        rod((-.4,.5,0),(-.6,1.1,.2),.1,'bark',0)
    else:
        ball((0,.55,0),(.85,.12,.53),'moss')
        flower(-.25,0,.45)
        ball((.48,.65,-.12),(.30,.22,.23),'leafLight')

def asset(name, build):
    before=set(bpy.context.scene.objects)
    build()
    objects=list(set(bpy.context.scene.objects)-before)
    if name in ['fairytale-front','fairytale-back']:
        root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
        groups={progress:[o for o in objects if o['revealAt']==progress] for progress in set(o['revealAt'] for o in objects)}
        for progress,parts in sorted(groups.items()):
            bpy.ops.object.select_all(action='DESELECT')
            for o in parts:o.select_set(True)
            bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
            o=bpy.context.object;o.name=f'{name}-stage-{int(progress*100)}';o['revealAt']=progress;o.parent=root
        return root
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.name=name
    return o

sample='--cottage-sample' in sys.argv
environment='--environment' in sys.argv
if environment:
    asset('orbit-front',front_story_moon)
    for side,dark in [('front',False),('back',True)]:
        asset('fragment-'+side,lambda d=dark:story_fragment(d))
elif sample:
    asset('cottage-sample',lambda:cottage(0,0,False))
else:
    asset('fairytale-front',lambda:island(False))
    asset('fairytale-back',lambda:island(True))
    asset('fairyBench',bench)
    asset('fairyLantern',lantern)
    asset('fairyPlanter',planter)
    for kind in ['pod','food','shower','lab','portal','music','blueprintTable','constructionTerminal']:
        asset('fairy-'+kind,lambda k=kind:facility(k))

name='fairytale-environment' if environment else 'fairytale-cottage-sample' if sample else 'fairytale'
out=ROOT/('public/assets/'+name+'.glb')
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
source=ROOT/'artifacts/fairytale'
source.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source/(name+'.blend')))
print(f'FAIRYTALE_GLB_BYTES={out.stat().st_size}')
