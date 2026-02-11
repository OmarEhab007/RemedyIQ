<HTML>
<HEAD>
  <TITLE>Delayed Escalations &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>DELAYED ESCALATIONS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Escalation</TH>
  <TH>Pool</TH>
  <TH>Form</TH>
  <TH>Scheduled Time</TH>
  <TH>Start Time</TH>
  <TH>Delay</TH>
  <TH>Previous Escalation</TH>
  <TH>Previous Esc End Time</TH>
</TR>
<#list ESCDTopN as Top> 
<TR CLASS="ESCL">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.startLineNumber?c}</a><#else>${Top.startLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID!}</TD>
</#if>
  <TD>${Top.escName}</TD>
  <TD>${Top.pool}</TD>
  <TD>${Top.form}</TD>
  <TD>${Top.escScheduledTimeS}</TD>
  <TD>${Top.startTimeS}</TD>
  <TD>${Top.delayS}</TD>
  <TD>${Top.previousEsc!''}</TD>
  <TD>${Top.prevEscEndTime!''}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
