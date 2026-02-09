<HTML>
<HEAD>
  <TITLE>${CurrentType} by ${CurrentGroup} &mdash; ${app} ${version}</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
</HEAD>
<BODY CLASS="${CurrentType}details">
<DIV ID="header">
<H3>${CurrentType} CALL AGGREGATES<br>grouped by ${CurrentGroup}<br>sorted by ${groupDirection} ${sort} execution time</H3>
</DIV>
<DIV ID="SrcollDiv1" CLASS="FixedDiv80">
<TABLE>
<TR>
<#list CurrentHeaders as Header>
  <TH>${Header}</TH>
</#list>
</TR>
<#list CurrentWebRowList as Grouping>
	<#list Grouping as GroupList>
		<TR CLASS="${CurrentType}">
		  <TD>${GroupList.groupValue!''}</TD>
		  <#if CurrentType == "API">
		  <TD class="tooltip">${GroupList.group}<#if GroupList.group?? && APILegend[GroupList.group]??><span class="tooltiptext">${APILegend[GroupList.group]}</span></#if></TD>
		  <#else>
		  <TD>${GroupList.group}</TD>
          </#if>
		  <#if CurrentType != "Escalation">
		  <TD CLASS="numeric">${GroupList.successCount}</TD>
		  <TD CLASS="numeric">${GroupList.failCount!''}</TD>
          </#if>
		  <TD CLASS="numeric">${GroupList.totalCount}</TD>
		  <TD CLASS="numeric">${GroupList.minTime}</TD>
          <TD CLASS="numeric"><#if BypassLogLines == false><a href="${GroupList.minName}">${GroupList.minLine?c}</a><#else>${GroupList.minLine?c}</#if></TD>
		  <#if multipleFiles == true>
		  <TD CLASS="numeric">${GroupList.minFile}</TD>
          </#if>
		  <TD CLASS="numeric">${GroupList.maxTime}</TD>
          <TD CLASS="numeric"><#if BypassLogLines == false><a href="${GroupList.maxName}">${GroupList.maxLine?c}</a><#else>${GroupList.maxLine?c}</#if></TD>
		  <#if multipleFiles == true>
		  <TD CLASS="numeric">${GroupList.maxFile}</TD>
          </#if>
		  <TD CLASS="numeric">${GroupList.avgTime}</TD>
		  <TD CLASS="numeric">${GroupList.sumTime}</TD>
		</TR>
	</#list>
	<TR CLASS="${CurrentType}">
	  <TD CLASS="total" colspan="2"></TD>
	  <#if CurrentType != "Escalation">
	  <TD CLASS="total">${CurrentSummaryList[Grouping?index].successCount}</TD>
	  <TD CLASS="total">${CurrentSummaryList[Grouping?index].failCount!''}</TD>
          </#if>
	  <TD CLASS="total">${CurrentSummaryList[Grouping?index].totalCount}</TD>
	  <#if multipleFiles == true>
	  <TD colspan="7"></TD>
	  <#else>
	  <TD colspan="5"></TD>
	  </#if>
	  <TD CLASS="total">${CurrentSummaryList[Grouping?index].sumTime}</TD>
	</TR>
</#list>
<TR CLASS="${CurrentType}">
  <TD colspan="2" CLASS="total">Grand Totals</TD>
  <#if CurrentType != "Escalation">
  <TD CLASS="total">${CurrentSummary.successCount!''}</TD>
  <TD CLASS="total">${CurrentSummary.failCount!''}</TD>
  </#if>
  <TD CLASS="total">${CurrentSummary.totalCount}</TD>
  <#if multipleFiles == true>
  <TD colspan="7"></TD>
  <#else>
  <TD colspan="5"></TD>
  </#if>
  <TD CLASS="total">${CurrentSummary.sumTime}</TD>
</TR>
</TABLE>
</DIV>
</BODY>
</HTML>
