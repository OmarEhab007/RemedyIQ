#!/bin/sh
#Input parameter is Folder/file names to analyze.  Will analyze all files in target folder.
#Output will be generated in an analysis folder and then zipped
parentdir="$(dirname "$0")"
name="$1"

if [ $# -gt 1 ]
  then
    name="multiple"
fi

java -Xmx20g -XX:+UseConcMarkSweepGC -jar ${parentdir}/ARLogAnalyzer.jar -w "${name} analysis" -z "$@"
