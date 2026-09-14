@description('Azure region for the managed environment.')
param location string

@description('Environment name used in resource names.')
param environmentName string

@description('Application name used in resource names.')
param appName string

@description('Tags applied to every resource.')
param tags object

@description('Name of the existing Log Analytics workspace in this resource group.')
param logAnalyticsWorkspaceName string

resource workspace 'Microsoft.OperationalInsights/workspaces@2025-07-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: 'cae-${appName}-${environmentName}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

@description('Managed environment resource ID.')
output id string = managedEnvironment.id

@description('Managed environment name.')
output name string = managedEnvironment.name

@description('Managed environment default domain.')
output defaultDomain string = managedEnvironment.properties.defaultDomain
