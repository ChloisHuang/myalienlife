"""Authored ocean geometry; one shared small ground texture is assigned by the runtime."""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
rebuild_wreck='--wreck-only' in sys.argv
rebuild_palace='--palace-only' in sys.argv
rebuild_back='--back-only' in sys.argv or rebuild_wreck or rebuild_palace
rebuild_houses='--houses-only' in sys.argv
rebuild_pools='--front-pools-only' in sys.argv
if rebuild_back or rebuild_houses or rebuild_pools:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'artifacts/ocean/ocean.blend'))
else:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name, color, glow=0):
    rgb = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.get(name) if rebuild_back or rebuild_houses or rebuild_pools else None
    if m is None:m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .72
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = glow
    return m

M = {k: material(k, c) for k, c in {
    'ivory':'F4E6D4', 'sand':'EAD2AC', 'stone':'C8D2C9', 'pink':'F7B59E',
    'coral':'ED8B86', 'teal':'399DAD', 'kelp':'839957', 'gold':'B89A67',
    'wood':'9C765B', 'dark':'427B89', 'slate':'64939D', 'reef':'8ABAB8',
    'floor':'428F9C', 'pearl':'D6ECE5', 'red':'D25D61', 'dampSand':'AAA878', 'submergedStone':'6FA49A', 'lagoonBed':'90C5B7', 'treasure':'EDBD46', 'deepKelp':'476375', 'deepCoral':'777497'
}.items()}
M['glow'] = material('ocean cold pearl', 'BCEDE9', .6)
M['window'] = material('ocean warm glass', 'F4DBA6', .35)
M['shellRib'] = material('ocean shell rib', 'FFE1BA', .85)
M['mermaidSkin'] = material('mermaid skin', 'F2D6C6')
M['mermaidTail'] = material('mermaid turquoise scales', '51AFB1')
M['mermaidHair'] = material('mermaid flowing hair', 'DF6678')
M['mermaidShell'] = material('mermaid blue shells', '59B9ED')
M['wreckShadow'] = material('sunken ship silhouette', '163A42')
SHORE_PATCHES=[(-10,4,1.3,.7),(-6,-7,1.7,.6),(3,-8,1.3,.65),(11,1,1.1,.8),(-11,-4,1.2,.7),(1,8.5,1,.5)]

def xyz(p):
    return (p[0], -p[2], p[1])

def finish(o, mat):
    o.data.materials.append(M[mat])
    return o

def box(p, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    o = bpy.context.object
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier=o.modifiers.new('worn stone edge','BEVEL');modifier.width=bevel;modifier.segments=2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(o, mat)

def ball(p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=xyz(p))
    o = bpy.context.object
    o.scale = (size[0], size[2], size[1])
    for poly in o.data.polygons:
        poly.use_smooth = True
    return finish(o, mat)

def rod(a, b, radius, mat, tip=None):
    a, b = Vector(xyz(a)), Vector(xyz(b))
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=radius,
        radius2=radius if tip is None else tip, depth=(b-a).length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    for poly in o.data.polygons:
        if len(poly.vertices)==4:poly.use_smooth=True
    return finish(o, mat)

def curve(points, radius, mat, taper=False):
    c = bpy.data.curves.new('ocean rib', 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth = radius
    c.bevel_resolution = 1
    poly = c.splines.new('POLY')
    poly.points.add(len(points)-1)
    for i,(p, co) in enumerate(zip(poly.points, points)):
        p.co = (*xyz(co), 1)
        if taper:p.radius=max(.015,1-i/(len(points)-1))
    o = bpy.data.objects.new('ocean rib', c)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    o.select_set(False)
    return o

def mesh(name, verts, faces, mat):
    geo = bpy.data.meshes.new(name)
    geo.from_pydata([xyz(p) for p in verts], [], faces)
    geo.update()
    o = bpy.data.objects.new(name, geo)
    bpy.context.collection.objects.link(o)
    return finish(o, mat)

def lathe(p, profile, mat, n=24):
    v, f = [], []
    for r, h in profile:
        v += [(p[0]+r*math.cos(i*math.tau/n), p[1]+h, p[2]+r*math.sin(i*math.tau/n)) for i in range(n)]
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            f.append((a, a+n, b+n, b))
    f += [tuple(reversed(range(n))), tuple((len(profile)-1)*n+i for i in range(n))]
    o=mesh('turned shell stone', v, f, mat)
    for poly in o.data.polygons:
        if len(poly.vertices)==4:poly.use_smooth=True
    return o

def arch(x,y,z,w,h,mat='ivory',r=.09):
    curve([(x-w/2,y,z),(x-w/2,y+h*.55,z)]+[
        (x-w/2*math.cos(i*math.pi/12),y+h*.55+h*.45*math.sin(i*math.pi/12),z)
        for i in range(13)]+[(x+w/2,y,z)], r, mat)

def scallop(x,y,z,w,h,d,mat='pink'):
    v,f=[],[]
    for j in range(9):
        t=j/8
        for i in range(25):
            a=i*math.pi/24
            rib=1+.035*math.cos(a*16)
            v.append((x+math.cos(a)*w*.5*math.sin(t*math.pi/2)*rib,
                y+math.sin(a)*h*math.sin(t*math.pi/2)*rib,
                z+d*(.5-t)))
    for j in range(8):
        for i in range(24):
            a=j*25+i;f.append((a,a+1,a+26,a+25))
    mesh('fluted scallop shell',v,f,mat)
    for i in range(0,25,3):
        a=i*math.pi/24
        curve([(x+math.cos(a)*w*.5*math.sin(t*math.pi/2)*1.01,
            y+math.sin(a)*h*math.sin(t*math.pi/2)*1.01,z+d*(.5-t))
            for t in [j/8 for j in range(9)]],.033,'ivory')

def shell_roof(x,y,z,w,h,d):
    verts=[];faces=[]
    def point(i,j):
        a=i*math.pi/64;t=j/28
        length=.25+.75*math.sin(t*math.pi/2)
        rib=1+.055*math.cos(a*18)
        return (x+math.cos(a)*w*.5*length*rib,y+math.sin(a)*h*length*rib,z+d*(t-.5))
    for j in range(29):
        for i in range(65):verts.append(point(i,j))
    for j in range(28):
        for i in range(64):
            a=j*65+i;faces.append((a,a+1,a+66,a+65))
    roof=mesh('radiating peach scallop roof',verts,faces,'pink')
    for p in roof.data.polygons:p.use_smooth=True
    paint=roof.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for j in range(29):
        for i in range(65):
            ridge=.5+.5*math.cos(i*math.pi/64*18);rim=(j/28)**5
            paint.data[j*65+i].color=(1,.72+.22*ridge+.06*rim,.59+.29*ridge+.12*rim,1)
    for i in range(0,65,7):curve([point(i,j) for j in range(29)],.036,'shellRib')
    curve([point(i,28) for i in range(65)],.10,'shellRib')
    facade=[];faces=[]
    for row in range(17):
        t=row/16
        for i in range(65):
            px,py,pz=point(i,28);a=i*math.pi/64
            facade.append((x+(px-x)*t,y-.8+(py-y+.8)*t,pz+.24*math.sin(t*math.pi)*math.sin(a)+.035*math.cos(a*18)*t))
    for row in range(16):
        for i in range(64):
            a=row*65+i;faces.append((a,a+1,a+66,a+65))
    front=mesh('curved fluted shell facade',facade,faces,'pink')
    for p in front.data.polygons:p.use_smooth=True
    for i in range(0,65,7):curve([facade[row*65+i] for row in range(7,17)],.028,'shellRib')

def clam_shell(x,y,z,w,d,h):
    verts=[];faces=[];segments=96
    for row in range(13):
        r=.02+row/12*.98
        for i in range(segments):
            a=i*math.tau/segments;flute=1+.065*math.cos(a*12)*r*r
            verts.append((x+math.cos(a)*w*.5*r*flute,y+.10+.32*r*r,z+math.sin(a)*d*.5*r*flute))
    for row in range(12):
        for i in range(segments):
            a=row*segments+i;b=row*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    bowl=mesh('cupped scalloped lower shell',verts,faces,'pink')
    for p in bowl.data.polygons:p.use_smooth=True
    curve(verts[-segments:]+[verts[-segments]],.055,'ivory')
    for i in range(0,segments,8):curve([verts[row*segments+i] for row in range(13)],.022,'ivory')
    verts=[];faces=[]
    for row in range(17):
        r=row/16
        for i in range(65):
            a=(i/64-.5)*math.pi;flute=1+.05*math.cos(a*14)*r*r
            verts.append((x+math.sin(a)*w*.54*r*flute,y+.4+math.cos(a)*h*r*flute,z-d*.38-.27*math.sin(r*math.pi)))
    for row in range(16):
        for i in range(64):
            a=row*65+i;faces.append((a,a+1,a+66,a+65))
    lid=mesh('broad fluted pearl shell back',verts,faces,'pink')
    for p in lid.data.polygons:p.use_smooth=True
    curve(verts[-65:],.07,'ivory')
    for i in range(0,65,8):curve([verts[row*65+i] for row in range(17)],.027,'ivory')

def house(x,z,heading):
    before=set(bpy.context.scene.objects)
    lathe((x,.29,z),[(1.7,0),(1.6,.18),(1.48,1.1),(1.4,1.5)],'ivory')
    shell_roof(x,1.25,z,3.7,2,3.2)
    box((x,1.05,z+1.94),(.8,1.5,.09),'wood',.04)
    arch(x,.31,z+2.01,1,1.65)
    for dx in [-.26,0,.26]:rod((x+dx,.42,z+2.03),(x+dx,1.65,z+2.03),.018,'gold')
    ball((x+.23,1,z+2.08),(.055,.055,.045),'gold')
    for i in range(18):
        a=i*math.tau/18
        for row in range(2):
            o=box((x+1.55*math.cos(a),.38+row*.22,z+1.55*math.sin(a)),(.47,.19,.23),'stone' if i%3 else 'ivory')
            o.rotation_euler.z=-a
    for dx in [-.97,.97]:
        ball((x+dx,1.1,z+1.95),(.23,.3,.06),'window')
        arch(x+dx,.8,z+2.03,.55,.65)
    for i in range(3):
        box((x,.32+i*.09,z+1.9-i*.2),(1.25,.12,.38),'stone')
    pivot=Vector(xyz((x,0,z)))
    transform=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(heading),4,'Z') @ Matrix.Translation(-pivot)
    for o in set(bpy.context.scene.objects)-before:
        o.matrix_world=transform @ o.matrix_world

def coral(x,y,z,s,mat='coral'):
    def branch(a,b,r1,r2):
        if mat!='deepCoral':return rod(a,b,r1,mat,r2)
        points=[]
        for i in range(7):
            t=i/6;bow=math.sin(t*math.pi)*s*.12
            points.append((a[0]+(b[0]-a[0])*t+bow,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+bow*.5))
        return curve(points,r1*.7,mat,taper=True)
    for j in range(3):
        a=j*2.1+.3
        p=(x+math.cos(a)*s*.25,y+s*.55,z+math.sin(a)*s*.25)
        branch((x,y,z),p,s*.13,s*.08)
        for k in [-1,1]:
            q=(p[0]+math.cos(a+k*.65)*s*.32,p[1]+s*(.32+j*.09),p[2]+math.sin(a+k*.65)*s*.32)
            branch(p,q,s*.08,s*.055)
            tip=(q[0]+.08*s,q[1]+.18*s,q[2])
            branch(q,tip,s*.055,s*.045)
            if mat!='deepCoral':ball(tip,(s*.05,s*.055,s*.05),mat)

def seagrass(x,y,z,s=1):
    for k in range(5):
        verts=[];faces=[];angle=k*2.399;h=s*(.5+k*.12)
        for i in range(9):
            t=i/8;cx=x+math.sin(t*2.4+k)*.24*s;cz=z+math.cos(angle)*t*.18*s
            width=.055*s*math.sin(t*math.pi)**.7
            for sign in [-1,1]:verts.append((cx+sign*width,y+t*h,cz+sign*width*.3))
        for i in range(8):a=i*2;faces.append((a,a+1,a+3,a+2))
        mesh('ribbon seagrass',verts,faces,'deepKelp')

def submerged_garden():
    for i,(x,z) in enumerate([(-5,-3),(-1,-4),(3,-3),(5,0),(-3,3),(1,5),(7,4),(-10,5),(-11,-5)]):
        for j in range(2):
            xx=x+.7*math.cos(j*2.4);zz=z+.7*math.sin(j*2.4)
            if i%2==0:seagrass(xx,.25,zz,.8+(i%3)*.15)
        if i%2==0:coral(x,.25,z,.65,'deepCoral')
        for j in range(3):
            a=j*2.399
            ball((x+math.cos(a)*.6,.27,z+math.sin(a)*.6),(.44,.08,.35),'sand' if i%2 else 'stone')
    for i,(x,z) in enumerate([(-4,-1),(-1,-2),(2,0),(5,3),(-2,5),(7,1),(-6,3),(1,6),(5,6),(-9,5)]):
        h=1.8+(i%4)*.55
        lathe((x,.25,z),[(.48,0),(.48,.15),(.35,.25),(.28,.34),(.28,h),(.40,h+.05),(.40,h+.18)],'slate',16)
        for j in range(8):
            a=j*math.tau/8
            rod((x+math.cos(a)*.29,.62,z+math.sin(a)*.29),(x+math.cos(a)*.29,h+.2,z+math.sin(a)*.29),.025,'reef')
        for dx in [-.5,.45]:box((x+dx,.29,z+.6),(.48,.10,.32),'reef')
    for i in range(14):
        x=-5+i*.7;z=2.4+math.sin(i*.3)*.6
        box((x,.265,z),(.55,.035,.42),'reef')

def floor(dark):
    if not dark:
        front_floor()
        return
    # Thin independent faces keep the physically inverted scene clear of its opposite.
    n=96;rx=14.6;rz=10.4
    def boundary(a):
        return 1+.022*math.sin(a*5)+.018*math.cos(a*9)
    v=[(0,.22,0)]+[(rx*math.cos(i*math.tau/n)*boundary(i*math.tau/n),.22,rz*math.sin(i*math.tau/n)*boundary(i*math.tau/n)) for i in range(n)]
    f=[(0,(i+1)%n+1,i+1) for i in range(n)]
    mesh('submerged reef floor' if dark else 'lagoon sand bed',v,f,'floor' if dark else 'sand')
    for level in range(3):
        verts=[];faces=[]
        for ring in range(2):
            for i in range(n):
                a=i*math.tau/n;r=boundary(a)*(1-.015*level)+.012*math.sin(i*1.7+level)
                y=.27-level*.26-ring*.27+.09*math.sin(i*1.3+level)
                verts.append((rx*math.cos(a)*r,y,rz*math.sin(a)*r))
        for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
        mesh('irregular limestone course',verts,faces,'reef' if dark else 'ivory' if level%2==0 else 'stone')
    for i in range(43):
        a=i*math.tau/43;r=boundary(a);x=rx*math.cos(a)*r;z=rz*math.sin(a)*r
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=xyz((x,-.22+.1*math.sin(i*2),z)))
        o=bpy.context.object;o.scale=(.48+.18*math.sin(i),.45,.36+.15*math.cos(i*2));finish(o,'slate' if dark else 'stone')
    # Readable submerged mosaic, never a dry-looking plaza on the reverse.
    for i in range(25):
        a=i*math.tau/25;x=8.4*math.cos(a);z=6*math.sin(a)
        o=box((x,.26 if dark else .43,z),(.66,.035,.5),'reef' if dark else 'ivory')
        o.rotation_euler.z=-a

def ground(x,z):
    a=math.atan2(z/10.4,x/14.6)
    r=math.hypot(x/14.6,z/10.4);bend=.055*math.sin(r*21)+.028*math.sin(r*43)
    if r<=.59 or .78+bend<a<1.38+bend:return .29
    return 1.55+.10*math.sin(x*.5)*math.cos(z*.45)

def raised(build,x,z):
    before=set(bpy.context.scene.objects);build()
    for o in set(bpy.context.scene.objects)-before:o.location.z+=ground(x,z)-.29

def front_floor():
    n=100;start=1.38;end=math.tau+.78
    def point(a,r):
        edge=math.exp(-((a-start)/.18)**2)+math.exp(-((a-end)/.18)**2)
        a+=(.055*math.sin(r*21)+.028*math.sin(r*43))*edge
        ripple=1+.02*math.sin(a*7)+.016*math.sin(a*13)
        return 14.6*math.cos(a)*r*ripple,10.4*math.sin(a)*r*ripple
    # An open U of limestone, with separately modeled inner cliffs and open-water mouth.
    verts=[];faces=[]
    for r in [.59,.68,.84,1]:
        for i in range(n+1):
            a=start+(end-start)*i/n;x,z=point(a,r)
            verts.append((x,1.55+.10*math.sin(x*.5)*math.cos(z*.45),z))
    for row in range(3):
        for i in range(n):
            a=row*(n+1)+i;faces.append((a,a+1,a+n+2,a+n+1))
    top=mesh('authored horseshoe sand terrace',verts,faces,'sand')
    paint=top.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for i,(x,y,z) in enumerate(verts):
        t=.5+.25*math.sin(x*.8+z*.5)+.25*math.cos(z*1.2-x*.4)
        # Broad dune and damp-sand regions survive the distant gameplay camera.
        dry=(1,.97,.88);wet=(.76,.74,.59)
        paint.data[i].color=tuple(dry[k]*(1-t*.6)+wet[k]*t*.6 for k in range(3))+(1,)
    for r in [.59,1]:
        for row in range(4):
            verts=[];faces=[]
            for level in [0,1]:
                for i in range(n+1):
                    a=start+(end-start)*i/n
                    rr=r+(.015*math.sin(i*2+row)+.005*row)*(1 if r==1 else -1)
                    x,z=point(a,rr);y=1.54-row*.46-level*.49+.08*math.sin(i*1.3+row)
                    verts.append((x,y,z))
            for i in range(n):faces.append((i,i+1,i+n+2,i+n+1))
            mesh('limestone cliff core',verts,faces,'ivory')
        for row in range(3):
            for i in range(58):
                a=start+(end-start)*(i+.5*(row%2))/58
                x,z=point(a,r);y=1.15-row*.51+.10*math.sin(i*3+row)
                block=box((x,y,z),(.76 if r==.59 else 1.28,.64+.10*math.sin(i),.55),'stone' if (i+row)%7==0 else 'ivory',.12)
                block.rotation_euler.z=-a+math.pi/2+.07*math.sin(i*2)
        for i in range(58):
            a=start+(end-start)*i/57;x,z=point(a,r)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=xyz((x,1.33+.1*math.sin(i),z)))
            o=bpy.context.object;o.scale=(.48+.18*math.sin(i*4),.38,.31+.12*math.sin(i*2));finish(o,'ivory' if i%3 else 'stone')
    for a in [start,end]:
        verts=[]
        for level in [0,1]:
            for i in range(17):
                r=.59+.41*i/16;x,z=point(a,r)
                verts.append((x,-.3 if level==0 else 1.55+.10*math.sin(x*.5)*math.cos(z*.45),z))
        mesh('naturally eroded channel bank',verts,[(i,i+1,i+18,i+17) for i in range(16)],'ivory')
        for i in range(12):
            r=.60+.39*i/11;x,z=point(a,r)
            for row in range(3):
                block=box((x,1.15-row*.54+.1*math.sin(i*2),z),(.63,.64,.61),'ivory',.16)
                block.rotation_euler.z=i*.31
    # Low seabed connects the lagoon and the projecting water shelf without closing the cliff gap.
    verts=[(0,.18,0)];faces=[]
    for i in range(120):
        a=i*math.tau/120;r=1.08 if .72<a<1.43 else .63
        x,z=point(a,r);verts.append((x,.18,z))
    for i in range(120):faces.append((0,(i+1)%120+1,i+1))
    mesh('visible lagoon floor and outlet shelf',verts,faces,'lagoonBed')
    # Submerged boulders have readable sides and sit on the bed, never on the water surface.
    for k,(cx,cz,sx,sz,h) in enumerate([(-6.7,-1.4,1.05,.73,.37),(-5.55,-1.9,.48,.41,.19),
            (-6.05,.05,.76,.52,.28),(-5.2,.65,.38,.29,.16),(-6.5,1.25,.58,.81,.24),
            (-4.3,-4.5,.95,.61,.33),(-3.3,-4.7,.32,.4,.18),(-1.4,-5.1,.69,.44,.26),
            (2.8,-4.7,1.22,.77,.38),(3.9,-4.15,.45,.29,.17),(3.65,-3.25,.77,.53,.28),
            (5.3,-3.6,.56,.88,.24),(6.9,.65,.65,1.05,.33),(6.15,1.15,.28,.38,.17),
            (5.9,3.9,.97,.51,.29),(6.65,3.1,.38,.43,.19)]):
        verts=[];faces=[];n=11
        for row,(scale,y) in enumerate([(1,.17),(1,.17+h*.65),(.82,.17+h)]):
            for i in range(n):
                a=i*math.tau/n;r=1+.19*math.sin(i*2.7+k)
                xx,zz=math.cos(a)*sx*r*scale,math.sin(a)*sz*r*scale;turn=k*1.73
                verts.append((cx+xx*math.cos(turn)-zz*math.sin(turn),y+.045*math.sin(i*3+k),cz+xx*math.sin(turn)+zz*math.cos(turn)))
        for row in range(2):
            for i in range(n):a=row*n+i;b=row*n+(i+1)%n;faces.append((a,b,b+n,a+n))
        faces.append(tuple(range(n*2,n*3)))
        mesh('weathered boulder below clear lagoon',verts,faces,'submergedStone')
        for j in range(2):
            a=k+j*2.4
            ball((cx+math.cos(a)*sx,.23,cz+math.sin(a)*sz),(.27,.07,.22),'submergedStone')
    for i in range(34):
        a=start+(end-start)*i/33;x,z=point(a,.79)
        o=box((x,ground(x,z)+.035,z),(.66,.06,.53),'ivory');o.rotation_euler.z=-a
    for cx,cz,sx,sz in SHORE_PATCHES:
        verts=[(cx,ground(cx,cz)+.015,cz)]
        for i in range(24):
            a=i*math.tau/24;r=1+.13*math.sin(a*5)+.07*math.sin(a*9)
            x,z=cx+sx*math.cos(a)*r,cz+sz*math.sin(a)*r
            verts.append((x,ground(x,z)+.018,z))
        mesh('damp seagrass soil patch',verts,[(0,(i+1)%24+1,i+1) for i in range(24)],'dampSand')

def seaside_details():
    verts=[];faces=[]
    for cx,cz,sx,sz in SHORE_PATCHES:
        for i in range(32):
            a=i*2.39996;r=.8*math.sqrt(i/32)
            x,z=cx+math.cos(a)*sx*r,cz+math.sin(a)*sz*r;y=ground(x,z)+.025
            for j in range(3):
                dx,dz=math.cos(a+j*2.1)*.055,math.sin(a+j*2.1)*.055;k=len(verts)
                verts.extend([(x-dx,y,z-dz),(x+dx,y,z+dz),(x+dx*2,y+.16+(i%4)*.055,z+dz*2)])
                faces.append((k,k+1,k+2))
    mesh('authored coastal meadow blades',verts,faces,'kelp')
    for i,a in enumerate([1.7,2.1,2.5,2.9,3.3,3.65,4.1,4.55,5.1,5.65,6,.25,.55]):
        for r in [.61,.96]:
            x,z=14.6*math.cos(a)*r,10.4*math.sin(a)*r;y=ground(x,z)
            for j in range(4):coral(x+.24*j,y,z+.2*j,.6+.2*((i+j)%3),'coral' if j%2 else 'pink')
            # Thin plate corals grow from the cliff face, rather than balls scattered on the ground.
            for j in range(3):
                ball((x,y-.65-j*.28,z),(.55-j*.08,.06,.44-j*.04),'coral' if j%2 else 'pink')
        x,z=14.6*math.cos(a)*.86,10.4*math.sin(a)*.86
        for j in range(16):
            xx=x+.6*math.cos(j*2.4);zz=z+.5*math.sin(j*2.4);y=ground(xx,zz)
            mesh('sea grass blades',[(xx-.04,y,zz),(xx+.04,y,zz),(xx+.10,y+.23+(j%4)*.06,zz+.06)],[(0,1,2)],'kelp')
        # Small radial starfish and shell chips are authored edge detail, not shop items.
        for j in range(5):
            angle=j*math.tau/5
            rod((x,ground(x,z)+.05,z),(x+math.cos(angle)*.23,ground(x,z)+.06,z+math.sin(angle)*.23),.055,'coral',.014)

def lagoon_fountain():
    x,z=-8.3,0
    lathe((x,.22,z),[(1.2,0),(1.15,.6),(1.5,.85)],'ivory',32)
    for i in range(11):
        a=i*math.tau/11
        box((x+math.cos(a)*1.13,.65,z+math.sin(a)*1.13),(.62,.75,.55),'stone' if i%4==0 else 'ivory',.13)
    lathe((x,1.1,z),[(1.5,0),(1.55,.25),(1.45,.5),(1.26,.5),(1.25,.25)],'ivory',48)
    lathe((x,1.4,z),[(.48,0),(.28,.15),(.14,.7),(.52,.88),(.62,1.02),(.5,1.10)],'ivory',40)
    for i in range(8):
        a=i*math.tau/8
        ball((x+math.cos(a)*1.44,1.58,z+math.sin(a)*1.44),(.13,.08,.11),'ivory')
    for dx,dz,h in [(1.4,.6,.55),(1.9,.1,.32),(.9,1.3,.25)]:
        lathe((x+dx,.18,z+dz),[(.5,0),(.47,h),(.4,h+.07)],'stone',8)

def lighthouse():
    x,z=7,-7
    lathe((x,.29,z),[(2.3,0),(2.3,.25),(2.15,.38)],'ivory')
    for i in range(10):
        a=i*math.tau/10
        xx,zz=x+2*math.cos(a),z+2*math.sin(a)
        rod((xx,.55,zz),(xx,1,zz),.055,'gold')
    lathe((x,.35,z),[(2,0),(2,.15),(1.6,.3),(1.35,.4),(.85,4.5),(1.32,4.65),(1.32,4.9)],'ivory')
    for y,r in [(1.1,1.32),(2.5,1.16),(4.5,.95)]:
        lathe((x,y,z),[(r,0),(r+.035,.07),(r,.14)],'stone')
    for i in range(8):
        box((x,.32+i*.09,z+2.4-i*.22),(1.4,.11,.38),'ivory')
    # Solid conch body with a broad forward aperture enclosing the lantern.
    profile=[(.45,5.15),(.95,5.4),(1.45,5.95),(1.5,6.55),(1.3,7.05),(.95,7.5)]
    verts=[];faces=[]
    for r,y in profile:
        for i in range(49):
            a=2.65+(math.tau+.49-2.65)*i/48
            verts.append((x+math.cos(a)*r,y,z+math.sin(a)*r))
    for row in range(len(profile)-1):
        for i in range(48):
            a=row*49+i;faces.append((a,a+49,a+50,a+1))
    body=mesh('opaque pearly conch chamber',verts,faces,'pink')
    for p in body.data.polygons:p.use_smooth=True
    lip=[]
    for i in range(97):
        a=i*math.tau/96;flute=1+.045*math.cos(a*12)
        lip.append((x+math.cos(a)*1.32*flute,6.35+math.sin(a)*1.23*flute,z+.82+.18*math.sin(a)))
    curve(lip,.13,'ivory')
    lathe((x,7.36,z),[(.96,0),(.87,.2),(.68,.55),(.51,.9),(.35,1.2),(.18,1.55),(.015,1.95)],'pink',48)
    curve([(x+(1-t)*.98*math.cos(t*math.tau*3.5),7.4+t*1.9,z+(1-t)*.98*math.sin(t*math.tau*3.5)) for t in [i/144 for i in range(145)]],.065,'ivory')
    lathe((x,5.3,z+.5),[(.54,0),(.54,.12),(.34,.2)],'gold')
    ball((x,6.05,z+.92),(.55,.55,.55),'window')
    for dx in [-.72,.72]:
        curve([(x+dx,5.45,z+.5),(x+dx*.94,6.48,z+.42),(x+dx*.5,6.85,z+.25)],.045,'gold')
    arch(x,.4,z+1.4,1,1.7,'stone',.12)
    for y in [2.7,4]:
        ball((x,y,z+1.06),(.19,.34,.06),'dark')
        arch(x,y-.34,z+1.12,.48,.76,'stone',.045)
    for sign in [-1,1]:
        xx=x+sign*2.7
        rod((xx,.4,z),(xx,3.5,z),.07,'wood')
        points=[(xx,3.3,z),(xx-sign*.9,2.95,z),(x+sign*.9,3.8,z)]
        curve(points,.025,'gold')
        mesh('scalloped sail canopy',[(xx,3.3,z),(xx-sign*.9,2.95,z+.08),(x+sign*.9,3.8,z),
            (x+sign*.9,3.65,z-1.2),(xx-sign*.9,2.8,z-1.2),(xx,3.15,z-1.2)],[(0,1,4,5),(1,2,3,4)],'pink')
        for i in range(5):
            t=i/5;px=xx+(x+sign*.9-xx)*t;py=3.3+.5*t-.4*math.sin(t*math.pi)
            mesh('coral pennant',[(px,py,z),(px-sign*.28,py+.04,z),(px-sign*.14,py-.4,z+.04)],[(0,1,2)],'coral')
    rail=[]
    for i in range(19):
        a=-.45+i*.11;y=.55+i*.115;r=1.65-i*.016
        xx,zz=x+math.cos(a)*r,z+math.sin(a)*r
        step=box((xx,y,zz),(.63,.14,.30),'ivory',.045);step.rotation_euler.z=-a
        rail.append((x+math.cos(a)*(r+.3),y+.46,z+math.sin(a)*(r+.3)))
    curve(rail,.11,'ivory')
    for i in range(12):
        a=i*math.tau/12
        rod((x+1.23*math.cos(a),4.95,z+1.23*math.sin(a)),(x+1.23*math.cos(a),5.35,z+1.23*math.sin(a)),.045,'wood')
    lathe((x,5.33,z),[(1.28,0),(1.28,.06)],'ivory',40)

def palace():
    x,z=7,-7
    before=set(bpy.context.scene.objects)
    box((x,2.05,z),(3.3,2.55,2.7),'slate',.12)
    roof=[(x-1.8,3.3,z-1.5),(x+1.8,3.3,z-1.5),(x-.55,5.35,z-1.5),(x-1.8,3.3,z+1.5),(x+1.8,3.3,z+1.5),(x+.2,4.65,z+1.5)]
    mesh('solid palace gabled roof',roof,[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5)],'dark')
    for zz,dx,h in [(z-1.52,-.55,5.4),(z+1.52,.2,4.7)]:curve([(x-1.85,3.3,zz),(x-1.2,3.7,zz),(x+dx,h,zz),(x+1.3,3.65,zz),(x+1.85,3.3,zz)],.09,'reef')
    def lancet(xx,yy,zz,w,h):
        points=[(xx-w/2,yy,zz),(xx-w/2,yy+h*.65,zz),(xx,yy+h,zz),(xx+w/2,yy+h*.65,zz),(xx+w/2,yy,zz)]
        mesh('narrow abyssal lancet',points,[tuple(range(5))],'glow')
        curve(points,.045,'reef')
        rod((xx,yy,zz+.025),(xx,yy+h*.87,zz+.025),.026,'dark')
    for side in [-1,1]:
        for dx in [-1.05,0,1.05]:
            lancet(x+dx,1.15,z+side*1.45,.25,1.6+(dx==0)*.25)
    box((x,1.65,z+1.53),(.72,1.65,.10),'dark',.06)
    curve([(x-.54,.8,z+1.63),(x-.5,2.25,z+1.63),(x+.05,3.35,z+1.63),(x+.5,2.2,z+1.63),(x+.54,.8,z+1.63)],.105,'reef')
    lancet(x+.12,3.4,z+1.59,.25,.78)
    for sign in [-1,1]:
        curve([(x+sign*1.7,.8,z+1.65),(x+sign*1.45,2.6,z+1.65),(x+sign*1.02,3.7,z+1.65),(x+sign*.8,4.65,z+1.65)],.12,'slate')
    for dx,dz,h in [(-1.9,-.85,4.2),(1.9,-.85,5.3),(-1.85,1,2.8),(1.85,1,3.25)]:
        xx,zz=x+dx,z+dz;r=.48
        lathe((xx,.75,zz),[(.64,0),(.64,.18),(r,.25),(r,h-.55),(.52,h-.5),(.46,h-.3),(.27,h+.25),(0,h+1.2)],'slate',24)
        for j in range(6):
            a=j*math.tau/6
            rod((xx+math.cos(a)*r,.97,zz+math.sin(a)*r),(xx+math.cos(a)*r,h+.15,zz+math.sin(a)*r),.045,'reef')
        for sign in [-1,1]:
            lancet(xx,1.48,zz+sign*.53,.17,1.35)
        curve([(xx+.48,h-.05,zz),(xx+.45,h+.65,zz),(xx+.2,h+1.5,zz),(xx-.25,h+1.9,zz)],.07,'reef')
    for o in set(bpy.context.scene.objects)-before:o.location.z-=.5
    for i in range(3):box((x,.26+i*.05,z+2.2-i*.22),(1.5,.10,.38),'reef',.035)

def bones():
    x,z=-8,-1
    lathe((x,.29,z),[(1.9,0),(1.9,.2),(1.65,.32)],'reef')
    lathe((x,.6,z),[(1.1,0),(1.1,1.35),(.8,1.8),(0,2.5)],'slate')
    for a in [-.8,0,.8,2.2,3.1,4.0]:
        dx,dz=math.sin(a),math.cos(a)
        curve([(x+dx*1.7,.5,z+dz*1.7),(x+dx*1.65,1.6,z+dz*1.65),(x+dx*1.15,2.7,z+dz*1.15),(x+dx*.45,3.4,z+dz*.45),(x+dx*.2,3.7,z+dz*.2)],.23,'pearl',taper=True)
    box((x,1.25,z+1.08),(.6,1.15,.06),'window',.08)
    arch(x,.63,z+1.16,.87,1.55,'reef',.09)
    for i in range(4):box((x,.3+i*.08,z+2.2-i*.22),(1.2,.11,.4),'reef',.03)

def wreck():
    x,z=-8,-7
    before=set(bpy.context.scene.objects)
    # Keep the hull readable, with one localized breach rather than a bare skeleton.
    for sign in [-1,1]:
        for row in range(5):
            vertices=[];faces=[]
            for j in range(25):
                t=(j-12)/12
                for edge in [0,1]:
                    y=.52+(row+edge*.88)*.22
                    w=1.18*math.sqrt(max(.025,1-t*t))*(.55+.45*(y-.52)/1.1)
                    vertices.append((x+sign*w,y,z+t*2.6))
            for j in range(24):
                if sign==1 and row>1 and 9<=j<=17 or sign==-1 and row==4 and 16<=j<=19:continue
                a=j*2;faces.append((a,a+1,a+3,a+2))
            mesh('weathered hull planking',vertices,faces,'wood' if row%2 else 'gold')
    for j in range(17):
        t=(j-8)/8;w=1.02*math.sqrt(max(.02,1-t*t))
        if j in [6,7,8,9,10]:continue
        deck=box((x,1.26,z+t*2.25),(w*2,.09,.24),'wood',.02)
        deck.rotation_euler.z=.025*math.sin(j*3)
    box((x,1.66,z-1.55),(1.32,.75,1.0),'wood',.08)
    box((x,2.1,z-1.55),(1.55,.12,1.18),'gold',.04)
    for dx in [-.4,.4]:
        box((x+dx,1.78,z-1.02),(.3,.3,.04),'dark',.03)
        arch(x+dx,1.58,z-.98,.36,.4,'gold',.025)
    lathe((x-.5,1.3,z+.85),[(.26,0),(.31,.25),(.26,.52)],'wood',12)
    for y in [1.37,1.73]:
        curve([(x-.5+.29*math.cos(i*math.tau/24),y,z+.85+.29*math.sin(i*math.tau/24)) for i in range(25)],.024,'gold')
    box((x+.4,1.48,z+1.4),(.5,.4,.55),'wood',.035)
    treasure_before=set(bpy.context.scene.objects)
    chest_x,chest_z=x+2,z+1.2
    box((chest_x,.53,chest_z),(.95,.48,.65),'wood',.055)
    lid=box((chest_x,.96,chest_z-.3),(.97,.12,.67),'wood',.04);lid.rotation_euler.x=math.radians(65)
    for dx in [-.34,.34]:box((chest_x+dx,.78,chest_z),(.055,.04,.67),'treasure')
    for i in range(32):
        a=i*2.399;r=.18+.65*(i%7)/7
        xx=chest_x+math.cos(a)*r;zz=chest_z+.45+math.sin(a)*r*.55
        lathe((xx,.31+.016*(i%3),zz),[(.07,0),(.07,.025)],'treasure',10)
    for i in range(8):ball((chest_x+.28*math.sin(i*3),.79,chest_z+.2*math.cos(i*2)),(.095,.05,.08),'treasure')
    treasure=set(bpy.context.scene.objects)-treasure_before
    mesh('fallen pirate pennant',[(x+.4,.48,z+.6),(x+1.2,.48,z+.9),(x+1,.48,z+1.15),(x+1.1,.48,z+1.4),(x+.3,.48,z+1.1)],[(0,1,2,3,4)],'dark')
    for dz,height,width in [(-.85,4.9,1.35),(1.1,4.1,1.05)]:
        rod((x,1.1,z+dz),(x-.25,height+.25,z+dz),.075,'wreckShadow')
        for top,span in [(height,width),(height-.95,width*.85)]:
            rod((x-span*.7,top,z+dz-span*.7),(x+span*.7,top,z+dz+span*.7),.055,'wreckShadow')
            sail=[(x-span*.7,top,z+dz-span*.7),(x+span*.7,top,z+dz+span*.7)]
            for i in range(9):
                u=1-i/4
                sail.append((x+span*u*.7,top-.62+(.20 if i%2 else 0),z+dz+span*u*.7+.16*(1-u*u)))
            mesh('ragged silhouette sail',sail,[tuple(range(len(sail)))],'wreckShadow')
        for sign in [-1,1]:
            curve([(x+sign*.85,1.5,z+dz+sign*.55),(x-.25,height+.2,z+dz)],.016,'wreckShadow')
    for dx,dz in [(-1.25,1.3),(1.1,-1.8)]:coral(x+dx,.3,z+dz,.55,'teal')
    for j in range(9):
        t=(j-4)/4;w=1.15*math.sqrt(max(.04,1-t*t))
        curve([(x-w,1.65,z+t*2.5),(x-w*.8,.75,z+t*2.5),(x,.4,z+t*2.5),(x+w*.8,.75,z+t*2.5),(x+w,1.65,z+t*2.5)],.085,'wood')
    for sign in [-1,1]:
        for y in [.9,1.2,1.55]:
            curve([(x+sign*1.12*math.sqrt(max(.03,1-t*t)),y,z+t*2.5) for t in [i/8 for i in range(-8,9)]],.08,'wood')
    rod((x,1.3,z+2),(x,2.35,z+3.5),.08,'wreckShadow')
    for sign in [-1,1]:
        curve([(x+sign,1.4,z+1.5),(x-.7,1.8,z-.3),(x+sign,1.4,z-1.5)],.02,'stone')
    pivot=Vector(xyz((x,.4,z)))
    transform=Matrix.Translation(pivot+Vector((0,0,-.22))) @ Matrix.Rotation(math.radians(-45),4,'Z') @ Matrix.Rotation(math.radians(14),4,'Y') @ Matrix.Scale(1.3,4) @ Matrix.Translation(-pivot)
    for o in set(bpy.context.scene.objects)-before-treasure:
        o.data.materials.clear();o.data.materials.append(M['wreckShadow'])
        o.matrix_world=transform @ o.matrix_world

def fountain(dark):
    x,z=10,4
    if dark:
        for dx,dz,h in [(0,0,1.9),(.65,.3,1.2),(-.55,.5,.95)]:
            lathe((x+dx,.29,z+dz),[(.65,0),(.52,.3),(.34,h*.65),(.29,h),(.18,h),(.16,h-.25)],'slate',11)
            lathe((x+dx,.29+h,z+dz),[(.29,0),(.29,.055),(.18,.055),(.18,0)],'reef',11)
            lathe((x+dx,.30+h,z+dz),[(.16,0),(.16,.01)],'glow',16)
    else:
        for dx,dz,r,h in [(0,0,1.35,.3),(-1.1,-.8,.85,.62),(.35,-1.4,.7,1.0)]:
            lathe((x+dx,.3,z+dz),[(r,0),(r,h),(r-.12,h+.1),(r-.22,h+.1),(r-.22,h-.15)],'ivory')
            lathe((x+dx,.3+h-.12,z+dz),[(r-.22,0),(r-.22,.015)],'teal')
            for i in range(8):
                a=i*math.tau/8
                ball((x+dx+(r-.08)*math.cos(a),h+.38,z+dz+(r-.08)*math.sin(a)),(.13,.08,.12),'stone')
        clam_shell(x+.35,1.05,z-1.4,2,1.65,1.4)
        lathe((x+.35,1.23,z-1.4),[(.30,0),(.27,.22),(.40,.28)],'ivory')
        ball((x+.35,1.87,z-1.4),(.35,.35,.35),'pearl')

def cottages():
    raised(lambda:house(-11,-1,24),-11,-1)
    raised(lambda:house(-9,-6.7,-12),-9,-6.7)

def mermaid():
    x,z=0,1.2
    ball((x,.45,z),(.8,.32,.7),'reef')
    ball((x-.2,.57,z+.1),(.55,.22,.55),'stone')
    # A curved, continuous fish tail with a broad split fluke.
    centers=[(0,1.2,0,.34),(.16,.95,.22,.32),(.43,.76,.43,.25),(.73,.68,.67,.18),(1.02,.77,.92,.10),(1.13,.95,1.06,.055)]
    verts=[];faces=[]
    for dx,y,dz,r in centers:
        for i in range(24):
            a=i*math.tau/24;verts.append((x+dx+math.cos(a)*r,y+math.sin(a)*r*.7,z+dz))
    for row in range(len(centers)-1):
        for i in range(24):a=row*24+i;b=row*24+(i+1)%24;faces.append((a,b,b+24,a+24))
    tail=mesh('curled mermaid tail',verts,faces,'mermaidTail')
    for p in tail.data.polygons:p.use_smooth=True
    for row in range(5):
        t=1+row*.6;i=int(t);f=t-i
        dx,y,dz,r=[centers[i][k]*(1-f)+centers[i+1][k]*f for k in range(4)]
        for col in [-1,0,1]:
            offset=col*r*.45
            curve([(x+dx+offset+math.cos(j*math.pi/8)*r*.18,y+r*.7*math.sqrt(max(0,1-((offset+math.cos(j*math.pi/8)*r*.18)/r)**2))+.008,z+dz+math.sin(j*math.pi/8)*.035) for j in range(9)],.006,'pearl')
    for sign in [-1,1]:
        fin=[(x+1.12,.93,z+1.05),(x+1.12+sign*.5,1.32,z+1.32),(x+1.12+sign*.63,1.49,z+1.62),(x+1.12+sign*.23,1.20,z+1.54)]
        mesh('split translucent-looking tail fin',fin,[(0,1,2,3)],'mermaidTail')
        curve([fin[0],fin[1],fin[2]],.017,'pearl')
        curve([fin[0],fin[3],fin[2]],.012,'pearl')
    torso=[ball((x,1.52,z),(.29,.46,.23),'mermaidSkin'),
           ball((x,1.87,z),(.4,.22,.22),'mermaidSkin')]
    bpy.context.view_layer.update()
    for sign in [-1,1]:
        shell=[];shell_faces=[]
        for row in range(9):
            t=row/8
            for i in range(25):
                a=i*math.pi/24;rib=1+.035*math.cos(a*10)
                sx=x+sign*.15+math.cos(a)*.18*t*rib
                sy=1.69+(.09+math.sin(a)*.21)*t*rib
                # Drape directly on the polygonal skin, not a floating frontal plane.
                origin=Vector(xyz((sx,sy,z+1)))
                hits=[]
                for body in torso:
                    inverse=body.matrix_world.inverted()
                    hit,point,_,_=body.ray_cast(inverse@origin,inverse.to_3x3()@Vector((0,1,0)))
                    if hit:hits.append(-(body.matrix_world@point).y)
                assert hits, 'shell outline must stay within the torso'
                shell.append((sx,sy,max(hits)+.003))
        for row in range(8):
            for i in range(24):a=row*25+i;shell_faces.append((a,a+1,a+26,a+25))
        count=len(shell)
        backing=[(sx,sy,sz-.008) for sx,sy,sz in shell]
        faces=shell_faces+[tuple(i+count for i in reversed(face)) for face in shell_faces]
        boundary=[row*25 for row in range(9)]+[200+i for i in range(1,25)]+[row*25+24 for row in reversed(range(8))]
        for i,a in enumerate(boundary):
            b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+count,a+count))
        mesh('scalloped shell bodice',shell+backing,faces,'mermaidShell')
        curve(shell[-25:],.010,'ivory')
        for i in range(0,25,4):curve([shell[row*25+i] for row in range(9)],.006,'ivory')
    rod((x,1.99,z),(x,2.12,z),.10,'mermaidSkin')
    ball((x,2.37,z),(.30,.36,.27),'mermaidSkin')
    ball((x,2.47,z-.12),(.34,.34,.27),'mermaidHair')
    hair=[];hair_faces=[]
    for dx,y,dz,r in [(-.15,2.65,-.09,.15),(-.28,2.49,0,.17),(-.31,2.28,.1,.16),(-.3,2.06,.2,.17),(-.35,1.85,.24,.16),(-.43,1.66,.26,.13),(-.46,1.48,.25,.075),(-.40,1.38,.26,.005)]:
        for i in range(24):
            a=i*math.tau/24;hair.append((x+dx+math.cos(a)*r,y,z+dz+math.sin(a)*r*.6))
    for row in range(7):
        for i in range(24):a=row*24+i;b=row*24+(i+1)%24;hair_faces.append((a,b,b+24,a+24))
    lock=mesh('single swept shoulder lock',hair,hair_faces,'mermaidHair')
    for p in lock.data.polygons:p.use_smooth=True
    for sign in [-1,1]:
        curve([(x+sign*.09,2.39,z+.245),(x+sign*.15,2.37,z+.255),(x+sign*.19,2.40,z+.23)],.018,'dark')
        ball((x+sign*.21,2.27,z+.2),(.045,.023,.014),'pink')
    ball((x,2.31,z+.27),(.045,.055,.045),'mermaidSkin')
    curve([(x-.045,2.22,z+.23),(x,2.21,z+.25),(x+.05,2.23,z+.23)],.012,'red')
    for a,b,c in [((-.35,1.86,0),(-.5,1.47,.08),(-.59,1.02,.22)),((.35,1.86,0),(.57,1.69,.22),(.72,1.87,.37))]:
        arm=[(x+p[0],p[1],z+p[2]) for p in [a,b,c]]
        rod(arm[0],arm[1],.082,'mermaidSkin',.065);ball(arm[1],(.07,.075,.07),'mermaidSkin');rod(arm[1],arm[2],.064,'mermaidSkin',.045);ball(arm[2],(.06,.085,.04),'mermaidSkin')
    ball((x+.73,2.02,z+.37),(.11,.11,.11),'glow')
    for i in range(5):
        a=(i-2)*.32
        ball((x+math.sin(a)*.28,2.68+math.cos(a)*.025,z+.12),(.035,.055,.03),'pearl')

def pearl_pools():
    raised(lambda:fountain(False),10,4)
    mermaid()

def terrain(dark):
    stage(0,lambda:floor(dark))
    def gardens():
        for i,a in enumerate([.12,.4,.8,1.2,1.7,2.1,2.5,2.9,3.3,3.65,4.1,4.55,5.1,5.65,6]):
            x,z=13.7*math.cos(a),9.7*math.sin(a)
            for j in range(3):
                coral(x+.35*j,.3,z+.2*j,.6+.2*((i+j)%3),'deepCoral' if dark else 'coral' if j%2 else 'pink')
            for j in range(1 if i%3==0 else 0):
                xx=x-.35*j
                seagrass(xx,.25,z,.9)
    stage(.2,lambda:(gardens(),submerged_garden()) if dark else seaside_details())
    stage(.4,bones if dark else cottages)
    stage(.6,wreck if dark else lagoon_fountain)
    stage(.8,lambda:fountain(True) if dark else pearl_pools())
    stage(1,palace if dark else lambda:raised(lighthouse,7,-7))

def facility(kind):
    if kind=='pod':
        clam_shell(0,.06,0,2.35,2.9,1.8)
        ball((0,.38,.15),(.83,.18,1.18),'ivory')
        ball((0,.56,-.65),(.59,.17,.30),'pearl')
        lathe((0,.3,-1.3),[(.24,0),(.18,.44),(.28,.5)],'ivory')
        ball((0,1.09,-1.3),(.29,.29,.29),'pearl')
    elif kind in ['shower','food']:
        lathe((0,0,0),[(.7,0),(.85,.18),(.75,.8),(.62,.86),(.5,.25)],'ivory')
        ball((0,.5,0),(.58,.035,.58),'teal')
        if kind=='shower':
            curve([(0,.15,-.6),(0,1.5,-.7),(.05,2.2,-.3),(0,2.15,.1)],.06,'gold')
            scallop(0,2.05,0,.5,.17,.4,'pearl')
        else:
            for x in [-.35,0,.35]:ball((x,.95,0),(.16,.18,.16),'coral')
    elif kind=='portal':
        for x in [-1.2,1.2]:coral(x,0,0,1.3,'ivory')
        arch(0,0,0,2.2,2.9,'ivory',.16)
        arch(0,.1,.04,1.95,2.6,'glow',.035)
        ball((0,2.9,0),(.2,.22,.2),'pearl')
    elif kind=='sofa':
        box((0,.38,0),(1.45,.3,2.4),'ivory')
        box((0,.59,0),(1.3,.16,2.3),'teal')
        for z in [-1.2,1.2]:scallop(0,.6,z,1.5,.7,.3)
    elif kind=='music':
        lathe((0,0,0),[(.65,0),(.45,.4)],'ivory')
        curve([(-.6,.4,0),(-.7,1.8,0),(.6,1.8,0),(.65,.4,0)],.09,'gold')
        for i in range(7):
            x=-.5+i*.16;rod((x,.5,0),(x,1.7,0),.012,'pearl')
    else:
        for x in [-.6,.6]:rod((x,0,0),(x,.95,0),.12,'ivory')
        box((0,.98,0),(1.8,.12,1.05),'pearl')
        if kind=='lab':
            ball((0,1.5,-.12),(.38,.43,.38),'glow')
            arch(0,1.02,-.12,1,1.1,'gold',.035)
        else:
            box((0,1.07,0),(1.35,.04,.75),'teal')
            for i in range(4):box((-.4+i*.28,1.1,0),(.018,.018,.65),'pearl')

def item(kind):
    if kind=='oceanPearlLamp':
        lathe((0,0,0),[(.45,0),(.3,.16),(.14,.7),(.4,.78)],'ivory')
        scallop(0,.75,-.12,.9,.6,.65)
        ball((0,1,.04),(.28,.28,.28),'glow')
    elif kind=='oceanShellPlanter':
        lathe((0,0,0),[(.55,0),(.7,.25),(.62,.4)],'ivory')
        coral(0,.4,0,.65)
        coral(.3,.4,.1,.4,'teal')
    else:
        curve([(-.4,0,0),(-.4,1.9,0),(.6,1.9,0)],.065,'gold')
        for i in range(4):
            x=-.2+i*.25;y=1.15+.2*math.sin(i)
            rod((x,1.9,0),(x,y,0),.015,'ivory')
            ball((x,y,0),(.1,.14,.06),'pearl')

def join_objects(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    o=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.name=name
    return o

stage_root=None
def stage(progress,build):
    before=set(bpy.context.scene.objects);build()
    o=join_objects(list(set(bpy.context.scene.objects)-before),f'stage-{int(progress*100)}')
    o['revealAt']=progress;o.parent=stage_root

if rebuild_back or rebuild_houses or rebuild_pools:
    stage_root=bpy.data.objects['ocean-front' if rebuild_houses or rebuild_pools else 'ocean-back']
    target_stage=.8 if rebuild_pools else .4 if rebuild_houses else 1 if rebuild_palace else .6 if rebuild_wreck else None
    for previous in list(stage_root.children):
        if target_stage is None or previous.get('revealAt')==target_stage:bpy.data.objects.remove(previous,do_unlink=True)
    if rebuild_houses:stage(.4,cottages)
    elif rebuild_pools:stage(.8,pearl_pools)
    elif rebuild_palace:stage(1,palace)
    elif rebuild_wreck:stage(.6,wreck)
    else:terrain(True)
else:
    for side in ['front','back']:
        stage_root=bpy.data.objects.new('ocean-'+side,None)
        bpy.context.collection.objects.link(stage_root)
        terrain(side=='back')
    for kind in ['pod','food','shower','lab','portal','sofa','music','blueprintTable','constructionTerminal']:
        before=set(bpy.context.scene.objects);facility(kind)
        join_objects(list(set(bpy.context.scene.objects)-before),'ocean-'+kind)
    for kind in ['oceanPearlLamp','oceanShellPlanter','oceanBubbleMobile']:
        before=set(bpy.context.scene.objects);item(kind)
        join_objects(list(set(bpy.context.scene.objects)-before),kind)

out=ROOT/'public/assets/ocean.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,
    export_animations=False,export_cameras=False,export_lights=False,export_extras=True,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
source=ROOT/'artifacts/ocean';source.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source/'ocean.blend'))
print(f'OCEAN_GLB_BYTES={out.stat().st_size}')
