<HTML>
<HEAD>
  <TITLE>Table of Contents</TITLE>
  <LINK REL="STYLESHEET" TYPE="text/css" HREF="css/ARLogAnalyzer.css">
  <BASE target="details_frame">
</HEAD>
<BODY CLASS="sidebar">
<DIV ID="navsite">
<ul>
  <li>General</li>
    <ul>
      <li><a href="general_stats.html">General Statistics</a>
      <li><a href="plain_text.html">Plain Text</a>
      <li><a href="ARLogAnalyzer.html">User Guide</a>
      <li><a href="about.html">About</a>
    </ul>
<#if GeneralStatistics.apiCount gt 0>
  <li>API Aggregates</li>
    <ul>
      <li><a href="api_top.html">Top ${topNumber}</a>
      <li><a href="api_top_queued.html">Top ${topNumber} Queued </a>
      <#list APIGroup as groupby> 
	    <li><a href="api_group_by_${groupby}.html">Group by ${groupby}</a>
      </#list>
      <li><a href="api_thread_stats.html">Thread Statistics</a>
      <li><a href="api_legend.html">Legend</a>
	  <#if APIException??>
        <li><a href="api_exceptions.html">Exceptions</a>
      </#if>
	  <#if APIETopN??>
        <li><a href="api_errors.html">Errors</a>
      </#if>
    </ul>
</#if>
<#if GeneralStatistics.sqlCount gt 0>
  <li>SQL Aggregates</li>
    <ul>
      <li><a href="sql_top.html">Top ${topNumber}</a>
      <#list SQLGroup as groupby> 
	    <li><a href="sql_group_by_${groupby}.html">Group by ${groupby}</a>
      </#list>
      <li><a href="sql_thread_stats.html">Thread Statistics</a>
	  <#if SQLException??>
        <li><a href="sql_exceptions.html">Exceptions</a>
      </#if>
	  <#if SQLETopN??>
        <li><a href="sql_errors.html">Errors</a>
      </#if>
    </ul>
</#if>
<#if GeneralStatistics.escCount gt 0>
  <li>Escalation Aggregates</li>
    <ul>
      <li><a href="escl_top.html">Top ${topNumber}</a>
	  <#if ESCDTopN??>
        <li><a href="escl_delayed.html">Delayed</a>
      </#if>
      <#list ESCGroup as groupby> 
	    <li><a href="escl_group_by_${groupby}.html">Group by ${groupby}</a>
      </#list>
	  <#if ESCLException??>
        <li><a href="escl_exceptions.html">Exceptions</a>
      </#if>
	  <#if ESCETopN??>
        <li><a href="escl_errors.html">Errors</a>
      </#if>
    </ul>
</#if>
<#if GeneralStatistics.filterCount gt 0>
  <li>Filter Statistics</li>
    <ul>
      <li><a href="fltr_top.html">Top ${topNumber}</a>
      <li><a href="fltr_most_executed.html">Most Executed</a>
      <li><a href="fltr_most_filters_per_transaction.html">Most Per Transaction</a>
      <li><a href="fltr_most_executed_filter_per_transaction.html">Most Executed Per Transaction</a>
      <li><a href="fltr_most_levels_per_transaction.html">Most Levels Per Transaction</a>
    </ul>
</#if>
  <li>Gap Analysis</li>
    <ul>
      <li><a href="line_gap_top.html">Top ${topNumber} Line Gaps</a></li>
      <li><a href="thread_gap_top.html">Top ${topNumber} Thread Gaps</a></li>
    </ul>
</ul>
</DIV>
</BODY>
</HTML>
