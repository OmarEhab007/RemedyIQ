<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Line Gaps &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} LONGEST LINE GAPS</H3>
<H5>Line Gaps are periods of time where there was no log entry made in the logs.  Depending on the activity level of the server while the logs were taken, this may or may not be a problem</H5>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Gap<br>Duration</TH>
  <TH CLASS="numeric">Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Queue</TH>
  <TH>Date/Time</TH>
  <TH>Details</TH>
</TR>
<#list LineGapTopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric">${Top.lineGapS}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.webLineNumber?c}</a><#else>${Top.webLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID}</TD>
</#if>
  <TD>${Top.queue}</TD>
  <TD>${Top.dateTime}!''</TD>
  <TD CLASS="longtext">${Top.details}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
