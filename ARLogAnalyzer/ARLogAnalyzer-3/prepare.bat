@ECHO OFF
REM Takes all inputs provided and creates a single output file that is properly sorted by function and time

set batchFolder=%~dp0
set folders=
set name=%~1%

IF NOT "%~2" == "" set name=multiple
:Loop
IF "%~1" == "" GOTO Continue
   set folders=%folders% "%~1%"
SHIFT
GOTO Loop

:Continue
java -Xmx20g -XX:+UseConcMarkSweepGC -jar "%batchFolder%ARLogAnalyzer.jar" -prepare "%name%.Combined.log" %folders%
