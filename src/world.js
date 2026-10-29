import * as THREE from 'three';
import { createTextureSet, createSkyTexture, createCheckerTexture, createSignTexture } from './textures.js';
import { worldPoint } from './physics.js';

function seeded(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function material(color, map = null, roughness = .85, metalness = 0) {
  return new THREE.MeshStandardMaterial({color,map,roughness,metalness});
}

function boxMesh(w,h,d,mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function makeRod(a,b,r,mat,z = 0) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,7),mat);
  mesh.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,z);
  mesh.rotation.z = -Math.atan2(dx,dy);
  mesh.castShadow = true;
  return mesh;
}

function dynamicRod(r,mat,z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,7),mat);
  mesh.position.z = z; mesh.castShadow = true;
  return mesh;
}

function setDynamicRod(mesh,a,b,z) {
  const dx=b.x-a.x,dy=b.y-a.y;
  mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,z);
  mesh.scale.y = Math.hypot(dx,dy);
  mesh.rotation.z = -Math.atan2(dx,dy);
}

function createGround(level,mat,topMat) {
  const pts = level.points;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0],-8);
  shape.lineTo(pts[0][0],pts[0][1]);
  for (let i=1;i<pts.length;i++) shape.lineTo(pts[i][0],pts[i][1]);
  shape.lineTo(pts[pts.length-1][0],-8); shape.closePath();
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);
  ground.position.z = -.35; ground.receiveShadow = true;

  const positions = new Float32Array(pts.length*2*3);
  const uvs = new Float32Array(pts.length*2*2);
  const indices = [];
  for (let i=0;i<pts.length;i++) {
    const p=pts[i],j=i*6,k=i*4;
    positions[j]=p[0];positions[j+1]=p[1]+.025;positions[j+2]=-.30;
    positions[j+3]=p[0];positions[j+4]=p[1]-.22;positions[j+5]=-.30;
    uvs[k]=p[0]*.35;uvs[k+1]=1;uvs[k+2]=p[0]*.35;uvs[k+3]=0;
    if(i<pts.length-1){const n=i*2;indices.push(n,n+1,n+2,n+2,n+1,n+3);}
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const top = new THREE.Mesh(geometry,topMat);top.receiveShadow=true;
  const group = new THREE.Group();group.add(ground,top);
  return group;
}

function createMountain(level,color,z,seed,amplitude,base) {
  const random=seeded(seed),shape=new THREE.Shape();
  const start=-45,end=level.length+65;
  shape.moveTo(start,-7);
  for(let x=start;x<=end;x+=5){
    const y=base+Math.sin(x*.075+seed)*amplitude*.45+Math.sin(x*.17)*amplitude*.18+random()*amplitude*.42;
    shape.lineTo(x,y);
  }
  shape.lineTo(end,-7);shape.closePath();
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color}));
  mesh.position.z=z;return mesh;
}

function createWheel(mats) {
  const group=new THREE.Group();
  const tire=new THREE.Mesh(new THREE.TorusGeometry(.43,.085,9,32),mats.tire);tire.castShadow=true;group.add(tire);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.29,.027,7,28),mats.rim);group.add(rim);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.15,12),mats.rim);hub.rotation.x=Math.PI/2;group.add(hub);
  const spokes=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.53,.025),mats.rim,10);
  const treads=new THREE.InstancedMesh(new THREE.BoxGeometry(.105,.055,.14),mats.tire,24);
  const dummy=new THREE.Object3D();
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;dummy.position.set(Math.cos(a)*.14,Math.sin(a)*.14,0);dummy.rotation.set(0,0,a-Math.PI/2);dummy.updateMatrix();spokes.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2;dummy.position.set(Math.cos(a)*.455,Math.sin(a)*.455,0);dummy.rotation.set(0,0,a-Math.PI/2);dummy.updateMatrix();treads.setMatrixAt(i,dummy.matrix);
  }
  group.add(spokes,treads);return group;
}

function createBike(textures) {
  const mats={
    tire:material('#171a1b',null,.96),rim:material('#b9c1bd',textures.metal,.3,.75),
    frame:material('#e8e1d2',textures.metal,.38,.55),dark:material('#24282a',textures.metal,.55,.45),
    orange:material('#e95c31',null,.6,.08),engine:material('#5e6667',textures.metal,.4,.7),
    jersey:material('#ec6a36',null,.8),pants:material('#242c31',null,.9),helmet:material('#ede8da',null,.35,.15),
    skin:material('#b77c5b',null,.9)
  };
  const chassis=new THREE.Group();
  chassis.add(makeRod([-.63,.02],[.42,.02],.055,mats.frame,.12));
  chassis.add(makeRod([-.38,-.18],[-.12,.42],.05,mats.frame,.12));
  chassis.add(makeRod([-.12,.42],[.42,.02],.05,mats.frame,.12));
  chassis.add(makeRod([-.38,-.18],[.42,.02],.045,mats.frame,.12));
  chassis.add(makeRod([-.12,.42],[-.55,.35],.045,mats.dark,.12));
  const tankShape=new THREE.Shape();tankShape.moveTo(-.18,.22);tankShape.lineTo(.26,.25);tankShape.lineTo(.38,.48);tankShape.lineTo(-.04,.58);tankShape.lineTo(-.28,.43);tankShape.closePath();
  const tank=new THREE.Mesh(new THREE.ExtrudeGeometry(tankShape,{depth:.16,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2}),mats.orange);tank.position.z=.02;tank.castShadow=true;chassis.add(tank);
  const seat=boxMesh(.64,.12,.24,mats.dark);seat.position.set(-.39,.5,.12);seat.rotation.z=-.06;chassis.add(seat);
  const engine=boxMesh(.48,.4,.26,mats.engine);engine.position.set(-.05,.01,.12);chassis.add(engine);
  for(let i=0;i<4;i++){const fin=boxMesh(.52,.025,.29,mats.rim);fin.position.set(-.05,-.10+i*.08,.12);chassis.add(fin);}
  chassis.add(makeRod([-.45,-.02],[-.82,.16],.045,mats.dark,.06));
  chassis.add(makeRod([.36,.35],[.48,.78],.035,mats.rim,.12));
  chassis.add(makeRod([.33,.77],[.67,.77],.028,mats.dark,.12));
  const lamp=new THREE.Mesh(new THREE.CircleGeometry(.105,16),new THREE.MeshStandardMaterial({color:'#f6e8b5',emissive:'#d9a643',emissiveIntensity:.45}));lamp.position.set(.58,.56,.2);chassis.add(lamp);

  const rider=new THREE.Group();
  rider.add(makeRod([-.30,.60],[-.14,1.10],.14,mats.jersey,.20));
  rider.add(makeRod([-.28,.63],[-.48,.14],.085,mats.pants,.16));
  rider.add(makeRod([-.48,.14],[-.12,-.04],.075,mats.pants,.16));
  rider.add(makeRod([-.18,1.02],[.16,.82],.065,mats.jersey,.23));
  rider.add(makeRod([.16,.82],[.48,.77],.052,mats.skin,.23));
  rider.add(makeRod([-.26,.98],[.04,.76],.065,mats.jersey,.10));
  rider.add(makeRod([.04,.76],[.40,.75],.052,mats.skin,.10));
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.19,18,12),mats.helmet);helmet.position.set(-.12,1.28,.20);helmet.scale.set(1,1.08,.8);helmet.castShadow=true;rider.add(helmet);
  const visor=boxMesh(.19,.055,.12,mats.dark);visor.position.set(.015,1.30,.30);rider.add(visor);
  const stripe=boxMesh(.045,.30,.025,mats.orange);stripe.position.set(-.13,1.30,.36);stripe.rotation.z=-.2;rider.add(stripe);
  chassis.add(rider);

  return {chassis,rider,rear:createWheel(mats),front:createWheel(mats),mats};
}

class ParticlePool {
  constructor(scene,count=110){
    this.count=count;this.cursor=0;this.random=seeded(734);
    this.positions=new Float32Array(count*3);this.colors=new Float32Array(count*3);
    this.velocities=new Float32Array(count*2);this.life=new Float32Array(count);this.maxLife=new Float32Array(count);
    for(let i=0;i<count;i++)this.positions[i*3+1]=-100;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    this.points=new THREE.Points(geometry,new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));
    this.points.position.z=.8;scene.add(this.points);
  }
  emit(x,y,count,color='#c9a77a',power=1){
    const c=new THREE.Color(color);
    for(let n=0;n<count;n++){
      const i=this.cursor++%this.count,j=i*3,k=i*2,r=this.random;
      this.positions[j]=x+(r()-.5)*.3;this.positions[j+1]=y+r()*.15;this.positions[j+2]=0;
      this.velocities[k]=(-.7-r()*1.5)*power;this.velocities[k+1]=(.4+r()*1.4)*power;
      this.life[i]=this.maxLife[i]=.45+r()*.65;
      this.colors[j]=c.r;this.colors[j+1]=c.g;this.colors[j+2]=c.b;
    }
  }
  update(dt){
    for(let i=0;i<this.count;i++){
      if(this.life[i]<=0)continue;const j=i*3,k=i*2;this.life[i]-=dt;
      if(this.life[i]<=0){this.positions[j+1]=-100;continue;}
      this.positions[j]+=this.velocities[k]*dt;this.positions[j+1]+=this.velocities[k+1]*dt;
      this.velocities[k]*=.985;this.velocities[k+1]+=dt*.25;
    }
    this.points.geometry.attributes.position.needsUpdate=true;this.points.geometry.attributes.color.needsUpdate=true;
  }
}

export class TrialWorld {
  constructor(scene,level){
    this.scene=scene;this.level=level;this.group=new THREE.Group();scene.add(this.group);
    this.textures=createTextureSet(level.palette,level.number.charCodeAt(1)*31);
    this.textures.dirt.repeat.set(.22,.22);this.textures.top.repeat.set(.5,.5);
    this.buildEnvironment();this.buildProps();this.buildBike();this.particles=new ParticlePool(scene);
    this.dustClock=0;this.random=seeded(929);
  }

  buildEnvironment(){
    const p=this.level.palette;
    this.sky=new THREE.Mesh(new THREE.PlaneGeometry(this.level.length+150,45),new THREE.MeshBasicMaterial({map:createSkyTexture(p),depthWrite:false}));
    this.sky.position.set(this.level.length/2,7,-22);this.group.add(this.sky);
    const sun=new THREE.Mesh(new THREE.CircleGeometry(1.3,32),new THREE.MeshBasicMaterial({color:'#f6dca0',transparent:true,opacity:.65}));sun.position.set(18,7.5,-18);this.group.add(sun);
    this.mountainFar=createMountain(this.level,p.mountainFar,-15,13,3.3,2.0);this.group.add(this.mountainFar);
    this.mountainNear=createMountain(this.level,p.mountainNear,-10,29,2.4,.3);this.group.add(this.mountainNear);
    const groundMat=material('#ffffff',this.textures.dirt,1);const topMat=material('#ffffff',this.textures.top,.98);
    this.group.add(createGround(this.level,groundMat,topMat));

    const random=seeded(300+Number(this.level.number));
    const count=Math.floor(this.level.length/2.4);
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.11,1,5),material('#40382e'),count);
    const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(.65,2.1,7),material(p.foliage),count);
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const x=-5+i*2.4+random()*1.5,y=this.heightAt(Math.max(0,Math.min(this.level.length,x)));
      const s=.65+random()*.8,z=-4-random()*2;
      dummy.position.set(x,y+.5*s,z);dummy.scale.set(s,s,s);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      dummy.position.set(x,y+1.65*s,z);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
    }
    this.group.add(trunks,crowns);

    const pebbleCount=Math.floor(this.level.length*1.3);
    const pebbles=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.12,0),material('#ffffff',this.textures.rock,1),pebbleCount);
    for(let i=0;i<pebbleCount;i++){
      const x=random()*this.level.length,y=this.heightAt(x),s=.3+random()*1.1;
      dummy.position.set(x,y-.09,-.12);dummy.scale.set(s*1.4,s*.65,s);dummy.rotation.set(0,0,random()*3);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    }
    this.group.add(pebbles);

    const startSign=new THREE.Mesh(new THREE.PlaneGeometry(2.25,.56),new THREE.MeshBasicMaterial({map:createSignTexture('СТАРТ',p.accent)}));
    startSign.position.set(1.7,2.25,.05);this.group.add(startSign);
    this.group.add(makeRod([.65,0],[.65,2.5],.035,material('#33393a'),0));
    this.buildGate('checkpoint',this.level.checkpoint.x,this.level.checkpoint.y,false);
    this.buildGate('finish',this.level.finish,this.heightAt(this.level.finish),true);
  }

  buildGate(type,x,y,finish){
    const group=new THREE.Group();group.position.set(x,y,0);
    const postMat=material('#d8d2bd',this.textures.metal,.45,.5);
    const left=boxMesh(.09,2.9,.1,postMat);left.position.set(0,1.45,0);group.add(left);
    if(finish){
      const right=boxMesh(.09,2.9,.1,postMat);right.position.set(2.1,1.45,0);group.add(right);
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(2.15,.48),new THREE.MeshBasicMaterial({map:createCheckerTexture()}));banner.position.set(1.05,2.66,.03);group.add(banner);
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.45),new THREE.MeshBasicMaterial({map:createSignTexture('ФИНИШ',this.level.palette.accent)}));sign.position.set(1.05,3.25,.03);group.add(sign);
    }else{
      this.checkpointFlag=new THREE.Mesh(new THREE.PlaneGeometry(.85,.52),new THREE.MeshStandardMaterial({color:'#d6d0bd',side:THREE.DoubleSide}));
      this.checkpointFlag.position.set(.45,2.5,.03);group.add(this.checkpointFlag);
    }
    this.group.add(group);
  }

  buildProps(){
    this.propMeshes=[];
    for(const prop of this.level.logs){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(prop.r,prop.r,.75,18),material('#ffffff',this.textures.wood,1));
      mesh.rotation.x=Math.PI/2;mesh.position.set(prop.x,prop.y,-.02);mesh.castShadow=true;this.group.add(mesh);
    }
    for(const rock of this.level.rocks){
      const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(rock.r,1),material('#ffffff',this.textures.rock,1));
      mesh.position.set(rock.x,rock.y,-.02);mesh.scale.set(1.05,.9,.8);mesh.rotation.z=rock.x;mesh.castShadow=true;this.group.add(mesh);
    }
    for(const prop of this.level.crates){
      const mesh=boxMesh(prop.s,prop.s,.65,material('#ffffff',this.textures.wood,.9));this.group.add(mesh);this.propMeshes.push({mesh,bodyIndex:this.propMeshes.length});
    }
    if(this.level.seesaw){
      const data=this.level.seesaw;
      const mesh=boxMesh(data.w,.18,.65,material('#ffffff',this.textures.wood,.9));this.group.add(mesh);
      const supportMat=material('#6f7776',this.textures.metal,.5,.45);
      this.group.add(makeRod([data.x-.42,data.y-.85],[data.x,data.y-.08],.055,supportMat,-.1));
      this.group.add(makeRod([data.x+.42,data.y-.85],[data.x,data.y-.08],.055,supportMat,-.1));
      this.seesawMesh=mesh;
    }
  }

  buildBike(){
    this.bike=createBike(this.textures);this.group.add(this.bike.chassis,this.bike.rear,this.bike.front);
    this.frontFork=[dynamicRod(.035,this.bike.mats.rim,.09),dynamicRod(.035,this.bike.mats.rim,.20)];
    this.rearFork=[dynamicRod(.045,this.bike.mats.dark,.08),dynamicRod(.045,this.bike.mats.dark,.18)];
    this.group.add(...this.frontFork,...this.rearFork);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.85,24),new THREE.MeshBasicMaterial({color:'#101412',transparent:true,opacity:.24,depthWrite:false}));
    this.shadow.scale.y=.20;this.shadow.position.z=-.05;this.group.add(this.shadow);
  }

  sync(physics,input,dt,time){
    const {chassis,rear,front}=physics.bike;
    const cp=worldPoint(chassis),rp=worldPoint(rear),fp=worldPoint(front),angle=-chassis.angle;
    this.bike.chassis.position.set(cp.x,cp.y,.42);this.bike.chassis.rotation.z=angle;
    this.bike.rear.position.set(rp.x,rp.y,.42);this.bike.rear.rotation.z=-rear.angle;
    this.bike.front.position.set(fp.x,fp.y,.42);this.bike.front.rotation.z=-front.angle;
    const c=Math.cos(angle),s=Math.sin(angle);
    const local=(x,y)=>({x:cp.x+x*c-y*s,y:cp.y+x*s+y*c});
    const fa=local(.43,.34),ra=local(-.36,.02);
    setDynamicRod(this.frontFork[0],fa,fp,.48);setDynamicRod(this.frontFork[1],fa,fp,.58);
    setDynamicRod(this.rearFork[0],ra,rp,.47);setDynamicRod(this.rearFork[1],ra,rp,.56);
    const lean=(input.right?1:0)-(input.left?1:0);
    this.bike.rider.rotation.z+=((-lean*.13)-this.bike.rider.rotation.z)*Math.min(1,dt*9);

    let dynamicIndex=0;
    for(const prop of physics.props){
      if(prop.type==='crate'){
        const mesh=this.propMeshes[dynamicIndex++].mesh,p=worldPoint(prop.body);mesh.position.set(p.x,p.y,.02);mesh.rotation.z=-prop.body.angle;
      }else if(prop.type==='seesaw'&&this.seesawMesh){
        const p=worldPoint(prop.body);this.seesawMesh.position.set(p.x,p.y,.01);this.seesawMesh.rotation.z=-prop.body.angle;
      }
    }
    const groundY=this.heightAt(cp.x);
    this.shadow.position.set(cp.x,groundY+.025,-.06);this.shadow.material.opacity=Math.max(0,.25-Math.abs(cp.y-groundY-1)*.055);

    this.dustClock-=dt;
    if(physics.grounded&&Math.abs(physics.speed)>.7&&this.dustClock<=0){
      this.particles.emit(rp.x,rp.y-.35,2,this.level.palette.top,Math.min(1.5,.5+Math.abs(physics.speed)*.1));this.dustClock=.055;
    }
    if(this.checkpointFlag)this.checkpointFlag.rotation.y=Math.sin(time*3)*.16;
    this.particles.update(dt);
  }

  burst(x,y,finish=false){this.particles.emit(x,y,finish?65:14,finish?this.level.palette.accent:'#d5b27b',finish?2.5:1.2);}
  setCheckpoint(active){if(this.checkpointFlag){this.checkpointFlag.material.color.set(active?this.level.palette.accent:'#d6d0bd');this.checkpointFlag.material.emissive.set(active?this.level.palette.accent:'#000000');this.checkpointFlag.material.emissiveIntensity=active?.25:0;}}
  heightAt(x){
    const pts=this.level.points;
    if(x<=pts[0][0])return pts[0][1];
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(x<=b[0]){const t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}}
    return pts[pts.length-1][1];
  }
  updateCameraLayers(cameraX){this.mountainFar.position.x=cameraX*.055;this.mountainNear.position.x=cameraX*.025;}
  dispose(){
    this.scene.remove(this.group);this.scene.remove(this.particles.points);
    this.group.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();if(obj.material){const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});
    Object.values(this.textures).forEach(t=>t.dispose());
  }
}
