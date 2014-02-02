//
// glif-glsl.js 
// functions/data for assembling glsl shader text strings
//

(function (global) {

  var glif = global.glif;

  // glsl namespace, assembling shader text
  glif.glsl = {

    // floatstr(inputvalue)
    // return a string float representation with decimal point
    // given a number or numeric string input
    floatstr: function (num) {
      var r = '' + parseFloat(num);
      return (r.indexOf('.') === -1) ? (r + '.') : r;
    },

    // join input array or string with line feeds
    joinLines: function (lines, sepr) {
      sepr = sepr || '\n';
      if (!lines) return '';
      else if (Array.isArray(lines)) return lines.join(sepr) + sepr;
      else if (typeof lines === 'string') return lines + sepr;
      return ''; // unknown type
    },

    // valid characters for expressions 
    filterExpr: function (str) {
      return str.replace(/[^\w\s\.\,\:\?\(\)\*\+\;\-\/\=<\>\|\&]/g,'');
    },

    // and functions
    filterFunction: function (str) {
      return str.replace(/[^\w\s\.\,\:\?\(\)\*\+\;\-\/\=<\>\|\&\{\}]/g,'');
    },

    // common glsl text
    commonVS:
      'attribute vec3 aPos;\n' +
      'attribute vec2 aTexCoord;\n' +
      'varying   vec2 pos;\n',

    commonFS:
      'precision mediump float;\n' +
      'varying   vec2 pos;\n',

    commonUniforms:
      'uniform   vec2 pixelSize;\n',
    //'uniform ivec2 res;\n' +
    //'uniform   float aspect;\n',


    getDefaultVS: function (flip) {
      return this.commonVS +
        'void main(void) {\n' +
        '  gl_Position = ' + (flip ? 'vec4(aPos.x, -aPos.y, aPos.z, 1.)' : 'vec4(aPos, 1.)') + ';\n' +
        '  pos = aTexCoord;\n' +
        '}\n';
    },

    getMat3VS: function () {
      return glif.glsl.commonVS +
        'uniform mat3 transform;\n' +
        'void main() {\n' +
        '  gl_Position = vec4(transform * aPos, 1);\n' +
        '  pos = aTexCoord;\n' +
        '}\n';
    },


    // build glsl fragment shader text to process a stack of pixel aligned sample2d textures

    getSampleStackShaderText: function (samplect, resultexpr, options) {
      if (typeof resultexpr === 'object') {options = resultexpr; resultexpr = options.expr;}
      options = options || {};

      // create uniform sample2d lines and variables with sample at current x, y position
      var uniforms = [], pixvars = [];

      // todo move this back out to the app or make it opt in, 'pos' is always available
      if (!options.noxy) {
        pixvars.push('  float x = pos.x;');
        pixvars.push('  float y = pos.y;');
      }

      for (var i = 0; i < samplect; i++) {

        // sample name and variable name defaults are 'sample0' and 'c0'
        var samplename = (options.samplenames ? options.samplenames[i] : ('sample' + i)),
        varname = (options.varnames ? options.varnames[i] : ('c' + i));

        uniforms.push('uniform sampler2D ' + samplename  + ';');
        pixvars.push('  vec4 ' + varname  + ' = texture2D(' + samplename  + ', pos);');
      }

      if (options.uniforms) {
        options.uniforms.forEach(function (x) { uniforms.push('uniform ' + x); });
      }

      return [ this.commonFS +
      this.joinLines(options.globals),
      this.joinLines(uniforms),
      this.joinLines(options.functions),
        'void main() {',
      this.joinLines(pixvars),
      this.joinLines(options.locals),
        '  gl_FragColor = ' + this.filterExpr(resultexpr) + ';',
        '}'].join('\n');
    },

    getSampleGLSLText: function (pos, samplename) {
      return 'texture2D(' + (samplename || 'sample0') + ', pos + pixelSize * vec2(' + pos[0] + ', ' + pos[1] + '))';
    },

    // generate fragment shader text for weight averaged sum of samples

    getWeightedSampleSumShaderText: function (kernel, positions, options) {
      options = options || {};
      var useuniform = typeof kernel === 'string', // use uniform to pass weights, kernel is uniform array name
      samplename = options.samplename || 'sample0',

      code = this.commonFS + this.commonUniforms +
        this.joinLines(options.globals)  + '\n' +

        'uniform sampler2D ' + samplename + ';\n' +
        (useuniform ? 'uniform float ' + kernel + '[' + positions.length + '];\n' : '') +
        this.joinLines(options.functions) + '\n' +
        'void main() {\n' +
        this.joinLines(options.locals) +
        'vec4 sum = vec4(0.0);\n';

      for (var i = 0; i < positions.length; i++) {
        code += 'sum += ' +
        this.getSampleGLSLText(positions[i], samplename) + ' * ' +
          (useuniform ? (kernel  + '[' + i + ']') : this.floatstr(kernel[i])) +
          ';\n';
      }

      code += 'gl_FragColor = ';
      if (options.value_script)
        code += value_script + ';\n';
      else if (options.rgb)
        code += 'vec4(sum.rgb, texture2D(' + samplename + ', pos).a);\n';
      else
        code += 'sum;\n';
      code += '}';

      //console.log(code);
      return code;
    },

    helpers: {
      // glsl functions

      color: {
        // following from http://dev.w3.org/fxtf/compositing-1/
        lum: 'float lum(vec3 C) { return 0.3 * C.r + 0.59 * C.g + 0.11 * C.b; }\n',

        clipColor:
          'float clipColor(vec3 C) {\n' +
          '  float L = lum(C);\n' +
          '  float n = min(C.r, C.g, C.b);\n' +
          '  float x = max(C.r, C.g, C.b);\n' +
          '  if(n < 0.0)\n' +
          '    C = L + (((C - L) * L) / (L - n));\n' +
          '  if(x > 1.0)\n' +
          '    C = L + (((C - L) * (1 - L)) / (x - L));\n' +
          '  return C;\n' +
          '}\n',

        setLum:
          'float setLum(C, l) {\n' +
          '  float d = l - lum(C);\n' +
          '  return clipColor(C + vec3(d));\n' +
          '}\n',

        maxC: 'float maxC(vec3 C) { return max(max(C.r, C.g), C.b); }\n',
        minC: 'float maxC(vec3 C) { return max(max(C.r, C.g), C.b); }\n',

        sat:
          'float sat(vec3 C) {\n' +
          '  return maxC(C) - minC(C)\n' +
          '}\n',

        setSat:
          'void setSatColor(float Cmin, float Cmid, float Cmax, float s) {\n' +
          '  if(Cmax > Cmin)\n' +
          '    Cmid = (((Cmid - Cmin) * s) / (Cmax - Cmin))\n' +
          '    Cmax = s\n' +
          '  else\n' +
          '    Cmid = Cmax = 0\n' +
          '  Cmin = 0\n' +
          '}\n' +
          'float setSat(vec3 C, float s) {\n' +
          '  if (C.r <= C.g) {\n' +
          '    if (C.g <= C.b) return setSatColor(C.r, C.g, C.b, s);\n' +
          '    else {\n' +
          '      if (C.r <= C.b) setSatColor(C.r, C.b, C.g, s);\n' +
          '      else setSatColor(C.b, C.r, C.g, s);\n' +
          '    }\n' +
          '  } else {\n' +
          '    if (C.r <= C.b) setSatColor(C.g, C.r, C.b, s);\n' +
          '    else {\n' +
          '      if (C.g <= C.b) setSatColor(C.g, C.b, C.r, s);\n' +
          '      else setSatColor(C.b, C.g, C.r, s);\n' +
          '    }\n' +
          '  }\n' +
          '  return C;\n' +
          '}\n'
      }
    }
  } // glif.glsl namespace


})(this);
