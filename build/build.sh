#!/bin/sh

# run from build directory or change these paths

project_path="../"
archive_path="./"
source_path=${project_path}"src/"

version=$(<VERSION)

catfile=${project_path}glif.js
outfile=${project_path}glif.min.js

buildfile=${archive_path}glif-${version}.min.js

# location of google closure compiler tool, requires java
closure_jar_path=~/tools/closure/compiler.jar


echo "### building glif lib version "$version" ###"

rm $catfile
rm $outfile
rm $buildfile

# exit on any following error
set -e

# add a version comment line to uncompressed
echo "/* glif library version "$version" "$(date)" */" > /tmp/newfile

# create uncompressed js file
echo "### creating unminified file ###"

cat \
  /tmp/newfile \
  ${source_path}glif-base.js \
  ${source_path}glif-glsl.js \
  ${source_path}glif-math.js \
  ${source_path}glif-classes.js \
  ${source_path}glif-functions.js \
  ${source_path}glif-area.js \
  > $catfile

# create the minified js file
echo "### compiling minified file ###"

#$compiled=$(java -jar ${closure_jar_path} --js ${catfile} --js_output_file ${outfile})
java -jar ${closure_jar_path} --js $catfile --js_output_file $outfile

#if $compiled; then
#  echo "Could not compile javascript." 1>&2
#  rm $catfile
#  exit 1
#fi

# create archive js file
echo "### archiving version identified file ###"
cp $outfile $buildfile

echo "done."