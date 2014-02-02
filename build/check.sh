#!/bin/sh

echo "checking files..."

jshint -v ../pages/demo/*.html --extract=auto

jshint -v ../pages/examples/*.html --extract=auto

jshint -v ../src/*.js