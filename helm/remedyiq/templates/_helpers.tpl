{{/*
Expand the name of the chart.
*/}}
{{- define "remedyiq.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "remedyiq.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "remedyiq.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "remedyiq.labels" -}}
helm.sh/chart: {{ include "remedyiq.chart" . }}
{{ include "remedyiq.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "remedyiq.selectorLabels" -}}
app.kubernetes.io/name: {{ include "remedyiq.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API labels
*/}}
{{- define "remedyiq.apiLabels" -}}
{{ include "remedyiq.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
API selector labels
*/}}
{{- define "remedyiq.apiSelectorLabels" -}}
{{ include "remedyiq.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Worker labels
*/}}
{{- define "remedyiq.workerLabels" -}}
{{ include "remedyiq.labels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Worker selector labels
*/}}
{{- define "remedyiq.workerSelectorLabels" -}}
{{ include "remedyiq.selectorLabels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "remedyiq.frontendLabels" -}}
{{ include "remedyiq.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "remedyiq.frontendSelectorLabels" -}}
{{ include "remedyiq.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account to use for API
*/}}
{{- define "remedyiq.apiServiceAccountName" -}}
{{- if .Values.api.serviceAccount.create }}
{{- default (printf "%s-api" (include "remedyiq.fullname" .)) .Values.api.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.api.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use for Worker
*/}}
{{- define "remedyiq.workerServiceAccountName" -}}
{{- if .Values.worker.serviceAccount.create }}
{{- default (printf "%s-worker" (include "remedyiq.fullname" .)) .Values.worker.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.worker.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use for Frontend
*/}}
{{- define "remedyiq.frontendServiceAccountName" -}}
{{- if .Values.frontend.serviceAccount.create }}
{{- default (printf "%s-frontend" (include "remedyiq.fullname" .)) .Values.frontend.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.frontend.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the proper API image name
*/}}
{{- define "remedyiq.apiImage" -}}
{{- printf "%s/remedyiq/api:%s" .Values.image.registry .Values.image.tag -}}
{{- end }}

{{/*
Return the proper Worker image name
*/}}
{{- define "remedyiq.workerImage" -}}
{{- printf "%s/remedyiq/worker:%s" .Values.image.registry .Values.image.tag -}}
{{- end }}

{{/*
Return the proper Frontend image name
*/}}
{{- define "remedyiq.frontendImage" -}}
{{- printf "%s/remedyiq/frontend:%s" .Values.image.registry .Values.image.tag -}}
{{- end }}
