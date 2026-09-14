using System.Net;
using System.Net.Http.Json;
using SevenHabits.Api.Endpoints;
using SevenHabits.Api.Tests.Infrastructure;

namespace SevenHabits.Api.Tests;

public sealed class EndpointTests
{
    [Fact]
    public async Task Healthz_returns_ok_status_json()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/healthz", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("""{"status":"ok"}""", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Version_returns_value_from_App__Version()
    {
        await using var factory = new ApiFactory(new Dictionary<string, string?> { ["App:Version"] = "0123abc" });
        using var client = factory.CreateClient();

        var body = await client.GetFromJsonAsync<VersionResponse>("/api/version", TestContext.Current.CancellationToken);

        Assert.Equal("0123abc", body?.Version);
    }

    [Fact]
    public async Task Version_defaults_to_dev()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();

        var body = await client.GetFromJsonAsync<VersionResponse>("/api/version", TestContext.Current.CancellationToken);

        Assert.Equal("dev", body?.Version);
    }

    [Theory]
    [InlineData("/api")]
    [InlineData("/api/does-not-exist")]
    [InlineData("/api/nested/path?x=1")]
    public async Task Unknown_api_paths_return_404_and_are_not_proxied(string path)
    {
        // The upstream is unreachable: a proxied request would be 502, not 404.
        await using var factory = new ApiFactory(new Dictionary<string, string?> { ["ReverseProxy:UiUpstream"] = "http://127.0.0.1:9" });
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
