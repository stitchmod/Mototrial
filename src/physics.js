import Matter from 'matter-js';
import { SCALE, BIKE } from './config.js';

const { Engine, Bodies, Body, Composite, Constraint, Events, Query, Vector } = Matter;
const mx = (x) => x * SCALE;
const my = (y) => -y * SCALE;
const worldPoint = (body) => ({ x: body.position.x / SCALE, y: -body.position.y / SCALE });

export class TrialPhysics {
  constructor(level, onCrash) {
    this.level = level;
    this.onCrash = onCrash;
    this.engine = Engine.create({ enableSleeping: false });
    this.engine.gravity.y = 1.25;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;
    this.terrainBodies = [];
    this.hazardBodies = [];
    this.props = [];
    this.rearContacts = new Set();
    this.frontContacts = new Set();
    this.crashed = false;

    this.buildTerrain();
    this.buildProps();
    this.bindCollisions();
    this.bike = null;
    this.reset(level.spawn);
  }

  buildTerrain() {
    const pts = this.level.points;
    const T = SCALE * .7;                       // толщина плиты
    const lift = BIKE.surface * SCALE;          // верхняя грань чуть выше линии (как видимая полоса травы)
    for (let i=0;i<pts.length-1;i++) {
      const a = pts[i], b = pts[i+1];
      const dx = mx(b[0]-a[0]), dy = my(b[1])-my(a[1]);
      const length = Math.hypot(dx,dy);
      // единичная нормаль, направленная вверх (в координатах Matter ось y вниз)
      const nx = dy/length, ny = -dx/length;
      const shift = T/2 - lift;                 // плита уходит ПОД линию рельефа, а не центрируется на ней
      const cx = mx((a[0]+b[0])/2) - nx*shift, cy = (my(a[1])+my(b[1]))/2 - ny*shift;
      const body = Bodies.rectangle(cx, cy, length + 1.2, T, {
        isStatic: true, angle: Math.atan2(dy,dx), friction: 1.05, frictionStatic: 2, restitution: 0,
        label: 'terrain', chamfer: { radius: 2 }
      });
      this.terrainBodies.push(body); this.hazardBodies.push(body);
    }
    const left = Bodies.rectangle(mx(-1),my(2),SCALE,SCALE*12,{isStatic:true,label:'terrain'});
    this.terrainBodies.push(left); this.hazardBodies.push(left);
    Composite.add(this.engine.world,this.terrainBodies);
  }

  buildProps() {
    for (const log of this.level.logs) {
      const body = Bodies.circle(mx(log.x),my(log.y),mx(log.r),{
        isStatic:true, friction:1.1, frictionStatic:2, restitution:.02, label:'log'
      });
      this.hazardBodies.push(body); this.props.push({type:'log',body,data:log});
    }
    for (const rock of this.level.rocks) {
      const body = Bodies.circle(mx(rock.x),my(rock.y),mx(rock.r*.97),{
        isStatic:true, friction:1.15, frictionStatic:2, restitution:.01, label:'rock'
      });
      this.hazardBodies.push(body); this.props.push({type:'rock',body,data:rock});
    }
    for (const crate of this.level.crates) {
      const body = Bodies.rectangle(mx(crate.x),my(crate.y),mx(crate.s),mx(crate.s),{
        density:.0025, friction:.85, frictionStatic:1.4, restitution:.02, label:'prop', chamfer:{radius:2}
      });
      this.hazardBodies.push(body); this.props.push({type:'crate',body,data:crate});
    }
    if (this.level.seesaw) {
      const data = this.level.seesaw;
      const body = Bodies.rectangle(mx(data.x),my(data.y),mx(data.w),mx(.18),{
        density:.004, friction:1, frictionStatic:1.5, restitution:0, label:'prop', chamfer:{radius:3}
      });
      const pivot = Constraint.create({
        pointA:{x:mx(data.x),y:my(data.y)},bodyB:body,pointB:{x:0,y:0},length:0,stiffness:1,damping:.08
      });
      this.hazardBodies.push(body); this.props.push({type:'seesaw',body,data});
      Composite.add(this.engine.world,pivot);
    }
    Composite.add(this.engine.world,this.props.map(p=>p.body));
  }

  bindCollisions() {
    const updateContacts = (pairs, remove) => {
      for (const pair of pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        if (!this.bike) continue;
        const other = (body) => body === this.bike.rear ? this.rearContacts : body === this.bike.front ? this.frontContacts : null;
        const setA = other(a), setB = other(b);
        if (setA) remove ? setA.delete(b.id) : setA.add(b.id);
        if (setB) remove ? setB.delete(a.id) : setB.add(a.id);
        if (!remove && !this.crashed) {
          const chassisHit = a === this.bike.chassis ? b : b === this.bike.chassis ? a : null;
          if (chassisHit && chassisHit.label !== 'bike') {
            this.crashed = true; this.onCrash('Рама коснулась препятствия');
          }
        }
      }
    };
    Events.on(this.engine,'collisionStart',event=>updateContacts(event.pairs,false));
    Events.on(this.engine,'collisionEnd',event=>updateContacts(event.pairs,true));
  }

  makeBike(spawn) {
    const group = Body.nextGroup(true);
    const filter = {group};
    const C = BIKE.chassis, R = BIKE.rear, F = BIKE.front;
    // высота центра рамы над землёй при полностью разгруженной подвеске
    const cy = spawn.y + BIKE.surface + .03 + R.r - R.rest.y;
    const chassis = Bodies.rectangle(mx(spawn.x),my(cy),mx(C.w),mx(C.h),{
      density:C.density, friction:.45, restitution:0, label:'bike', collisionFilter:filter, chamfer:{radius:5}
    });
    const rear = Bodies.circle(mx(spawn.x+R.rest.x),my(cy+R.rest.y),mx(R.r),{
      density:.0024, friction:1.35, frictionStatic:2.4, frictionAir:.008, restitution:.015,label:'bike',collisionFilter:filter
    });
    const front = Bodies.circle(mx(spawn.x+F.rest.x),my(cy+F.rest.y),mx(F.r),{
      density:.0021, friction:1.05, frictionStatic:1.8, frictionAir:.008, restitution:.015,label:'bike',collisionFilter:filter
    });

    // Подвеска: вдоль оси — пружина с демпфером (силы, applySuspension),
    // поперёк — две жёсткие связи по обе стороны оси (получается «рельса»).
    const suspensions = [], guides = [];
    for (const [cfg, wheel] of [[R, rear], [F, front]]) {
      const restPx = { x: mx(cfg.rest.x), y: my(cfg.rest.y) };
      const axisPx = { x: cfg.axis.x, y: -cfg.axis.y };         // направление сжатия, Matter-координаты
      const nrm = { x: -axisPx.y, y: axisPx.x };
      const D = mx(cfg.guide);
      for (const side of [1, -1]) {
        guides.push(Constraint.create({
          bodyA: chassis, pointA: { x: restPx.x + nrm.x*D*side, y: restPx.y + nrm.y*D*side },
          bodyB: wheel, pointB: { x: 0, y: 0 }, length: D, stiffness: .9, damping: .12
        }));
      }
      // жёсткость из желаемой частоты: ω² = k/m (в шагах), масса — половина рамы
      const share = chassis.mass * .5;
      const w = 2*Math.PI*cfg.freq/60, DT2 = (1000/60)**2;
      const k = share * w*w / DT2;
      suspensions.push({
        wheel, restPx, axisPx,
        k, kBump: k*14, kTop: k*18,
        travelPx: mx(cfg.travel), freeze: 0,
        cComp: share * 2*cfg.zComp*w / DT2,
        cReb: share * 2*cfg.zReb*w / DT2,
        maxForce: chassis.mass * 6 * .00125 * 40,
        compression: 0
      });
    }
    const composite = Composite.create();
    Composite.add(composite,[chassis,rear,front,...guides]);
    return {composite,chassis,rear,front,suspensions,guides};
  }

  applySuspension() {
    const { chassis } = this.bike;
    const cos = Math.cos(chassis.angle), sin = Math.sin(chassis.angle);
    for (const s of this.bike.suspensions) {
      const rot = (v) => ({ x: v.x*cos - v.y*sin, y: v.x*sin + v.y*cos });
      const r = rot(s.restPx), a = rot(s.axisPx);
      const p0 = { x: chassis.position.x + r.x, y: chassis.position.y + r.y };
      const w = s.wheel;
      // сжатие вдоль оси: >0 — колесо поднялось относительно рамы
      const u = (w.position.x - p0.x)*a.x + (w.position.y - p0.y)*a.y;
      // скорость точки крепления на раме
      const vcx = chassis.velocity.x - chassis.angularVelocity*r.y;
      const vcy = chassis.velocity.y + chassis.angularVelocity*r.x;
      const vr = (w.velocity.x - vcx)*a.x + (w.velocity.y - vcy)*a.y;
      let f = s.k * Math.max(u, 0);
      if (u > s.travelPx) f += s.kBump * (u - s.travelPx);   // отбойник сжатия
      if (u < 0) f += s.kTop * u;                            // отбойник отбоя
      f += (vr > 0 ? s.cComp : s.cReb) * vr;                 // демпфер: отбой жёстче сжатия
      f = Math.max(-s.maxForce, Math.min(s.maxForce, f));
      w.force.x -= a.x*f; w.force.y -= a.y*f;
      Body.applyForce(chassis, p0, { x: a.x*f, y: a.y*f });
      s.compression = u / SCALE;
    }
  }

  reset(spawn) {
    if (this.bike) Composite.remove(this.engine.world,this.bike.composite);
    this.rearContacts.clear(); this.frontContacts.clear();
    this.crashed = false;
    this.bike = this.makeBike(spawn);
    Composite.add(this.engine.world,this.bike.composite);
  }

  step(input) {
    if (!this.bike || this.crashed) return;
    const {chassis,rear,front} = this.bike;
    const grounded = this.rearContacts.size + this.frontContacts.size > 0;
    const throttle = input.gas ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    const lean = (input.right?1:0) - (input.left?1:0);

    if (throttle) {
      if (rear.angularVelocity < .72) rear.torque += .40;
      if (front.angularVelocity < .72 && !grounded) front.torque += .035;
    } else if (brake) {
      if (chassis.velocity.x > .65 || rear.angularVelocity > .05) {
        rear.torque -= Math.sign(rear.angularVelocity || 1) * .30;
        front.torque -= Math.sign(front.angularVelocity || 1) * .19;
      } else if (rear.angularVelocity > -.34) {
        rear.torque -= .19;
      }
    }
    chassis.torque += lean * (grounded ? .075 : .19) * BIKE.leanScale;
    if (!throttle && !brake) {
      rear.torque -= rear.angularVelocity * .018;
      front.torque -= front.angularVelocity * .009;
    }

    this.applySuspension();
    Engine.update(this.engine,1000/60);
    this.checkHead();
    if (chassis.position.y > my(-9) && !this.crashed) {
      this.crashed = true; this.onCrash('Падение за трассу');
    }
  }

  checkHead() {
    const local = Vector.create(mx(BIKE.head.x),my(BIKE.head.y));
    const offset = Vector.rotate(local,this.bike.chassis.angle);
    const point = {x:this.bike.chassis.position.x+offset.x,y:this.bike.chassis.position.y+offset.y};
    if (Query.point(this.hazardBodies,point).length && !this.crashed) {
      this.crashed = true; this.onCrash('Гонщик коснулся земли');
    }
  }

  get grounded() { return this.rearContacts.size + this.frontContacts.size > 0; }
  get speed() { return this.bike.chassis.velocity.x * 60 / SCALE; }
  get rearCompression() { return this.bike.suspensions[0].compression; }
  get frontCompression() { return this.bike.suspensions[1].compression; }
  get position() { return worldPoint(this.bike.chassis); }
  get rearPosition() { return worldPoint(this.bike.rear); }
  get frontPosition() { return worldPoint(this.bike.front); }
}

export { worldPoint };
