//
// glif-functions.js 
// functions for processing stacks of images/textures
//

(function (global) {

  var glif = global.glif;

  // glif.functions namespace, these functions operate on stacks of 0..n input textures

  glif.functions = {};


  // one time use of a program, use exact arguments

  glif.functions._applyShader = function (glenv, fragmentShader, image, outtex, program_options) {

    var program = glenv.createProgram(fragmentShader, program_options);
    if (!program) return; // failure

    var intex = glenv.createTexture(image);
    return program.run(intex, outtex);
  };


  // zero sample image/texture inputs, generates output only

  glif.functions.generate = function (glenv, exprtext, outtex) {

    var options;
    if (typeof exprtext === 'object') { options = exprtext; exprtext = options.exprtext; }
    options = options || {};

    var text = glif.glsl.getSampleStackShaderText (0, exprtext);
    return this._applyShader(glenv, text, null, outtex, options);
  };

// single image input

  glif.functions.effect = function (glenv, image, exprtext, outtex) {

    // arrange arguments
    if (image instanceof glif.glenv) { image = image.getCanvas(); }
    else if (!image || !glif.util.isProgramInput(image)) {
      outtex = exprtext; exprtext = image; image = null;
    }

    var options;
    if (typeof exprtext === 'object') { options = exprtext; exprtext = options.expr; }
    options = options || {};

    // if no input image use the gl context's canvas
    image = image || glenv.getTexture();

    // now to the 
    var shadertext = glif.glsl.getSampleStackShaderText (1, exprtext, { varnames: ['c'] });
    return this._applyShader(glenv, shadertext, image, outtex, options);
  };


  // blending functions - 2 or more input sample textures

  // helper function blendexpr() creates a fragment shader expression string for 2 image compositing
  // to be passed to a stack fragment shader builder. 
  // inputs are string blendmode and string composite mode names. 
  // only handles premultiplied alpha currently.

  glif.functions.blendexpr = function (blendmode, compositemode) {

    // blend mode expressions for rgb1 a (Cb) and b (Cs) components
    var blendmode_exprs =  {

      normal: '__Cs__.rgb',
      lighten: 'max(__Cb__.rgb, __Cs__.rgb)',
      darken: 'min(__Cb__.rgb, __Cs__.rgb)',

      multiply: '__Cb__.rgb * __Cs__.rgb',
      screen: 'vec3(1.) - (vec3(1.) - __Cb__.rgb) * (vec3(1.) - __Cs__.rgb)',
      subtract: '__Cb__.rgb - __Cs__.rgb',
      difference: 'abs(__Cb__.rgb - __Cs__.rgb)',

      overlay:
        'vec3((__Cb__.r < 0.5) ? (2.*__Cb__.r*__Cs__.r) : (1.-2.*(1.-__Cb__.r)*(1.-__Cs__.r)),\n' +
        '     (__Cb__.g < 0.5) ? (2.*__Cb__.g*__Cs__.g) : (1.-2.*(1.-__Cb__.g)*(1.-__Cs__.g)),\n' +
        '     (__Cb__.b < 0.5) ? (2.*__Cb__.b*__Cs__.b) : (1.-2.*(1.-__Cb__.b)*(1.-__Cs__.b)))',

      'hard-light':
        'vec3((__Cs__.r < 0.5) ? (2.*__Cb__.r*__Cs__.r) : (1.-2.*(1.-__Cb__.r)*(1.-__Cs__.r)),\n' +
        '     (__Cs__.g < 0.5) ? (2.*__Cb__.g*__Cs__.g) : (1.-2.*(1.-__Cb__.g)*(1.-__Cs__.g)),\n' +
        '     (__Cs__.b < 0.5) ? (2.*__Cb__.b*__Cs__.b) : (1.-2.*(1.-__Cb__.b)*(1.-__Cs__.b)))',

      'color-dodge':
        'vec3((__Cb__.r == 0.) ? 0. : ((__Cs__.r == 1.) ? 1. : min(1., __Cb__.r / (1. - __Cs__.r))),\n' +
        '     (__Cb__.g == 0.) ? 0. : ((__Cs__.g == 1.) ? 1. : min(1., __Cb__.g / (1. - __Cs__.g))),\n' +
        '     (__Cb__.b == 0.) ? 0. : ((__Cs__.b == 1.) ? 1. : min(1., __Cb__.b / (1. - __Cs__.b))))',

      'color-burn':
        'vec3((__Cb__.r == 1.) ? 1. : ((__Cs__.r == 0.) ? 0. : (1. - min(1., (1. - __Cb__.r) / __Cs__.r))),\n' +
        '     (__Cb__.g == 1.) ? 1. : ((__Cs__.g == 0.) ? 0. : (1. - min(1., (1. - __Cb__.g) / __Cs__.g))),\n' +
        '     (__Cb__.b == 1.) ? 1. : ((__Cs__.b == 0.) ? 0. : (1. - min(1., (1. - __Cb__.b) / __Cs__.b))))',

      'soft-light':
        'vec3( (__Cs__.r <= 0.5) ? (__Cb__.r - (1. - clamp(2. * __Cs__.r, 0., 1.)) * __Cb__.r * (1. - __Cb__.r)) : __Cb__.r + (2. * __Cs__.r - 1.) * ((__Cb__.r <= 0.25) ? (((16. * __Cb__.r - 12.) * __Cb__.r + 4.) * __Cb__.r) : sqrt(__Cb__.r) - __Cb__.r),\n' +
        '      (__Cs__.g <= 0.5) ? (__Cb__.g - (1. - clamp(2. * __Cs__.g, 0., 1.)) * __Cb__.g * (1. - __Cb__.g)) : __Cb__.g + (2. * __Cs__.g - 1.) * ((__Cb__.g <= 0.25) ? (((16. * __Cb__.g - 12.) * __Cb__.g + 4.) * __Cb__.g) : sqrt(__Cb__.g) - __Cb__.g),\n' +
        '      (__Cs__.b <= 0.5) ? (__Cb__.b - (1. - clamp(2. * __Cs__.b, 0., 1.)) * __Cb__.b * (1. - __Cb__.b)) : __Cb__.b + (2. * __Cs__.b - 1.) * ((__Cb__.b <= 0.25) ? (((16. * __Cb__.b - 12.) * __Cb__.b + 4.) * __Cb__.b) : sqrt(__Cb__.b) - __Cb__.b))',

      'pin-light':
        'vec3((__Cs__.r < 0.5) ? min(__Cb__.r, 2.0 * __Cs__.r) : max(__Cb__.r, 2.0*(__Cs__.r - 0.5)),\n' +
        '     (__Cs__.g < 0.5) ? min(__Cb__.g, 2.0 * __Cs__.g) : max(__Cb__.g, 2.0*(__Cs__.g - 0.5)),\n' +
        '     (__Cs__.b < 0.5) ? min(__Cb__.b, 2.0 * __Cs__.b) : max(__Cb__.b, 2.0*(__Cs__.b - 0.5)))',

      exclusion: '(__Cb__ + __Cs__ - 2. * __Cb__ * __Cs__).rgb'

      /*// to do non-rgb blends, must have a way to include glsl.helpers.color mixins in the shader
      hue: 'setLum(setSat(Cs, sat(__Cb__)), lum(__Cb__)))',
      saturation: 'setLum(setSat(__Cb__, sat(__Cs__)), lum(__Cb__))',
      color: 'setLum(__Cs__, lum(__Cb__))',
      luminosity: 'setLum(__Cb__, lum(__Cs__))'
      */
    };

    function createBlendExpr(name, csName, cbName) {
      return blendmode_exprs[name].replace(/__Cs__/g, csName || "Cs").replace(/__Cb__/g, cbName || "Cb");
    }

    compositeExprs = {
      //Fa = 1; Fb = 1 – αs 
      //co = αs x Cs + αb x Cb x (1 – αs)
      //αo = αs + αb x (1 – αs)    

      // from flex4 source, softlight.pbk
      // http://svn.apache.org/repos/asf/flex/sdk/trunk/frameworks/projects/framework/src/mx/graphics/shaderClasses/SoftLight.pbk
      over: 'vec4(\n' +
        '(1.0 - Cs.a) * Cb.rgb * Cb.a + (1.0 - Cb.a) * Cs.rgb * Cs.a + Cs.a * Cb.a * (\n' +
        '__CBlendExpr__\n' +
        '), (1.0 - Cs.a) * Cb.a + Cs.a)',


      // incorrect results with in, out composite modes where alpha < 1 in both images

      //Fa = αb; Fb = 0
      //  co = αs x Cs x αb
      //  αo = αs x αb

      'in': '// in composite modes are incorrect currently\n' +
        'vec4(\n' +
        'Cs.rgb * Cs.a * (1.-Cb.a) + Cb.a * Cs.a * (\n' +
        '__CBlendExpr__\n' +
        '), Cs.a * (1. - Cb.a) + Cs.a)',

      //Fa = 1 – αb; Fb = 0
      //co = αs x Cs x (1 – αb)
      //αo = αs x (1 – αb)
      out:  '// out composite modes are incorrect currently\n' +
        'vec4(\n' +
        'Cb.rgb * Cb.a * (1.-Cs.a) + Cb.a * Cs.a * (\n' +
        '__CBlendExpr__\n' +
        '), Cb.a * (1. - Cs.a) + Cb.a)'

      // atop
      //Fa = αb; Fb = 1 – αs
      //co = αs x Cs x αb + αb x Cb x (1 – αs)
      //αo = αs x αb + αb x (1 – αs)
    };

    var compositeExpr,
    swap = false; // swap Cb/Cs layers

    if (!compositemode || compositemode === 'source-over') {
      compositeExpr = compositeExprs.over;
    }
    else if (compositemode === 'destination-over') {
      compositeExpr = compositeExprs.over;
      swap = true;
    }
    else if (compositemode === 'source-in') {
      compositeExpr = compositeExprs['in'];
    }
    else if (compositemode === 'destination-in') {
      compositeExpr = compositeExprs['in'];
      swap = true;
    }
    else if (compositemode === 'source-out') {
      compositeExpr = compositeExprs.out;
    }
    else if (compositemode === 'destination-out') {
      compositeExpr = compositeExprs.out;
      swap = true;
    }
    else if (compositemode === 'destination') {
      return 'vec4(Cb.rgb * Cb.a, Cb.a)';
    }
    else if (compositemode === 'copy') {
      return 'vec4(Cs.rgb * Cs.a, Cs.a)';
    }

    // composite mode not found
    if (!compositeExpr) {
      console.log('blendexpr() composite mode ' + compositemode + 'not found');
      return 'vec4(\n// unknown/unsupported composite mode ' + compositeExpr + ' \n0.5, 0., 1.-x, 1.)';
    }

    // CblendExpr is an expression string that evaluates to 'vec3(r,g,b) in shader
    // swap inputs to blend for source/destination composite modes (is that correct)
    var CblendExpr = createBlendExpr(blendmode, swap ? 'Cb' : 'Cs', swap ? 'Cs' : 'Cb');

    if (!CblendExpr) {
      console.log('blendexpr() blend mode ' + blendmode + 'not found, using normal');
      CblendExpr = '// blendexpr() blend mode ' + blendmode + 'not found, using normal\n' + createBlendExpr('normal');
    }

    CblendExpr = '\n// blend expr\n' + CblendExpr + '\n//\n';
    return compositeExpr.replace(/__CBlendExpr__/g, CblendExpr);
  };


  // 2 inputs, supports blend and composite modes
  glif.functions.blendComposite = function (glenv, imageBack, imageSrc, outtex, options) {

    if (!(outtex instanceof glif.Texture)) {options = outtex || {}; outtex = null;}

    var exprtext;
    if (typeof options === 'string') {exprtext = options; options = {};}
    else if (options) {
      exprtext = options.expr || blendexpr(options.blendmode, options.compositemode);
    }

    // FIXME shouldnt write to options (although harmless here), also custom varnames wont work right now
    options.varnames = options.varnames || ['Cb', 'Cs'];

    var text =  glif.glsl.getSampleStackShaderText (2, exprtext, options);
    var program = glenv.createProgram(text);
    if (!program) return; // failed

    var texB = glenv.createTexture(imageBack);
    var texS = glenv.createTexture(imageSrc);

    return program.run([texB, texS], outtex, options.properties);
  };

  glif.functions.blendStack = function (glenv, images, outtex, options) {

    if (!(outtex instanceof glif.Texture)) {options = outtex || {}; outtex = null;}

    var exprtext;
    if (typeof options === 'string') {
      exprtext = options; options = {};
    }
    else if (options) {
      exprtext = options.expr;
    }

    var shadertext = glif.glsl.getSampleStackShaderText (images.length, exprtext, options);
    program = glenv.createProgram(shadertext);
    if (!program) return; // failed

    var textures = [];
    for (var i = 0; i < images.length; i++)
      textures.push(glenv.createTexture(images[i]));

    return program.run(textures, outtex, options.properties);
  };


  // utility functions namespace 

  glif.u = glif.util = {};

  glif.util.isImage = function (obj) {
    return (obj instanceof HTMLCanvasElement) || (obj instanceof HTMLImageElement) || (obj instanceof HTMLVideoElement);
  };

  // check null separately
  glif.util.isProgramInput = function (obj) {
    return this.isImage(obj) || (obj instanceof glif.Texture);
  };



  // add primary functions to glenv

  // generate ( expr {string}, [output {Texture|null}] )
  // generate ( options, [output] )
  glif.glenv.prototype.generate = function (expr, output) {
    return glif.functions.generate(this, expr, output);
  };

  // effect ( image {Image|Canvas}, expr {string}, output {Texture|null} )
  // effect ( image {Image|Canvas}, options )
  glif.glenv.prototype.effect = function (image, expr, output) {
    return glif.functions.effect(this, image, expr, output);
  };

  glif.glenv.prototype.blendComposite = function (image, imageBack, imageSrc, output, options) {
    return glif.functions.blendComposite(this, image, imageBack, imageSrc, output, options);
  };

  glif.glenv.prototype.blendStack = function (images, output, options) {
    return glif.functions.blendStack(this, images, output, options);
  };

})(this);
