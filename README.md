
**glif** - GL Image Framework
===========================

**glif** is an experimental javascript library that uses WebGL for 2d image manipulation and image processing.


How To Use
----------

The best way to use this code for now is as a reference for your own experiments in WebGL.

**glif** library is very new and unstable! It is going to change. 

but it can do some cool things, so to get started ---



Simple interfaces for common tasks.
-----------------------------------

You can do something interesting in two lines.

```

// -- get glif canvas environment object

var gcanvas = glif.getEnv('canvas_id_to_draw_to');


// -- generate an interesting procedural gradient

gcanvas.generate(" vec4 ( x, y, (1. - x) * (1. - y), 1. ) "); 


// -- or change the gamma contrast of an image 

gcanvas.effect(input_image_or_canvas, " vec4 ( pow ( c.rgb, vec3(1.4) ), c.a ) "); 


// -- or apply blur to an image

gcanvas.blur(input_image_or_canvas, { type: 'gaussian', radius: 8 });

```

As you can see from the generate() and effect() function examples, it's possible to write a relatively complex image processing shader in a line of script, while **glif** takes care of the gritty details.


The files in the examples directory show (what else) examples of using the functions listed above.

 . example links go here .

For more info on the script expressions please refer to sources for GLSL programming, and the glif source code for the time being. It's experimental. 

Todo set up demos asap

. put demo page link to github.io .


Acknowledments:
---------------

- [Greggman tutorials](https://github.com/greggman/webgl-fundamentals)
- [Ibiblio gpu demos - Conway's life](http://www.ibiblio.org/e-notes/webgl/ca/life.html)
- [@Flexi23 reaction diffusion demo](http://webglplayground.net/share/reaction-diffusion?gallery=1&fullscreen=0&width=800&height=600&header=1)
- [glfx Texture class](https://github.com/evanw/glfx.js)
- [TojiCode blog](http://blog.tojicode.com/)
