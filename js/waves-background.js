var wavesInstance = null;
var wavesAnimationId = null;

function startWavesBackground() {
    if (wavesInstance) return;

    (function () {
      var pi = Math.PI;
      var pi2 = 2 * Math.PI;
  
      this.Waves = function(holder, options) {
        var Waves = this;
  
        Waves.options = extend(options || {}, {
          resize: false,
          rotation: 45,
          waves: 5,
          width: 100,
          hue: [11, 14],
          amplitude: 0.5,
          background: true,
          preload: true,
          speed: [0.004, 0.008],
          debug: false,
          fps: false,
        });
  
        Waves.waves = [];
  
        Waves.holder = document.querySelector(holder);
        if (!Waves.holder) return;
        Waves.canvas = document.createElement('canvas');
        Waves.ctx = Waves.canvas.getContext('2d');
        Waves.holder.appendChild(Waves.canvas);
  
        Waves.hue = Waves.options.hue[0];
        Waves.hueFw = true;
  
        Waves.resize();
        Waves.init(Waves.options.preload);
  
        if (Waves.options.resize)
          window.addEventListener('resize', function() {
            Waves.resize();
          }, false);
  
      };
  
      Waves.prototype.init = function(preload) {
        var Waves = this;
        var options = Waves.options;
  
        for (var i = 0; i < options.waves; i++)
          Waves.waves[i] = new Wave(Waves);
  
        if (preload) Waves.preload();
      };
  
      Waves.prototype.preload = function() {
        var Waves = this;
        var options = Waves.options;
  
        for (var i = 0; i < options.waves; i++) {
          Waves.updateColor();
          for (var j = 0; j < options.width; j++) {
            Waves.waves[i].update();
          }
        }
      };
  
      Waves.prototype.render = function() {
        var Waves = this;
        var ctx = Waves.ctx;
        var options = Waves.options;
  
        Waves.updateColor();
        Waves.clear();
  
        if (Waves.options.background) {
          Waves.background();
        }
  
        each(Waves.waves, function(wave, i) {
          wave.update();
          wave.draw();
        });
      };
  
      Waves.prototype.animate = function() {
        var Waves = this;
        Waves.render();
        wavesAnimationId = window.requestAnimationFrame(Waves.animate.bind(Waves));
      };
  
      Waves.prototype.clear = function() {
        var Waves = this;
        Waves.ctx.clearRect(0, 0, Waves.width, Waves.height);
      };
  
      Waves.prototype.background = function() {
        var Waves = this;
        var ctx = Waves.ctx;
  
        var gradient = Waves.ctx.createLinearGradient(0, 0, 0, Waves.height);
        gradient.addColorStop(0, '#000');
        gradient.addColorStop(1, Waves.color);
  
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, Waves.width, Waves.height);
      };
  
      Waves.prototype.resize = function() {
        var Waves = this;
        var width = Waves.holder.offsetWidth;
        var height = Waves.holder.offsetHeight;
        Waves.scale = window.devicePixelRatio || 1;
        Waves.width = width * Waves.scale;
        Waves.height = height * Waves.scale;
        Waves.canvas.width = Waves.width;
        Waves.canvas.height = Waves.height;
        Waves.canvas.style.width = width + 'px';
        Waves.canvas.style.height = height + 'px';
        Waves.radius = Math.sqrt(Math.pow(Waves.width, 2) + Math.pow(Waves.height, 2)) / 2;
        Waves.centerX = Waves.width / 2;
        Waves.centerY = Waves.height / 2;
      };
  
      Waves.prototype.updateColor = function() {
        var Waves = this;
  
        Waves.hue += (Waves.hueFw) ? 0.01 : -0.01;
  
        if (Waves.hue > Waves.options.hue[1] && Waves.hueFw) {
          Waves.hue = Waves.options.hue[1];
          Waves.hueFw = false;
        } else if (Waves.hue < Waves.options.hue[0] && !Waves.hueFw) {
          Waves.hue = Waves.options.hue[0];
          Waves.hueFw = true;
        }
  
        var a = Math.floor(127 * Math.sin(0.3 * Waves.hue + 0) + 128);
        var b = Math.floor(127 * Math.sin(0.3 * Waves.hue + 2) + 128);
        var c = Math.floor(127 * Math.sin(0.3 * Waves.hue + 4) + 128);
  
        Waves.color = 'rgba(' + a + ',' + b + ',' + c + ', 0.1)';
      };
  
      function Wave(Waves) {
        var Wave = this;
        var speed = Waves.options.speed;
  
        Wave.Waves = Waves;
        Wave.Lines = [];
  
        Wave.angle = [
          rnd(pi2),
          rnd(pi2),
          rnd(pi2),
          rnd(pi2)
        ];
  
        Wave.speed = [
          rnd(speed[0], speed[1]) * rnd_sign(),
          rnd(speed[0], speed[1]) * rnd_sign(),
          rnd(speed[0], speed[1]) * rnd_sign(),
          rnd(speed[0], speed[1]) * rnd_sign(),
        ];
  
        return Wave;
      }
  
      Wave.prototype.update = function() {
        var Wave = this;
        var Lines = Wave.Lines;
        var color = Wave.Waves.color;
  
        Lines.push(new Line(Wave, color));
  
        if (Lines.length > Wave.Waves.options.width) {
          Lines.shift();
        }
      };
  
      Wave.prototype.draw = function() {
        var Wave = this;
        var Waves = Wave.Waves;
  
        var ctx = Waves.ctx;
        var radius = Waves.radius;
        var radius3 = radius / 3;
        var x = Waves.centerX;
        var y = Waves.centerY;
        var rotation = dtr(Waves.options.rotation);
        var amplitude = Waves.options.amplitude;
  
        var Lines = Wave.Lines;
  
        each(Lines, function(line, i) {
          var angle = line.angle;
  
          var x1 = x - radius * Math.cos(angle[0] * amplitude + rotation);
          var y1 = y - radius * Math.sin(angle[0] * amplitude + rotation);
          var x2 = x + radius * Math.cos(angle[3] * amplitude + rotation);
          var y2 = y + radius * Math.sin(angle[3] * amplitude + rotation);
          var cpx1 = x - radius3 * Math.cos(angle[1] * amplitude * 2);
          var cpy1 = y - radius3 * Math.sin(angle[1] * amplitude * 2);
          var cpx2 = x + radius3 * Math.cos(angle[2] * amplitude * 2);
          var cpy2 = y + radius3 * Math.sin(angle[2] * amplitude * 2);
  
          ctx.strokeStyle = line.color;
  
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x2, y2);
          ctx.stroke();
        });
      };
  
      function Line(Wave, color) {
        var Line = this;
  
        var angle = Wave.angle;
        var speed = Wave.speed;
  
        Line.angle = [
          Math.sin(angle[0] += speed[0]),
          Math.sin(angle[1] += speed[1]),
          Math.sin(angle[2] += speed[2]),
          Math.sin(angle[3] += speed[3])
        ];
  
        Line.color = color;
      }
  
      function each(items, callback) {
        for (var i = 0; i < items.length; i++) {
          callback(items[i], i);
        }
      }
  
      function extend(options, defaults) {
        for (var key in options)
          if (defaults.hasOwnProperty(key))
            defaults[key] = options[key];
        return defaults;
      }
  
      function dtr(deg) {
        return deg * pi / 180;
      }
  
      function rnd(a, b) {
        if (arguments.length == 1)
          return Math.random() * a;
        return a + Math.random() * (b - a);
      }
  
      function rnd_sign() {
        return (Math.random() > 0.5) ? 1 : -1;
      }
  
    })();

    wavesInstance = new Waves('#holder', {
        waves: 5,
        width: 200,
    });

    wavesInstance.animate();
}

function stopWavesBackground() {
    if (wavesAnimationId) {
        window.cancelAnimationFrame(wavesAnimationId);
        wavesAnimationId = null;
    }
    const holder = document.getElementById('holder');
    if (holder) {
        holder.innerHTML = '';
    }
    wavesInstance = null;
}