<HTML>
<HEAD>
  <TITLE>API Error Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>API CALLS THAT ERRORED OUT</H3>
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
  <TH>Queue</TH>
  <TH>API</TH>
  <TH>Form</TH>
  <TH>User</TH>
  <TH>Start Time</TH>
  <TH>Error Message</TH>
</TR>
<#list APIETopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.lineNumber?c}</a><#else>${Top.lineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID!}</TD>
</#if>
  <TD>${Top.queue}</TD>
  <TD class="tooltip">${Top.api}<span class="tooltiptext">${APILegend[Top.api]}</span></TD>
  <TD>${Top.form!''}</TD>
  <TD>${Top.user!''}</TD>
  <TD>${Top.dateTime}</TD>
  <TD CLASS="longtext">${Top.failMessage}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
