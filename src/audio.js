export class AudioSystem {
  constructor(muted = false) {
    this.muted = muted;
    this.ready = false;
    this.playing = false;
  }

  ensure() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .42;
      this.master.connect(this.ctx.destination);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 48;
      this.engine2 = this.ctx.createOscillator();
      this.engine2.type = 'square';
      this.engine2.frequency.value = 24;
      const subGain = this.ctx.createGain(); subGain.gain.value = .17;
      this.engine.connect(this.engineFilter); this.engine2.connect(subGain); subGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engine.start(); this.engine2.start();

      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 97;
      for (let i=0;i<data.length;i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 1073741823.5 - 1) * .16;
      }
      this.wind = this.ctx.createBufferSource(); this.wind.buffer = buffer; this.wind.loop = true;
      this.windFilter = this.ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 480;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = .025;
      this.wind.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master); this.wind.start();

      this.padGain = this.ctx.createGain(); this.padGain.gain.value = .018; this.padGain.connect(this.master);
      [55,82.5].forEach((frequency, index) => {
        const osc = this.ctx.createOscillator(); osc.type = index ? 'sine' : 'triangle'; osc.frequency.value = frequency;
        const gain = this.ctx.createGain(); gain.gain.value = index ? .32 : .55;
        osc.connect(gain); gain.connect(this.padGain); osc.start();
      });
      this.ready = true;
    } catch { /* audio is optional when the browser blocks it */ }
  }

  setMuted(value) {
    this.muted = value;
    if (this.ready) this.master.gain.setTargetAtTime(value ? 0 : .42, this.ctx.currentTime, .03);
  }

  update(speed, throttle, active) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const rpm = 48 + Math.min(120, Math.abs(speed) * 8) + Math.abs(throttle) * 35;
    this.engine.frequency.setTargetAtTime(rpm, now, .045);
    this.engine2.frequency.setTargetAtTime(rpm * .5, now, .05);
    this.engineFilter.frequency.setTargetAtTime(300 + Math.abs(throttle) * 700 + Math.abs(speed) * 18, now, .06);
    this.engineGain.gain.setTargetAtTime(active ? .10 + Math.abs(throttle) * .08 : 0, now, .06);
    this.windGain.gain.setTargetAtTime(active ? .025 + Math.min(.07, Math.abs(speed) * .005) : .016, now, .2);
  }

  tone(frequency, duration = .12, type = 'sine', volume = .18, slide = 1) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * slide), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .02);
  }

  click() { this.tone(260,.045,'square',.07,1.25); }
  checkpoint() { this.tone(520,.13,'sine',.16,1.5); setTimeout(() => this.tone(780,.18,'sine',.12,1.2),90); }
  crash() { this.tone(95,.42,'sawtooth',.24,.25); }
  finish() {
    [392,523.25,659.25].forEach((f,i) => setTimeout(() => this.tone(f,.35,'triangle',.16,1.02),i*110));
  }
}
