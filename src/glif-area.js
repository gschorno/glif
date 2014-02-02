//
// glif-area.js 
// anything having to do with area processes/sampling is in here for now
//

(function (global) {

  var glif = global.glif;

  // glif.area namespace, utility functions used by primary functions blur() and convolve() 

  glif.area = {

    // 
    // blur section

    // input kernel weights are stored as an array starting with center weight, 
    // ending with outer weight, let's call it a centroid. 

    // utility function, generate [-1, 1] symmetric kernel from [0,1] centroid weight series
    kernelFromCentroid: function (weights) {
      var kernel = [];
      for (var i = 1 - weights.length; i < weights.length; i++) {
        kernel.push(weights[(i < 0) ? -i : i]);
      }
      return kernel;
    },

    // symmetric 1-d kernels are generated in the shader script output from the 
    // following two functions


    // generate a 1-d horizontal blur shader text
    // generates arrays of kernel weights and positions to feed to the shader text generator
    // input is centroid weights 
    getHorizBlurShaderText: function (weights) {

      var pos = [], kernel = this.kernelFromCentroid(weights);
      for (var i = 1 - weights.length; i < weights.length; i++) { 
        pos.push([i, 0]); 
      }

      return glif.glsl.getWeightedSampleSumShaderText(kernel, pos);
    },

    // generates a 1-d vertical blur shader text
    getVertBlurShaderText: function (weights) {

      var pos = [], kernel = this.kernelFromCentroid(weights);
      for (var i = 1 - weights.length; i < weights.length; i++) {
        pos.push([0, i]);
      }

      return glif.glsl.getWeightedSampleSumShaderText(kernel, pos);
    },


    blurs: {

      // utility function to generate weight series using a callback
      _generate_weights: function (opts, radius) {

        radius = Math.max(1, Math.abs(radius || opts.radius));

        var r = [],
        iradius = Math.ceil(radius),
        genfn = this.generators[(opts.name || opts.type) + '_blur'];

        for (var i = 0; i < iradius; i++) {
          var sample = genfn(i / radius, opts);

          if (isNaN(sample)) r.push(1.001001); // return null;
          else r.push(sample);
        }

        return r;
      },

      //
      generators: {

        // x is relative distance from center to edge 
        gaussian_blur: function (x, options) {
          var sigma = options.sigma || 0.5,
          s2 = sigma * sigma * 2;
          return (1 / Math.sqrt(Math.PI * s2)) * Math.exp(-(x * x / s2));
        },

        // q-gaussian blur - http://arxiv.org/abs/1311.2561
        // http://en.wikipedia.org/wiki/Q-Gaussian_distribution
        q_gaussian_blur: function (x, options) {
          var sigma = options.sigma || 0.5; q = options.q || 1;
          var s2 = sigma * sigma * 2;

          // http://www.unix.com/programming/241295-javascript-gamma-approximation.html
          function gamma (z) {
            var p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
              -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
            if (z < 0.5) {
              return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
            } else {
              z -= 1;
              var x = p[0];
              for (var i = 0; i < p.length; i++) x += p[i] / (z + i);
              t = z + p.length - 1.5;
              return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
            }
          }

          function expq (q, x) {
            var r = (q === 1) ? 1 : 1 / Math.pow(1 + (1 - q) * x, 1 / (1 - q));
            return r;
          }

          function c (q) {
            var r = (q < 1) ?
              ((2 * Math.sqrt(Math.PI) * gamma(1 / (1 - q))) /
              ((3 - q) * Math.sqrt(1 - q) * gamma((3 - q) / (2 * (1 - q))))
              ) :
              ((q === 1) ? Math.PI :
                (Math.sqrt(Math.PI) * gamma((3 - q) / (2 * (q - 1))) /
                ((3 - q) * Math.sqrt(q - 1) * gamma(1 / (q - 1)))
                )
              );
            return r;
          }

          var r = (1 / (c(q) * Math.sqrt(s2))) * expq(q, -(x * x / s2));
          return Math.max(0, 1 - r);
        },

        box_blur: function (x) {
          return 1;
        },

        triangle_blur: function (x) {
          return 1 - x;
        }
      },

      // normalize centroid weights
      _normalizeCentroid: function (input) {
        var sum = 0;
        input.forEach(function (v, i) {
          sum += (i ? 2 : 1) * v;
        }) ;

        if (sum <= 0) sum = 1;
        return input.map(function (x) {
          return x / sum;
        });
      },

      // this is the one to call
      // return value is a 1-d centroid weight series
      getWeights: function (options, radius) {
        return this._normalizeCentroid(
        this._generate_weights(options, radius)
        );
      }

    },

    // scale series values to sum to 1
    normalizeSeriesSum: function (values) {

      var sum = 0;//, i;//, out = [];
      values.forEach(function (v) { 
        sum += v; 
      })
      if (sum <= 0.0) return values;
      return values.map(function (x) {
        return x / sum;
      })
    },

    // temporarily here
    runProgramList: function (glenv, image, outtex, programs) {
      var doublebuffer = new glif.DoubleBuffer(glenv, image);

      for (var i = 0; i < programs.length; i++) {
        var pitem = programs[i];

        var last = (i === programs.length - 1);

        pitem.program.run(doublebuffer.advance(), 
          last ? (outtex || null) : doublebuffer.outputFB(),
          pitem.params);
      }
      doublebuffer.destroy();
    },

    applyBlur: function (glenv, image, outtex, params) {
      var i, last, outfb, 
        icount = params.icount || 1,
        vblurprogram = glenv.createProgram(glif.area.getVertBlurShaderText(params.weights)),
        hblurprogram = glenv.createProgram(glif.area.getHorizBlurShaderText(params.weights)),
        programlist = [];

      if (params.interleave) {
        for (i = 0; i < icount; i++) {
          programlist.push({ program: hblurprogram });
          programlist.push({ program: vblurprogram });
        }
      }
      else {
        for (i = 0; i < icount; i++) {
          programlist.push({ program: hblurprogram });
        }

        for (i = 0; i < icount; i++) {
          programlist.push({ program: vblurprogram });
        }
      }

      this.runProgramList(glenv, image, outtex, programlist);
    },


    // blur() : apply separable two pass blur, horizontal and vertical

    blur: function (glenv, image, options, outtex) {

      // ok, all of this setup should be modularized, doing something very similar in effect() etc.
      if (image instanceof glif.glenv) {
        image = image.getCanvas();
      }
      else if (!image || !glif.util.isProgramInput(image)) {
        outtex = options; options = image; image = null;
      }

      // if no input image use context's canvas
      image = image || glenv.getCanvas();

      var passcount = 1,
      radius = options.radius;

      // The radius of single larger gaussian blur equals the square root of the sum of the 
      //squares of the blur radii of x multiple applications of the blur. Split the blur into 
      // equal multiple passes.
      if (options.passcount) {
        passcount = options.passcount;
        radius *= Math.sqrt(passcount) / passcount;
      }
      else {// split until radius < threshold
        while (options.maxradius && radius > options.maxradius) {
          passcount *= 2;
          radius *= Math.sqrt(2) / 2;
        }
      }

      var weights = glif.area.blurs.getWeights(options, radius);

      this.applyBlur(glenv, image, outtex, {weights:weights, icount: passcount, interleave: options.interleave});

      // return info about the blur just applied - [kernel weights, number of passes, radius] 
      return [weights, passcount, radius ? radius : weights.length];
    },

    //
    // convolution section

    // generate shader text for a 2-d convolution kernel
    // 'kernel' is an array of float weights or the name of the uniform array to use for weights

    getConvolveShaderText: function (kernel, width, height, options) {
      options = options || {};

      if (Array.isArray(kernel)) {// fixed values written into shader text
        while (kernel.length < width * height) kernel.push(0); // fill in

        // normalize kernel
        if (!options.no_normalize) {
          this.normalizeSeriesSum(kernel);
        }
      }

      var positions = [];

      // build position grid
      for (var j = 0; j < height; j++) {
        for (i = 0; i < width; i++) {
          positions.push([(i - (width - 1) / 2), (j - (height - 1) / 2)]);
        }
      }

      return glif.glsl.getWeightedSampleSumShaderText(kernel, positions, options);
    },

    // apply pair of horizontal/vertical blurs, icount times

    // convolve() - image convolution with dynamic or static kernel 
    convolve: function (glenv, image, kernel, width, height, options) {

      var convolveShader = getConvolveShaderText(kernel, width, height, options);
      glif.functions._applyShader(glenv, convolveShader, image);
    },


    // 
    // warp section

    // warp src image by r (x) and g (y) difference from 0.5
    warpImageShaderText: glif.glsl.commonFS + glif.glsl.commonUniforms +
      'uniform sampler2D imageSrc;\n' +
      'uniform sampler2D imageWarp;\n' +
      'uniform mat3 transform;\n' +
      'uniform float expval;\n' +
      'void main() {\n' +
      '  vec3 warpvec = (texture2D(imageWarp, pos).rgb - vec3(0.5))*2.;\n' +
      '  float mag = length(warpvec);\n' +
      '  warpvec *= pow(mag, expval) / mag;\n' +
      '  warpvec = (transform * vec3(pixelSize * warpvec.xy, 1.));\n' +
      '  gl_FragColor = texture2D(imageSrc, pos + warpvec.xy);\n' +
      '}',

    // see demo/demo_warp.html for an example. 

    warpImage: function (glenv, imageSrc, imageWarp, options, outtex) {

      var matrix = options.mat3 || 
          new glif.mat3().rotate(options.angle * Math.PI / 180).scale(options.scale).shear(options.shearX, options.shearY);

      var program = glenv.createProgram(this.warpImageShaderText);
      if (!program) return;

      var tex1 = glenv.createTexture(imageSrc, { name:'imageSrc', filter:'linear' });
      var tex2 = glenv.createTexture(imageWarp, { name:'imageWarp' });

      return program.run([tex1, tex2], outtex, { transform: matrix, expval: options.shape || 1 });
    }

  }; // glif.area namespace


  // attach primary functions to glenv

  // convolve ( image {Image|Canvas}, kernel {Array|uniform name}, [width, height], outtex {Texture|null}, [options] )
  // convolve ( image {Image|Canvas}, [options] )
  glif.glenv.prototype.convolve = function (image, kernel, width, height, options) {

    return glif.area.convolve(this, image, kernel, width, height, options);
  };

  // ( image {Image|Canvas}, options, outtex {Texture|null} )
  glif.glenv.prototype.blur = function (image, options, outtex) {

    return glif.area.blur(this, image, options, outtex);
  };

  // ( image source {Image|Canvas}, warp image {Image|Canvas}, options, outtex {Texture|null} )
  glif.glenv.prototype.warpImage = function (imageSrc, imageWarp, options, outtex) {

    return glif.area.warpImage(this, imageSrc, imageWarp, options, outtex);
  };

})(this);
