<html>
<head>
<title>About ${app} ${version}
</title>
<meta charset="UTF-8">
<style>
body {
    /*background-color: #fffff8;*/
    background-color: white;
}
.pre_ {
    background-color: white;
}
.maintitles {
    text-align: center;
}
.komputar {
    font-family: monospace;
}
.Program {
    font-weight: bold;
}
.tilt {
    font-style: italic;
}
.helpoutput {
    border: 1px solid black;
}
</style>
</head>
<body>
<h2 class="maintitles">
About ${app} ${version}
</h2>
<h5 class="maintitles">${releaseDate}</h5>
<h5 class="maintitles">
<a href="#GENERAL">GENERAL</a>/
<a href="#DISCLAIMER">DISCLAIMER</a>/
<a href="#COPYRIGHTS">COPYRIGHTS</a>/
<a href="#LICENSE">LICENSE</a>/
</h5>
<h3>
<a name="GENERAL">GENERAL</a>
</h3>
<p>
The AR System Log Analyzer analyzes AR Server SQL, API, and Escalation Logs.
The output provides a breakdown of execution times for each API call,
SQL statement, and Escalation, and, for API/SQL logs, a breakdown of Queue time and busy % thread.
It also produces a number of statistical groupings.
Collectively, this output is used to pinpoint performance trouble spots
and to help guide AR System Administrators generally in their efforts
to do performance tuning.
</p>
<h3>
<a name="DISCLAIMER">DISCLAIMER</a>
</h3>
<p>
The ${app} ${version}, is an unsupported utility
provided by BMC Software, Inc.
That is, it is not a saleable product of BMC Software, Inc. and, as such,
comes with no specific guarantees concerning the operation of the utility
or the accuracy of its output.
Any support contract you may have with BMC Software, Inc.
does not include support of this utility.
</p>
<h3>
<a name="COPYRIGHTS">COPYRIGHTS</a>
</h3>
<h4>
General
</h4>
<p>
Copyright 2002-2020, BMC Software Inc.
</p><p>

<h4>Other package contents</h4>
This product uses a few open-source libraries<p>
Freemarker - https://freemarker.apache.org/ - Used for Web Templating to convert the generated output into HTML Pages<p>
JSQLParser - https://github.com/JSQLParser/JSqlParser - Used to help with parsing of SQL statements<p>
FileBasedCollection & Snappy-Java - https://github.com/reinoutkorbee/FileBasedCollection & https://github.com/xerial/snappy-java - Utilized when the memory allocated to Java isn't enough to process everything in memory and it needs to swap some things to disk<p>
<p>
As always:
<pre>
THIS PACKAGE IS PROVIDED "AS IS" AND WITHOUT ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, WITHOUT LIMITATION, THE IMPLIED
WARRANTIES OF MERCHANTIBILITY AND FITNESS FOR A PARTICULAR PURPOSE.
</pre>
</p>
</p>
</body>
</html>
