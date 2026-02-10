<HTML>
<HEAD>
  <TITLE>API EXCEPTION REPORT &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>API EXCEPTION REPORT</H3>
<P><I>Total Number of API Exceptions: </I>${APIException?size}
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH>Folder</TH>
  <TH CLASS="numeric">Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File #</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Type</TH>
  <TH>Message</TH>
</TR>
<#list APIException as Ex> 
<TR CLASS="API">
  <TD>${Ex.parentFolder}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Ex.name}">${Ex.lineNumber?c}</a><#else>${Ex.lineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Ex.fileNumber}</TD>
</#if>
  <TD>${Ex.trace}</TD>
  <TD class="tooltip">${Ex.api}<#if Ex.api?? && APILegend[Ex.api]??><span class="tooltiptext">${APILegend[Ex.api]}</span></#if></TD>
  <TD>${Ex.failMessage!''}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
