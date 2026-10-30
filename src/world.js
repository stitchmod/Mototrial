import * as THREE from 'three';
import { createTextureSet, createSkyTexture, createCheckerTexture, createSignTexture } from './textures.js';
import { worldPoint } from './physics.js';
import { BIKE } from './config.js';

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

function createWheel(mats, R) {
  // Внешний радиус покрышки (с протектором) строго равен физическому радиусу R — колесо не «тонет» в земле.
  const group=new THREE.Group();
  const tube=.07, rimR=R*.62;
  const tire=new THREE.Mesh(new THREE.TorusGeometry(R-tube,tube,9,32),mats.tire);tire.castShadow=true;group.add(tire);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(rimR,.026,7,28),mats.rim);group.add(rim);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.15,12),mats.rim);hub.rotation.x=Math.PI/2;group.add(hub);
  const spokeCount=12, treadCount=Math.round(R*60);
  const spokes=new THREE.InstancedMesh(new THREE.BoxGeometry(.022,rimR*2,.022),mats.rim,spokeCount);
  const treads=new THREE.InstancedMesh(new THREE.BoxGeometry(.105,.05,.14),mats.tire,treadCount);
  const dummy=new THREE.Object3D();
  for(let i=0;i<spokeCount;i++){
    const a=i/spokeCount*Math.PI;dummy.position.set(0,0,0);dummy.rotation.set(0,0,a);dummy.updateMatrix();spokes.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<treadCount;i++){
    const a=i/treadCount*Math.PI*2;dummy.position.set(Math.cos(a)*(R-.025),Math.sin(a)*(R-.025),0);dummy.rotation.set(0,0,a-Math.PI/2);dummy.updateMatrix();treads.setMatrixAt(i,dummy.matrix);
  }
  group.add(spokes,treads);return group;
}

function extrudePoly(points,depth,mat) {
  const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1}),mat);
  mesh.castShadow=true;return mesh;
}

function createBike(textures) {
  const mats={
    tire:material('#171a1b',null,.96),rim:material('#b9c1bd',textures.metal,.3,.75),
    frame:material('#e8e1d2',textures.metal,.38,.55),dark:material('#24282a',textures.metal,.55,.45),
    orange:material('#e95c31',null,.6,.08),engine:material('#5e6667',textures.metal,.4,.7),
    gold:material('#d3a13a',textures.metal,.35,.7),cream:material('#efe9d8',null,.5,.1),
    jersey:material('#ec6a36',null,.8),pants:material('#242c31',null,.9),helmet:material('#ede8da',null,.35,.15),
    skin:material('#b77c5b',null,.9)
  };
  // Рама триального мотоцикла (референс): низкая, без бака, длинный хвост, труба глушителя вдоль двигателя.
  const chassis=new THREE.Group();
  const Z=.12;
  chassis.add(makeRod([.27,.40],[-.30,.26],.05,mats.frame,Z));          // верхняя балка
  chassis.add(makeRod([.27,.38],[.12,-.26],.05,mats.frame,Z));          // передняя труба
  chassis.add(makeRod([.12,-.28],[-.32,-.30],.045,mats.frame,Z));       // нижняя балка
  chassis.add(makeRod([-.30,.26],[-.32,-.30],.045,mats.frame,Z));       // подседельная труба
  chassis.add(makeRod([-.30,.26],[-.80,.36],.04,mats.frame,Z));         // подрамник
  chassis.add(makeRod([-.30,.10],[-.74,.32],.03,mats.dark,Z));          // раскос
  chassis.add(makeRod([.33,.58],[.26,.38],.065,mats.dark,Z));           // рулевая колонка
  // хвост-обтекатель, поднимающийся к задку
  const tail=extrudePoly([[-.24,.30],[-.55,.38],[-1.12,.52],[-1.14,.46],[-.62,.31],[-.28,.20]],.20,mats.orange);tail.position.z=.02;chassis.add(tail);
  const seat=boxMesh(.42,.07,.2,mats.dark);seat.position.set(-.50,.41,.12);seat.rotation.z=-.15;chassis.add(seat);
  // двигатель
  const engine=boxMesh(.52,.36,.26,mats.engine);engine.position.set(-.02,-.10,.12);chassis.add(engine);
  for(let i=0;i<4;i++){const fin=boxMesh(.56,.025,.29,mats.rim);fin.position.set(-.02,-.01+i*.08,.12);chassis.add(fin);}
  const cover=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.05,16),mats.rim);cover.rotation.x=Math.PI/2;cover.position.set(-.14,-.12,.27);chassis.add(cover);
  const skid=boxMesh(.62,.04,.24,mats.dark);skid.position.set(-.06,-.30,.12);chassis.add(skid);
  // выхлоп: изогнутая труба от цилиндра назад над колесом + глушитель
  const pipeCurve=new THREE.CatmullRomCurve3([[.14,-.22],[.25,-.02],[.18,.14],[-.10,.17],[-.50,.15],[-.80,.22]].map(p=>new THREE.Vector3(p[0],p[1],.27)));
  const pipe=new THREE.Mesh(new THREE.TubeGeometry(pipeCurve,28,.032,7,false),mats.rim);pipe.castShadow=true;chassis.add(pipe);
  chassis.add(makeRod([-.62,.19],[-1.04,.30],.062,mats.rim,.27));
  // подножка, руль
  const peg=boxMesh(.16,.04,.2,mats.dark);peg.position.set(-.10,-.30,.30);chassis.add(peg);
  chassis.add(makeRod([.22,.80],[.38,.85],.028,mats.dark,.12));
  const clamp=boxMesh(.12,.06,.2,mats.dark);clamp.position.set(.34,.64,.12);clamp.rotation.z=.39;chassis.add(clamp);

  // гонщик в стойке (как в триале: стоя на подножках)
  const rider=new THREE.Group();
  rider.add(makeRod([-.32,.50],[-.10,1.04],.14,mats.jersey,.20));       // торс
  rider.add(makeRod([-.32,.50],[-.16,.14],.085,mats.pants,.16));        // бедро
  rider.add(makeRod([-.16,.14],[-.10,-.26],.075,mats.pants,.16));       // голень
  rider.add(makeRod([-.12,1.00],[.12,.90],.065,mats.jersey,.23));       // плечо
  rider.add(makeRod([.12,.90],[.34,.83],.052,mats.skin,.23));           // предплечье
  rider.add(makeRod([-.16,.96],[.08,.88],.065,mats.jersey,.10));
  rider.add(makeRod([.08,.88],[.32,.82],.052,mats.skin,.10));
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.19,18,12),mats.helmet);helmet.position.set(-.02,1.28,.20);helmet.scale.set(1,1.08,.8);helmet.castShadow=true;rider.add(helmet);
  const visor=boxMesh(.19,.055,.12,mats.dark);visor.position.set(.115,1.30,.30);rider.add(visor);
  const stripe=boxMesh(.045,.30,.025,mats.orange);stripe.position.set(-.03,1.30,.36);stripe.rotation.z=-.2;rider.add(stripe);
  chassis.add(rider);

  // переднее крыло едет вместе с колесом и не врезается в покрышку при ходе подвески
  const R=BIKE.front.r, fender=new THREE.Group();
  const fs=new THREE.Shape(),a0=.45,a1=2.05,ri=R+.06,ro=R+.10;
  fs.moveTo(Math.cos(a0)*ro,Math.sin(a0)*ro);fs.absarc(0,0,ro,a0,a1,false);fs.lineTo(Math.cos(a1)*ri,Math.sin(a1)*ri);fs.absarc(0,0,ri,a1,a0,true);fs.closePath();
  const fenderMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(fs,{depth:.18,bevelEnabled:false}),mats.cream);fenderMesh.position.z=-.09;fenderMesh.castShadow=true;fender.add(fenderMesh);

  return {chassis,rider,rear:createWheel(mats,BIKE.rear.r),front:createWheel(mats,BIKE.front.r),fender,mats};
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
      mesh.position.set(rock.x,rock.y,-.02);mesh.scale.set(1,1,.8);mesh.rotation.z=rock.x;mesh.castShadow=true;this.group.add(mesh);
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
    this.bike=createBike(this.textures);this.group.add(this.bike.chassis,this.bike.rear,this.bike.front,this.bike.fender);
    const m=this.bike.mats;
    // передняя вилка: неподвижные верхние трубы + выдвигающиеся нижние (золотые)
    this.forkUpper=[dynamicRod(.052,m.rim,.09),dynamicRod(.052,m.rim,.20)];
    this.forkLower=[dynamicRod(.036,m.gold,.09),dynamicRod(.036,m.gold,.20)];
    // задняя подвеска: маятник, амортизатор с пружиной, цепь
    this.swingarm=[dynamicRod(.045,m.dark,.07),dynamicRod(.045,m.dark,.19)];
    this.shock=dynamicRod(.028,m.rim,.30);this.shockSpring=dynamicRod(.05,m.gold,.30);
    this.chain=dynamicRod(.012,m.dark,.27);
    this.group.add(...this.forkUpper,...this.forkLower,...this.swingarm,this.shock,this.shockSpring,this.chain);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(1.25,24),new THREE.MeshBasicMaterial({color:'#101412',transparent:true,opacity:.24,depthWrite:false}));
    this.shadow.scale.y=.16;this.shadow.position.z=-.05;this.group.add(this.shadow);
  }

  sync(physics,input,dt,time){
    const {chassis,rear,front}=physics.bike;
    const cp=worldPoint(chassis),rp=worldPoint(rear),fp=worldPoint(front),angle=-chassis.angle;
    this.bike.chassis.position.set(cp.x,cp.y,.42);this.bike.chassis.rotation.z=angle;
    this.bike.rear.position.set(rp.x,rp.y,.42);this.bike.rear.rotation.z=-rear.angle;
    this.bike.front.position.set(fp.x,fp.y,.42);this.bike.front.rotation.z=-front.angle;
    const c=Math.cos(angle),s=Math.sin(angle);
    const local=(x,y)=>({x:cp.x+x*c-y*s,y:cp.y+x*s+y*c});
    const lerp=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
    // вилка: верхние трубы привязаны к раме, нижние — к колесу (видно, как вилка «ходит»)
    const top=local(BIKE.forkTop.x,BIKE.forkTop.y),ax=BIKE.front.axis;
    const up={x:ax.x*c-ax.y*s,y:ax.x*s+ax.y*c};
    const upperEnd={x:top.x-up.x*.66,y:top.y-up.y*.66},sliderTop={x:fp.x+up.x*.80,y:fp.y+up.y*.80};
    setDynamicRod(this.forkUpper[0],top,upperEnd,.09);setDynamicRod(this.forkUpper[1],top,upperEnd,.20);
    setDynamicRod(this.forkLower[0],fp,sliderTop,.09);setDynamicRod(this.forkLower[1],fp,sliderTop,.20);
    this.bike.fender.position.set(fp.x,fp.y,.42);this.bike.fender.rotation.z=angle;
    // маятник + амортизатор
    const pivot=local(BIKE.swingPivot.x,BIKE.swingPivot.y),shockTop=local(BIKE.shockTop.x,BIKE.shockTop.y);
    setDynamicRod(this.swingarm[0],pivot,rp,.47);setDynamicRod(this.swingarm[1],pivot,rp,.57);
    const shockLow=lerp(pivot,rp,.80);
    setDynamicRod(this.shock,shockTop,shockLow,.62);
    setDynamicRod(this.shockSpring,lerp(shockTop,shockLow,.18),lerp(shockTop,shockLow,.78),.62);
    setDynamicRod(this.chain,rp,local(-.26,-.12),.56);
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
    const midX=(rp.x+fp.x)/2,groundY=this.heightAt(midX);
    this.shadow.position.set(midX,groundY+.025,-.06);this.shadow.material.opacity=Math.max(0,.25-Math.abs(cp.y-groundY-1)*.055);

    this.dustClock-=dt;
    if(physics.grounded&&Math.abs(physics.speed)>.7&&this.dustClock<=0){
      this.particles.emit(rp.x,rp.y-BIKE.rear.r+.05,2,this.level.palette.top,Math.min(1.5,.5+Math.abs(physics.speed)*.1));this.dustClock=.055;
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
