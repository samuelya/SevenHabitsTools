namespace SevenHabits.Api.Options;

/// <summary>Bound from the <c>OAuth</c> section (<c>OAuth__Microsoft__ClientId</c>, <c>OAuth__Google__ClientId</c>).</summary>
public sealed class OAuthOptions
{
    public const string SectionName = "OAuth";

    public OAuthProviderOptions Microsoft { get; set; } = new();

    public OAuthProviderOptions Google { get; set; } = new();
}

public sealed class OAuthProviderOptions
{
    /// <summary>Public client ID. Empty until the Cloud Sync prerequisites are configured.</summary>
    public string? ClientId { get; set; }
}
