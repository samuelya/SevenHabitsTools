targetScope = 'subscription'

@description('Azure region for all resources.')
param location string = 'australiaeast'

@description('Environment name used in resource names (e.g. prod).')
param environmentName string = 'prod'

@description('Application name used in resource names.')
param appName string = 'sevenhabitstools'

@description('Tags applied to every resource.')
param tags object = {
  app: appName
  environment: environmentName
  managedBy: 'bicep'
}

var resourceGroupName = 'rg-${appName}-${environmentName}'

resource rg 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    tags: tags
  }
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    tags: tags
  }
}

module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault'
  scope: rg
  params: {
    location: location
    tags: tags
    identityPrincipalId: identity.outputs.principalId
  }
}

module containerAppsEnv 'modules/containerAppsEnv.bicep' = {
  name: 'containerAppsEnv'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    tags: tags
    logAnalyticsWorkspaceName: monitoring.outputs.workspaceName
  }
}

@description('Resource group name.')
output resourceGroupName string = rg.name

@description('Container Apps managed environment name.')
output containerAppsEnvironmentName string = containerAppsEnv.outputs.name

@description('User-assigned managed identity name.')
output identityName string = identity.outputs.name

@description('Key Vault name.')
output keyVaultName string = keyVault.outputs.name
