<HTML>
<HEAD>
  <TITLE>Escalation Error Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="escdetails">
<H3>ESC CALLS THAT ERRORED OUT</H3>
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
  <TH>Escalation Name</TH>
  <TH>Form</TH>
  <TH>Start Time</TH>
</TR>
<#list ESCETopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.lineNumber?c}</a><#else>${Top.lineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID}</TD>
</#if>
  <TD>${Top.escName!''}</TD>
  <TD>${Top.form!''}</TD>
  <TD>${Top.dateTime}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
