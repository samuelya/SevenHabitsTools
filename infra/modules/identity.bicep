@description('Azure region for the managed identity.')
param location string

@description('Environment name used in resource names.')
param environmentName string

@description('Application name used in resource names.')
param appName string

@description('Tags applied to every resource.')
param tags object

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: 'id-${appName}-${environmentName}'
  location: location
  tags: tags
}

@description('Managed identity resource ID.')
output id string = identity.id

@description('Managed identity name.')
output name string = identity.name

@description('Managed identity principal (object) ID.')
output principalId string = identity.properties.principalId

@description('Managed identity client ID.')
output clientId string = identity.properties.clientId
