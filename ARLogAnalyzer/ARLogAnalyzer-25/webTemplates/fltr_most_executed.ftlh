<HTML>
<HEAD>
  <TITLE>Top ${topNumber} Most Executed Filters &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>${topNumber} MOST EXECUTED FILTERS CALLS</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Filter</TH>
  <TH CLASS="numeric">Pass Count</TH>
  <TH CLASS="numeric">Fail Count</TH>
</TR>
<#list FLTRExTopN as Top> 
<TR CLASS="Filter">
  <TD CLASS="numeric">${Top.filterName}</TD>
  <TD CLASS="numeric">${Top.passedActionCount}</TD>
  <TD CLASS="numeric">${Top.failedActionCount}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
