<HTML>
<HEAD>
  <TITLE>API Abbreviation Legend &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="apidetails">
<H3>API Abbreviation Legend</H3>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH>API</TH>
  <TH>Full Name</TH>
</TR>
<TR CLASS="API">
<#list APILegend?keys as key> 
    <TR CLASS="numeric"><TD>${key}</TD><TD>${APILegend[key]}</TD></TR>
</#list>
</TR>
</TABLE>
</DIV>
</BODY>
</HTML>
