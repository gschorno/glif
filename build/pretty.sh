#!/bin/sh

# run codepainter on source files
# https://github.com/jedmao/codepainter
# then hand edit { spaces_inside_curly_brackets }

cd ../src

codepaint xform -j ../build/glif-codepainter.json "**/*.js"

cd ../build
