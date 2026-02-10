<HTML>
<HEAD>
  <TITLE>${CurrentType} STATISTICS BY THREAD ID &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="${CurrentType}details">
<H3>${CurrentType} STATISTICS BY THREAD ID</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH>Queue</TH>
  <TH>Folder</TH>
  <TH>Thread</TH>
  <TH>Fist Thread Time</TH>
  <TH>Last Thread Time</TH>
  <TH CLASS="numeric">Count</TH>
  <#if CurrentType == "API">
  <TH CLASS="numeric">Q Count</TH>
  <TH CLASS="numeric">Q Time</TH>
  </#if>
  <TH CLASS="numeric">Total Time</TH>
  <TH CLASS="numeric">Busy %</TH>
</TR>
<#if CurrentType == "API">
  <#assign Stats = APIThreadStats>
  <#assign ThreadSummary = APIThreadSummary>
<#elseif CurrentType == "SQL">
  <#assign Stats = SQLThreadStats>
  <#assign ThreadSummary = SQLThreadSummary>
</#if>
<#list Stats as Stats>
<TR CLASS="${CurrentType}">
  <TD>${Stats.queue!''}</TD>
  <TD>${Stats.parentFolder}</TD>
  <TD CLASS="numeric"><#if BypassLogLines == false><a href="logtext/${Stats.parentFolder}/${Stats.threadID}-1.html">${Stats.threadID}</a><#else>${Stats.threadID}</#if></TD>
  <TD>${Stats.startTime}</TD>
  <TD>${Stats.endTime}</TD>
  <TD CLASS="numeric">${Stats.totalCount}</TD>
  <#if CurrentType == "API">
  <TD CLASS="numeric">${Stats.qCount!''}</TD>
  <TD CLASS="numeric">${Stats.qTime!''}</TD>
  </#if>
  <TD CLASS="numeric">${Stats.sumTime}</TD>
  <TD CLASS="numeric">${Stats.busyPercent}</TD>
</TR>
</#list>
<TR>
  <TD CLASS="total" colspan="5">Grand Totals</TD>
  <TD CLASS="total">${ThreadSummary.totalCount?c}</TD>
  <#if CurrentType == "API">
  <TD CLASS="total">${ThreadSummary.qCount}</TD>
  <TD CLASS="total">${ThreadSummary.qTime}</TD>
  </#if>
  <TD CLASS="total">${ThreadSummary.sumTime}</TD>
</TR>
</TABLE>
</DIV>
</BODY>
</HTML>
