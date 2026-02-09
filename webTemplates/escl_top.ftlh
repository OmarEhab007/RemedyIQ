<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Escalation Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} LONGEST RUNNING INDIVIDUAL ESCALATIONS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Run<br>Time</TH>
  <TH CLASS="numeric">Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File#</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Pool/Q</TH>
  <TH>Escalation</TH>
  <TH>Form</TH>
  <TH>Start Time</TH>
  <TH>Error</TH>
</TR>
<#list ESCTopN as Top> 
<TR CLASS="ESCL">
  <TD CLASS="numeric">${Top.duration!''}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Top.name}">${Top.startLineNumber?c}</a><#else>${Top.startLineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Top.fileNumber}</TD>
</#if>
<#if TrID == true>
  <TD>${Top.trID}</TD>
<#else>
  <TD>${Top.rpcID}</TD>
</#if>
  <TD CLASS="numeric">${Top.pool!''}</TD>
  <TD >${Top.escName!''}</TD>
  <TD >${Top.form!''}</TD>
  <TD>${Top.dateTime!''}</TD>
  <TD>${Top.errorEncountered?c}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
