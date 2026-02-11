<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Thread Gaps &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} LONGEST THREAD GAPS</H3>
<H5>Thread gaps are places within a thread where there are unexpected gaps.  Times between API Calls, and Duration of SQL calls are removed from this list, as well as Queues such as Admin, where gaps are expected routinely</H5>
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
<#list ThreadGapTopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric">${Top.threadGapS}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.webLineNumber?c}</a><#else>${Top.webLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID!}</TD>
</#if>
  <TD>${Top.queue}</TD>
  <TD>${Top.dateTime!}</TD>
  <TD CLASS="longtext">${Top.details}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
