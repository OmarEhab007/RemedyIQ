<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Filter Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} LONGEST RUNNING INDIVIDUAL FILTER CALLS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Run<br>Time</TH>
  <TH CLASS="numeric">First Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
  <TH CLASS="numeric">Last Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Queue</TH>
  <TH>Filter</TH>
  <TH>Start Time</TH>
</TR>
<#list FLTRTopN as Top> 
<TR CLASS="Filter">
  <TD CLASS="numeric">${Top.duration}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.startLineNumber?c}</a><#else>${Top.startLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.endName}">${Top.endLineNumber?c}</a><#else>${Top.endLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.endFileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID}</TD>
</#if>
  <TD>${Top.queue}</TD>
  <TD>${Top.filterName}</TD>
  <TD>${Top.dateTime}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
