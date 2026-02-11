<HTML>
<HEAD>
  <TITLE>Log Text Thread ${CurrentThread}&mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="../../css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="logdetails">
<TABLE style="margin-left:auto;margin-right:auto;">
<TR>
  <TD class="dumber">
	<H3 class="dumber">
	  TID ${CurrentThread} &mdash; Page ${CurrentThreadPage?c}/${CurrentThreadPages?c}
	</H3>
  </TD>
</TR>
</TABLE>
<TABLE style="margin-left:auto;margin-right:auto;">
<TR>
		<span class="jumpback">
		  <#if CurrentThreadPage gt 1>
			<TD class="tooltip"><a href="${CurrentThread}-1.html"><img src="../../img/first.png" alt="Page 1"></a><span class="tooltiptext">Page 1</span></TD>
  	        <#if CurrentThreadPage gt 5>
			  <TD class="tooltip"><a href="${CurrentThread}-${(CurrentThreadPage-5)?c}.html"><img src="../../img/fr.png" alt="Page ${(CurrentThreadPage-5)?c}"></a><span class="tooltiptext">Page ${(CurrentThreadPage-5)?c}</span></TD>
		    <#else>
			  <TD><img src="../../img/blank.png"</TD>
            </#if>
            <td class="tooltip"><a href="${CurrentThread}-${(CurrentThreadPage-1)?c}.html"><img src="../../img/previous.png" alt="Page ${(CurrentThreadPage-1)?c}"></a><span class="tooltiptext">Page ${(CurrentThreadPage-1)?c}</span></TD>
		  <#else>
			<TD><img src="../../img/blank.png"</TD>
			<TD><img src="../../img/blank.png"</TD>
			<TD><img src="../../img/blank.png"</TD>
		  </#if>
		</span>
		<span class="jumpahead">
		  <#if CurrentThreadPage lt CurrentThreadPages>
			<TD class="tooltip"><a href="${CurrentThread}-${(CurrentThreadPage+1)?c}.html"><img src="../../img/next.png" alt="Page ${(CurrentThreadPage+1)?c}"></a><span class="tooltiptext">Page ${(CurrentThreadPage+1)?c}</span></TD>
		    <#if CurrentThreadPage lt CurrentThreadPages-5>
			  <TD class="tooltip"><a href="${CurrentThread}-${(CurrentThreadPage+5)?c}.html"><img src="../../img/ff.png" alt="Page ${(CurrentThreadPage+5)?c}"></a><span class="tooltiptext">Page ${(CurrentThreadPage+5)?c}</span></TD>
		    <#else>
			  <TD><img src="../../img/blank.png"</TD>
		    </#if>
			<TD class="tooltip"><a href="${CurrentThread}-${CurrentThreadPages?c}.html"><img src="../../img/last.png" alt="Page ${CurrentThreadPages?c}"></a><span class="tooltiptext">Page ${CurrentThreadPages}</span></TD>
		  <#else>
			<TD><img src="../../img/blank.png"</TD>
			<TD><img src="../../img/blank.png"</TD>
			<TD><img src="../../img/blank.png"</TD>
		  </#if>
		</span>
</TR>
</TABLE>
<TABLE style="margin-left:auto;margin-right:auto;">
<TR>
    <TD><span class="dt">${CurrentThreadMin!''}</span> - <span class="dt">${CurrentThreadMax!''}</span></TD>
</TR>
</TABLE>
<DIV ID="SrcollDiv1" CLASS="FixedDiv">
<TABLE>
<TR>
  <TH CLASS="numeric">Line#</TH>
  <TH CLASS="numeric">File#</TH>
  <TH CLASS="logcolumn">Type</TH>
<#if TrID == true>
  <TH CLASS="logcolumn">Trace ID</TH>
</#if>
  <TH CLASS="logcolumn">RPC ID</TH>
  <TH CLASS="logcolumn">Queue</TH>
  <TH CLASS="logcolumn">USER</TH>
  <TH>Timestamp</TH>
  <TH>Detail</TH>
</TR>
<#list CurrentThreadList as ThreadList>
<TR CLASS="${ThreadList.color}">
  <TD CLASS="logcolumn">${ThreadList.lineNumber}</TD>
  <TD CLASS="logcolumn">${ThreadList.fileNumber}</TD>
  <TD CLASS="logcolumn">${ThreadList.type}</TD>
<#if TrID == true>
  <TD CLASS="logcolumn">${ThreadList.trID}</TD>
</#if>
<#setting number_format="computer">
  <TD CLASS="logcolumn" id="${ThreadList.fileNumber}-${ThreadList.lineNumber}">${ThreadList.rpcID!''}</TD>
  <TD CLASS="logcolumn">${ThreadList.queue}</TD>
  <TD CLASS="logcolumn">${ThreadList.user}</TD>
  <TD CLASS="logcolumn">${ThreadList.dateTime!''}</TD>
  <TD CLASS="longtext">${ThreadList.details}</TD>
</TR>
</#list>
</TABLE>
</DIV>
</BODY>
</HTML>
