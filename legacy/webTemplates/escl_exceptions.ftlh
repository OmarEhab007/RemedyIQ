<HTML>
<HEAD>
  <TITLE>ESCALATION EXCEPTION REPORT &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="escldetails">
<H3>ESCALATION EXCEPTION REPORT</H3>
<P><I>Total Number of Escalation Exceptions: </I>${ESCLException?size}
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Line#</TH>
<#if multipleFiles == true>
  <TH CLASS="numeric">File #</TH>
</#if>
<#if TrID == true>
  <TH>Trace ID</TH>
<#else>
  <TH>RPC ID</TH>
</#if>
  <TH>Escalation</TH>
  <TH>Message</TH>
</TR>
<#list ESCLException as Ex> 
<TR CLASS="ESCL">
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Ex.name}">${Ex.lineNumber?c}</a><#else>${Ex.lineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Ex.fileNumber}</TD>
</#if>
  <TD>${Ex.trace}</TD>
  <TD>${Ex.escName!''}</TD>
  <TD>${Ex.failMessage}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
