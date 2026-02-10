<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Most Executed Filter Per Transaction &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} MOST EXECUTED FILTER PER TRANSACTION</H3>
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
  <TH CLASS="numeric">Filter</TH>
  <TH CLASS="numeric">Pass Count</TH>
  <TH CLASS="numeric">Fail Count</TH>
</TR>
<#list FLTRFNPTTopN as Top> 
<TR CLASS="Filter">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.startLineNumber?c}</a><#else>${Top.startLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
  <TD CLASS="numeric">${Top.trace}</TD>
  <TD CLASS="numeric">${Top.filterName}</TD>
  <TD CLASS="numeric">${Top.passedActionCount}</TD>
  <TD CLASS="numeric">${Top.failedActionCount}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
