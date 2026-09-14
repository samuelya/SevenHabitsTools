using SevenHabits.Api.Middleware;
using SevenHabits.Api.Tests.Infrastructure;

namespace SevenHabits.Api.Tests;

/// <summary>
/// Covers the "Api (full stack)" launch profile: the API proxies to `ng serve` on 4200 through YARP, and the
/// Angular dev server's live-reload client can open a WebSocket directly to that origin. This relaxation must
/// never leak outside Development.
/// </summary>
public sealed class DevelopmentSecurityHeadersTests
{
    [Fact]
    public async Task Development_csp_allows_the_angular_dev_server_websocket_for_live_reload()
    {
        await using var factory = new ApiFactory(environment: "Development");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/healthz", TestContext.Current.CancellationToken);

        var csp = Assert.Single(response.Headers.GetValues("Content-Security-Policy"));
        Assert.Equal(
            "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; " +
            "connect-src 'self' http://localhost:4200 ws://localhost:4200; frame-ancestors 'none'",
            csp);
    }

    [Fact]
    public async Task Development_leaves_the_other_security_headers_unchanged()
    {
        await using var factory = new ApiFactory(environment: "Development");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/healthz", TestContext.Current.CancellationToken);

        foreach (var (name, value) in SecurityHeadersMiddleware.Headers)
        {
            if (name == "Content-Security-Policy")
            {
                continue;
            }

            Assert.Equal([value], response.Headers.GetValues(name));
        }
    }

    [Theory]
    [MemberData(nameof(SecurityHeadersTests.ExpectedHeaders), MemberType = typeof(SecurityHeadersTests))]
    public async Task Production_headers_are_unaffected_by_the_development_relaxation(string name, string value)
    {
        await using var factory = new ApiFactory(environment: "Production");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/healthz", TestContext.Current.CancellationToken);

        Assert.Equal([value], response.Headers.GetValues(name));
    }
}
