<HTML>
<HEAD>
  <TITLE>GENERAL STATISTICS &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="genstats">
<H3>GENERAL STATISTICS</H3>
<!-- <DIV ID="SrcollDiv1" CLASS="FixedDiv"> -->

<TABLE>
<TR>
  <TH>Statistic</TH>
  <TH CLASS="numeric">Value</TH>
</TR>
<TR>
<TR><TD>Start Time</TD><TD CLASS="numeric">${GeneralStatistics.startTime!''}</TD></TR>
<TR><TD>End Time</TD><TD CLASS="numeric">${GeneralStatistics.endTime!''}</TD></TR>
<TR><TD>Elapsed Time</TD><TD CLASS="numeric">${GeneralStatistics.elapsedTime}</TD></TR>
<TR><TD>Total Lines</TD><TD CLASS="numeric">${GeneralStatistics.totalLines}</TD></TR>
<TR><TD>API Count</TD><TD CLASS="numeric">${GeneralStatistics.apiCount}</TD></TR>
<TR><TD>SQL Count</TD><TD CLASS="numeric">${GeneralStatistics.sqlCount}</TD></TR>
<TR><TD>ESC Count</TD><TD CLASS="numeric">${GeneralStatistics.escCount}</TD></TR>
<TR><TD>Form Count</TD><TD CLASS="numeric">${GeneralStatistics.formCount}</TD></TR>
<TR><TD>Table Count</TD><TD CLASS="numeric">${GeneralStatistics.tableCount}</TD></TR>
<TR><TD>User Count</TD><TD CLASS="numeric">${GeneralStatistics.userCount}</TD></TR>
<#list GeneralStatistics.threadCountMap as queue, count> 
<TR><TD>${queue} Thread Count</TD><TD CLASS="numeric">${count}</TD></TR>
</#list>
<TR><TD>Total Thread Count</TD><TD CLASS="numeric">${GeneralStatistics.totalThreadCount}</TD></TR>
<TR><TD>API Exception Count</TD><TD CLASS="numeric">${GeneralStatistics.apiExceptionCount}</TD></TR>
<TR><TD>SQL Exception Count</TD><TD CLASS="numeric">${GeneralStatistics.sqlExceptionCount}</TD></TR>
<TR><TD>ESC Exception Count</TD><TD CLASS="numeric">${GeneralStatistics.escExceptionCount}</TD></TR>
<TR><TD>Processing Time</TD><TD CLASS="numeric">${GeneralStatistics.processingTime}</TD></TR>
</TABLE>

<H4>Logging Activity</H4>
<TABLE>
<TR>
<TH>Type</TH>
<TH>First</TH>
<TH>Last</TH>
<TH>Duration</TH>
</TR>
<#list typeMap?keys as key> 
    <TR>
	<TD>${key}</TD>
	<TD>${typeMap[key].startDateS}</TD>
	<TD>${typeMap[key].endDateS}</TD>
	<TD CLASS="numeric">${typeMap[key].duration}</TD>
	</TR>
</#list>
</TABLE>

<H4>Input filenames</H4>
<TABLE>
<TR>
<TH>Name</TH>
<TH>File#</TH>
<TH>File Start</TH>
<TH>File End</TH>
<TH>Duration</TH>
</TR>
<#list fileMap?keys as key> 
    <TR CLASS="infilename">
	<TD>${fileMap[key].fileName}</TD>
	<TD>${fileMap[key].fileNumber}</TD>
	<TD>${fileMap[key].startDateS}</TD>
	<TD>${fileMap[key].endDateS}</TD>
	<TD CLASS="numeric">${fileMap[key].duration}</TD>
	</TR>
</#list>
</TABLE>
</BODY>
</HTML>
