@description('Azure region for the Container App.')
param location string

@description('Environment name used in resource names.')
param environmentName string

@description('Application name used in resource names.')
param appName string

@description('Resource ID of the Container Apps managed environment.')
param managedEnvironmentId string

@description('Default domain of the Container Apps managed environment.')
param managedEnvironmentDefaultDomain string

@description('Resource ID of the user-assigned managed identity.')
param identityId string

@secure()
@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Key Vault URI (ends with a slash).')
param keyVaultUri string

@description('Image for the api container.')
param apiImage string

@description('Image for the web container.')
param webImage string

@description('HTTP path used by the api liveness and readiness probes.')
param apiProbePath string

@description('Microsoft (Entra ID) OAuth client ID.')
param msOAuthClientId string

@description('Google OAuth client ID.')
param googleOAuthClientId string

@description('True once the OAuth and cookie secrets exist in Key Vault.')
param oauthSecretsConfigured bool

var containerAppName = 'ca-${appName}-${environmentName}'

// Key Vault secret name -> Container App secret name (identical) and api env var.
var keyVaultSecrets = [
  {
    name: 'ms-oauth-client-secret'
    envName: 'OAuth__Microsoft__ClientSecret'
  }
  {
    name: 'google-oauth-client-secret'
    envName: 'OAuth__Google__ClientSecret'
  }
  {
    name: 'cookie-encryption-key'
    envName: 'Cookie__EncryptionKey'
  }
]

var secrets = oauthSecretsConfigured
  ? map(keyVaultSecrets, s => {
      name: s.name
      keyVaultUrl: '${keyVaultUri}secrets/${s.name}'
      identity: identityId
    })
  : []

var secretEnv = oauthSecretsConfigured
  ? map(keyVaultSecrets, s => {
      name: s.envName
      secretRef: s.name
    })
  : []

var apiEnv = [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
  {
    name: 'ReverseProxy__UiUpstream'
    value: 'http://localhost:8081'
  }
  {
    name: 'OAuth__Microsoft__ClientId'
    value: msOAuthClientId
  }
  {
    name: 'OAuth__Google__ClientId'
    value: googleOAuthClientId
  }
  {
    name: 'App__PublicBaseUrl'
    value: 'https://${containerAppName}.${managedEnvironmentDefaultDomain}'
  }
  {
    name: 'ASPNETCORE_HTTP_PORTS'
    value: '8080'
  }
]

resource containerApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: managedEnvironmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: concat(apiEnv, secretEnv)
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: apiProbePath
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: apiProbePath
                port: 8080
              }
              initialDelaySeconds: 3
              periodSeconds: 10
            }
          ]
        }
        {
          name: 'web'
          image: webImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

@description('Container App name.')
output name string = containerApp.name

@description('Container App ingress FQDN.')
output fqdn string = containerApp.properties.configuration.ingress.fqdn
