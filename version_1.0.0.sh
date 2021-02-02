#!/bin/bash

# cd
root=$(cd "$(dirname "$0")";pwd)

# generate manifest (change version first!).
node version_generator.js -v 1.0.0 -u http://192.168.55.19:5503/remote-assets/ -s ./build/ios/assets -d assets/
