<HTML>
<HEAD>
  <TITLE>Top ${topNumber} API Calls &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} LONGEST RUNNING INDIVIDUAL API CALLS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Run<br>Time</TH>
  <TH CLASS="numeric">Folder</TH>
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
  <TH>API</TH>
  <TH>Form</TH>
  <TH>Start Time</TH>
  <TH CLASS="numeric">Queued<br>Time</TH>
  <TH>Success</TH>
</TR>
<#list APITopN as Top> 
<TR CLASS="API">
  <TD CLASS="numeric">${Top.duration}</TD>
  <TD CLASS="numeric">${Top.parentFolder}</TD>
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
  <TD class="tooltip">${Top.api}<span class="tooltiptext">${APILegend[Top.api]}</span></TD>
  <TD>${Top.form}</TD>
  <TD>${Top.dateTime}</TD>
  <TD CLASS="numeric">${Top.queueTimeS}</TD>
  <TD>${Top.success?c}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
