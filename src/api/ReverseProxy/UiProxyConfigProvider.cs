using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using SevenHabits.Api.Options;
using Yarp.ReverseProxy.Configuration;

namespace SevenHabits.Api.ReverseProxy;

/// <summary>
/// Builds the YARP configuration from <see cref="ReverseProxyOptions"/>: one catch-all route to the UI.
/// API endpoints and <c>/healthz</c> win because their templates are more specific and the route order is last.
/// </summary>
public sealed class UiProxyConfigProvider(IOptions<ReverseProxyOptions> options) : IProxyConfigProvider
{
    public const string RouteId = "ui";
    public const string ClusterId = "ui";

    private readonly UiProxyConfig config = new(options.Value.UiUpstream);

    public IProxyConfig GetConfig() => config;

    private sealed class UiProxyConfig(string upstream) : IProxyConfig
    {
        public IReadOnlyList<RouteConfig> Routes { get; } =
        [
            new RouteConfig
            {
                RouteId = RouteId,
                ClusterId = ClusterId,
                Order = int.MaxValue,
                Match = new RouteMatch { Path = "{**catch-all}" },
            },
        ];

        public IReadOnlyList<ClusterConfig> Clusters { get; } =
        [
            new ClusterConfig
            {
                ClusterId = ClusterId,
                Destinations = new Dictionary<string, DestinationConfig>
                {
                    ["web"] = new DestinationConfig { Address = upstream },
                },
            },
        ];

        // The configuration is fixed for the lifetime of the process.
        public IChangeToken ChangeToken { get; } = new CancellationChangeToken(CancellationToken.None);
    }
}
