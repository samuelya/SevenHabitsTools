using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using OpenTelemetry.Trace;
using SevenHabits.Api.Options;
using SevenHabits.Api.Tests.Infrastructure;

namespace SevenHabits.Api.Tests;

public sealed class ConfigurationTests
{
    [Fact]
    public async Task Options_are_bound_from_configuration()
    {
        // Configuration keys behind the environment variables set in infra/modules/containerApp.bicep
        // (OAuth__Microsoft__ClientId etc.); the environment variable provider maps "__" to ":".
        await using var factory = new ApiFactory(new Dictionary<string, string?>
        {
            ["OAuth:Microsoft:ClientId"] = "ms-client",
            ["OAuth:Google:ClientId"] = "google-client",
            ["App:PublicBaseUrl"] = "https://sht.example.com",
            ["App:Version"] = "abc123",
            ["ReverseProxy:UiUpstream"] = "http://localhost:9999",
        });

        var services = factory.Services;
        var oauth = services.GetRequiredService<IOptions<OAuthOptions>>().Value;
        var app = services.GetRequiredService<IOptions<AppOptions>>().Value;
        var proxy = services.GetRequiredService<IOptions<ReverseProxyOptions>>().Value;

        Assert.Equal("ms-client", oauth.Microsoft.ClientId);
        Assert.Equal("google-client", oauth.Google.ClientId);
        Assert.Equal("https://sht.example.com", app.PublicBaseUrl);
        Assert.Equal("abc123", app.Version);
        Assert.Equal("http://localhost:9999", proxy.UiUpstream);
    }

    [Fact]
    public async Task Ui_upstream_defaults_to_localhost_8081()
    {
        await using var factory = new ApiFactory();

        var proxy = factory.Services.GetRequiredService<IOptions<ReverseProxyOptions>>().Value;

        Assert.Equal("http://localhost:8081", proxy.UiUpstream);
    }

    [Theory]
    [InlineData("ReverseProxy:UiUpstream", "not a url")]
    [InlineData("ReverseProxy:UiUpstream", "ftp://localhost:8081")]
    [InlineData("App:PublicBaseUrl", "/relative")]
    public async Task Invalid_urls_fail_at_startup(string key, string value)
    {
        await using var factory = new ApiFactory(new Dictionary<string, string?> { [key] = value });

        var error = Assert.Throws<OptionsValidationException>(() => factory.Services);

        Assert.Contains(key, error.Message);
    }

    [Fact]
    public async Task App_insights_is_disabled_without_connection_string()
    {
        await using var factory = new ApiFactory();

        Assert.Null(factory.Services.GetService<TracerProvider>());
    }

    [Fact]
    public async Task App_insights_is_enabled_with_connection_string()
    {
        await using var factory = new ApiFactory(new Dictionary<string, string?>
        {
            ["APPLICATIONINSIGHTS_CONNECTION_STRING"] =
                "InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=http://127.0.0.1:9/",
        });

        Assert.NotNull(factory.Services.GetService<TracerProvider>());
    }
}
