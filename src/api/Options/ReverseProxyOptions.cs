namespace SevenHabits.Api.Options;

/// <summary>Bound from the <c>ReverseProxy</c> section (<c>ReverseProxy__UiUpstream</c>).</summary>
public sealed class ReverseProxyOptions
{
    public const string SectionName = "ReverseProxy";

    /// <summary>Origin of the UI container every non-API request is forwarded to.</summary>
    public string UiUpstream { get; set; } = "http://localhost:8081";
}
