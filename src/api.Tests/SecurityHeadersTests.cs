using System.Net;
using SevenHabits.Api.Tests.Infrastructure;

namespace SevenHabits.Api.Tests;

public sealed class SecurityHeadersTests
{
    // Spelled out rather than read from the middleware so a change to the policy fails this test.
    public static TheoryData<string, string> ExpectedHeaders => new()
    {
        { "Strict-Transport-Security", "max-age=31536000; includeSubDomains" },
        { "Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'" },
        { "X-Content-Type-Options", "nosniff" },
        { "Referrer-Policy", "strict-origin-when-cross-origin" },
        { "Permissions-Policy", "camera=(), microphone=(), geolocation=()" },
        { "X-Frame-Options", "DENY" },
    };

    [Theory]
    [MemberData(nameof(ExpectedHeaders))]
    public async Task Api_responses_carry_security_header(string name, string value)
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();

        foreach (var path in new[] { "/healthz", "/api/version", "/api/missing" })
        {
            using var response = await client.GetAsync(path, TestContext.Current.CancellationToken);
            AssertHeader(response, name, value);
        }
    }

    [Theory]
    [MemberData(nameof(ExpectedHeaders))]
    public async Task Proxied_responses_carry_security_header_overriding_upstream(string name, string value)
    {
        await using var upstream = await FakeUiUpstream.StartAsync();
        await using var factory = new ApiFactory(new Dictionary<string, string?> { ["ReverseProxy:UiUpstream"] = upstream.Address });
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/index.html", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertHeader(response, name, value);
    }

    [Theory]
    [MemberData(nameof(ExpectedHeaders))]
    public async Task Proxy_error_responses_carry_security_header(string name, string value)
    {
        await using var factory = new ApiFactory(new Dictionary<string, string?> { ["ReverseProxy:UiUpstream"] = "http://127.0.0.1:9" });
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        AssertHeader(response, name, value);
    }

    private static void AssertHeader(HttpResponseMessage response, string name, string value)
    {
        Assert.True(response.Headers.TryGetValues(name, out var values), $"Missing {name} on {response.RequestMessage?.RequestUri}");
        Assert.Equal([value], values);
    }
}
