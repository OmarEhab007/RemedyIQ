@ECHO OFF
REM Input parameter is Folder/file names to analyze.  Will analyze all files in target folder.
REM Plaintext output only

set batchFolder=%~dp0
set folders=
set name=%1%

IF NOT "%~2" == "" set name=multiple
:Loop
IF "%~1" == "" GOTO Continue
   set folders=%folders% "%~1%"
SHIFT
GOTO Loop

:Continue
java -Xmx20g -XX:+UseConcMarkSweepGC -jar "%batchFolder%ARLogAnalyzer.jar" %folders% > %name%.ARLogAnalyzer.log 2>&1
