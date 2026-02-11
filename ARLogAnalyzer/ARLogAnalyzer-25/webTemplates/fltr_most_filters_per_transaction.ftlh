<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Filters Per Transaction &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} MOST FILTERS PER TRANSACTION</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">First Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH CLASS="numeric">Filter Count</TH>
  <TH CLASS="numeric">Operation</TH>
  <TH CLASS="numeric">Form</TH>
  <TH CLASS="numeric">Request ID</TH>
  <TH CLASS="numeric">Filters/sec</TH>
</TR>
<#list FLTRFPTTopN as Top> 
<TR CLASS="Filter">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.startLineNumber?c}</a><#else>${Top.startLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
  <TD CLASS="numeric">${Top.trace}</TD>
  <TD CLASS="numeric">${Top.filterCount}</TD>
  <TD CLASS="numeric">${Top.operation}</TD>
  <TD CLASS="numeric">${Top.form}</TD>
  <TD CLASS="numeric">${Top.requestID!''}</TD>
  <TD CLASS="numeric">${Top.fpsS}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
