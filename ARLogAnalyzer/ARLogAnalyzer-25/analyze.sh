#!/bin/sh
#Input parameter is Folder/file names to analyze.  Will analyze all files in target folder.
#Plaintext output only
parentdir="$(dirname "$0")"
name="$1"

if [ $# -gt 1 ]
  then
    name="multiple"
fi

java -Xmx20g -XX:+UseConcMarkSweepGC -jar ${parentdir}/ARLogAnalyzer.jar "$@" > "${name}.ARLogAnalyzer.log"
