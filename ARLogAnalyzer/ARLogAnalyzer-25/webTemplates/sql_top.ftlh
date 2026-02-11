<HTML>
<HEAD>
  <TITLE>Top ${topNumber} SQL Statements &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="sqldetails">
<H3>${topNumber} LONGEST RUNNING INDIVIDUAL SQL STATEMENTS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Run<br>Time</TH>
  <TH CLASS="numeric">Folder</TH>
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
  <TH>Table</TH>
  <TH>Start Time</TH>
  <TH>Success</TH>
  <TH>SQL</TH>
</TR>
<#list SQLTopN as Top> 
<TR CLASS="SQL">
  <TD CLASS="numeric">${Top.duration}</TD>
  <TD CLASS="numeric">${Top.parentFolder}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.webLineNumber?c}</a><#else>${Top.webLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID}</TD>
</#if>
  <TD>${Top.queue!''}</TD>
  <TD CLASS="longtext">${Top.sqlTableS!''}</TD>
  <TD>${Top.dateTime!''}</TD>
  <TD>${Top.success?c}</TD>
  <TD CLASS="longtext">${Top.details}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
