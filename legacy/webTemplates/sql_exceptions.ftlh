<HTML>
<HEAD>
  <TITLE>SQL EXCEPTION REPORT &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="sqldetails">
<H3>SQL EXCEPTION REPORT</H3>
<P><I>Total Number of SQL Exceptions: </I>${SQLException?size}
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
  <TH>Message</TH>
  <TH>SQL Statement</TH>
</TR>
<#list SQLException as Ex> 
<TR CLASS="SQL">
  <TD>${Ex.parentFolder}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="${Ex.name}">${Ex.lineNumber?c}</a><#else>${Ex.lineNumber?c}</#if></TD>
<#if multipleFiles == true>
  <TD CLASS="numeric">${Ex.fileNumber}</TD>
</#if>
  <TD>${Ex.trace}</TD>
  <TD>${Ex.failMessage}</TD>
  <TD CLASS="longtext">${Ex.details}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
