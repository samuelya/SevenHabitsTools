namespace SevenHabits.Api.Options;

/// <summary>Bound from the <c>App</c> section (<c>App__PublicBaseUrl</c>, <c>App__Version</c>).</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>Public HTTPS origin of the app, e.g. <c>https://ca-sevenhabitstools-prod.example.azurecontainerapps.io</c>.</summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>Commit SHA the image was built from; baked into the image by the Dockerfile.</summary>
    public string Version { get; set; } = "dev";
}
