<HTML>
<HEAD>
  <TITLE>SQL Error Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="sqldetails">
<H3>SQL CALLS THAT ERRORED OUT</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Line #</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File #</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>SQL</TH>
  <TH>Table</TH>
  <TH>User</TH>
  <TH>Start Time</TH>
  <TH>Error Message</TH>
</TR>
<#list SQLETopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.lineNumber}</a><#else>${Top.lineNumber}</#if></TD>
<#if multipleFiles>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID!}</TD>
</#if>
  <TD>${Top.sqlAction!''}</TD>
  <TD>${Top.sqlTableS!''}</TD>
  <TD>${Top.user!''}</TD>
  <TD>${Top.dateTime!''}</TD>
  <TD CLASS="longtext">${Top.failMessage!''}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
