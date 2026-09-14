targetScope = 'resourceGroup'

@description('Azure region for the Container App.')
param location string = resourceGroup().location

@description('Environment name used in resource names (e.g. prod).')
param environmentName string = 'prod'

@description('Application name used in resource names.')
param appName string = 'sevenhabitstools'

@description('Image for the api container (listens on 8080).')
param apiImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('Image for the web container (nginx serving the UI on 8081).')
param webImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('HTTP path used by the api liveness and readiness probes.')
param apiProbePath string = '/'

@description('Microsoft (Entra ID) OAuth client ID for OneDrive sync. Empty until configured.')
param msOAuthClientId string = ''

@description('Google OAuth client ID for Google Drive sync. Empty until configured.')
param googleOAuthClientId string = ''

@description('True once the OAuth and cookie secrets exist in Key Vault; adds Key Vault secret references.')
param oauthSecretsConfigured bool = false

resource managedEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: 'cae-${appName}-${environmentName}'
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: 'id-${appName}-${environmentName}'
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: 'appi-${appName}-${environmentName}'
}

// Same naming expression as modules/keyVault.bicep.
resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: 'kv-sht-${uniqueString(resourceGroup().id)}'
}

module containerApp 'modules/containerApp.bicep' = {
  name: 'containerApp'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    managedEnvironmentId: managedEnvironment.id
    managedEnvironmentDefaultDomain: managedEnvironment.properties.defaultDomain
    identityId: identity.id
    appInsightsConnectionString: appInsights.properties.ConnectionString
    keyVaultUri: keyVault.properties.vaultUri
    apiImage: apiImage
    webImage: webImage
    apiProbePath: apiProbePath
    msOAuthClientId: msOAuthClientId
    googleOAuthClientId: googleOAuthClientId
    oauthSecretsConfigured: oauthSecretsConfigured
  }
}

@description('Container App ingress FQDN.')
output fqdn string = containerApp.outputs.fqdn

@description('Container App public URL.')
output url string = 'https://${containerApp.outputs.fqdn}'
