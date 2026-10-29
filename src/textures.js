import * as THREE from 'three';

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function textureFrom(canvas, repeat = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  return texture;
}

function noisyTexture(base, flecks, seed, style = 'dirt') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  if (style === 'wood') {
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = y % 64 ? 'rgba(255,220,150,.055)' : 'rgba(0,0,0,.07)';
      ctx.fillRect(0, y, 256, 30);
      ctx.strokeStyle = 'rgba(25,15,8,.38)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y + 31); ctx.lineTo(256, y + 31); ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const y = random() * 256;
      ctx.strokeStyle = `rgba(35,20,10,${.04 + random() * .12})`;
      ctx.lineWidth = .5 + random() * 1.5;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(70, y + random() * 12 - 6, 170, y + random() * 12 - 6, 256, y);
      ctx.stroke();
    }
  } else if (style === 'metal') {
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,.25)'); gradient.addColorStop(.45, 'rgba(255,255,255,.14)');
    gradient.addColorStop(.55, 'rgba(255,255,255,.04)'); gradient.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,256,256);
    for (let i = 0; i < 150; i++) {
      const y = random() * 256;
      ctx.fillStyle = `rgba(255,255,255,${random() * .06})`;
      ctx.fillRect(0, y, 256, .5 + random());
    }
  } else {
    for (let i = 0; i < 2100; i++) {
      const color = flecks[Math.floor(random() * flecks.length)];
      const size = style === 'rock' ? 1 + random() * 7 : .4 + random() * 3.1;
      ctx.globalAlpha = .08 + random() * .34;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(random() * 256, random() * 256, size * 1.7, size, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (style === 'rock') {
      for (let i = 0; i < 18; i++) {
        let x = random() * 256, y = random() * 256;
        ctx.strokeStyle = 'rgba(20,22,20,.22)'; ctx.lineWidth = .6 + random() * 1.4;
        ctx.beginPath(); ctx.moveTo(x,y);
        for (let j=0;j<4;j++) { x += random()*26-13; y += random()*24; ctx.lineTo(x,y); }
        ctx.stroke();
      }
    }
  }
  return textureFrom(canvas);
}

export function createTextureSet(palette, seed = 11) {
  return {
    dirt: noisyTexture(palette.dirt, ['#d2ae79','#281f1b','#9b7350',palette.dirtDark], seed),
    rock: noisyTexture(palette.rock, ['#d4c9ad','#242a28','#9c9584'], seed + 1, 'rock'),
    top: noisyTexture(palette.top, ['#d2b071','#423a29','#9e8d5e'], seed + 2),
    wood: noisyTexture('#765037', ['#c69a5f','#2b1d14'], seed + 3, 'wood'),
    metal: noisyTexture('#666d70', ['#c5ccca','#252b2e'], seed + 4, 'metal')
  };
}

export function createSkyTexture(palette) {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0,0,0,512);
  g.addColorStop(0,palette.skyTop); g.addColorStop(.72,palette.skyBottom); g.addColorStop(1,palette.haze);
  ctx.fillStyle = g; ctx.fillRect(0,0,32,512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCheckerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let y=0;y<4;y++) for (let x=0;x<4;x++) {
    ctx.fillStyle = (x+y)%2 ? '#171a1c' : '#eee9db';
    ctx.fillRect(x*32,y*32,32,32);
  }
  return textureFrom(canvas, 1);
}

export function createSignTexture(text, accent = '#f2b544') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#202326'; ctx.fillRect(0,0,512,128);
  ctx.fillStyle = accent; ctx.fillRect(0,0,18,128);
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.strokeRect(2,2,508,124);
  ctx.fillStyle = '#f3eee2'; ctx.font = '700 52px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 270, 66);
  return textureFrom(canvas, 1);
}
