@description('Azure region for the Key Vault.')
param location string

@description('Tags applied to every resource.')
param tags object

@description('Principal ID of the managed identity that reads secrets.')
param identityPrincipalId string

// kv-sht- (7) + uniqueString (13) = 20 chars, within the 24-char limit.
var keyVaultName = 'kv-sht-${uniqueString(resourceGroup().id)}'

// Built-in role: Key Vault Secrets User.
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource keyVault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

@description('Key Vault name.')
output name string = keyVault.name

@description('Key Vault URI (ends with a slash).')
output uri string = keyVault.properties.vaultUri
