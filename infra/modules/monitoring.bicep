@description('Azure region for the monitoring resources.')
param location string

@description('Environment name used in resource names.')
param environmentName string

@description('Application name used in resource names.')
param appName string

@description('Tags applied to every resource.')
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-07-01' = {
  name: 'law-${appName}-${environmentName}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${appName}-${environmentName}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
  }
}

@description('Log Analytics workspace resource ID.')
output workspaceId string = workspace.id

@description('Log Analytics workspace name.')
output workspaceName string = workspace.name

@description('Application Insights component name.')
output appInsightsName string = appInsights.name
