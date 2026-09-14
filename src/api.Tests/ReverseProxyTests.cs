using System.Net;
using System.Net.WebSockets;
using System.Text;
using SevenHabits.Api.Tests.Infrastructure;

namespace SevenHabits.Api.Tests;

public sealed class ReverseProxyTests : IAsyncLifetime
{
    private FakeUiUpstream upstream = null!;
    private ApiFactory factory = null!;

    public async ValueTask InitializeAsync()
    {
        upstream = await FakeUiUpstream.StartAsync();
        factory = new ApiFactory(new Dictionary<string, string?> { ["ReverseProxy:UiUpstream"] = upstream.Address });
    }

    public async ValueTask DisposeAsync()
    {
        await factory.DisposeAsync();
        await upstream.DisposeAsync();
    }

    [Theory]
    [InlineData("GET", "/")]
    [InlineData("GET", "/habits/h1?tab=mission&lang=ar")]
    [InlineData("POST", "/some/form")]
    [InlineData("DELETE", "/assets/app.js")]
    [InlineData("GET", "/apiary")]
    public async Task Non_api_paths_are_forwarded_with_method_query_and_headers(string method, string pathAndQuery)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), pathAndQuery);
        request.Headers.Add("X-Test-Header", "kept");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal($"{method} {pathAndQuery}|kept", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Server_sent_events_stream_through_without_buffering()
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/sse");

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, TestContext.Current.CancellationToken);
        await using var stream = await response.Content.ReadAsStreamAsync(TestContext.Current.CancellationToken);
        using var reader = new StreamReader(stream);

        // The upstream holds the second event until released, so reading the first proves it is not buffered.
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("data: first", await reader.ReadLineAsync(timeout.Token));

        upstream.ReleaseSse();
        Assert.Equal(string.Empty, await reader.ReadLineAsync(timeout.Token));
        Assert.Equal("data: second", await reader.ReadLineAsync(timeout.Token));
    }

    [Fact]
    public async Task WebSockets_are_forwarded_over_kestrel()
    {
        await using var kestrelFactory = new ApiFactory(new Dictionary<string, string?> { ["ReverseProxy:UiUpstream"] = upstream.Address });
        kestrelFactory.UseKestrel(0);
        kestrelFactory.StartServer();
        var baseAddress = kestrelFactory.ClientOptions.BaseAddress;

        using var socket = new ClientWebSocket();
        var wsUri = new UriBuilder(baseAddress) { Scheme = "ws", Path = "/ws" }.Uri;
        await socket.ConnectAsync(wsUri, TestContext.Current.CancellationToken);
        await socket.SendAsync(Encoding.UTF8.GetBytes("hello"), WebSocketMessageType.Text, endOfMessage: true, TestContext.Current.CancellationToken);

        var buffer = new byte[1024];
        var result = await socket.ReceiveAsync(buffer, TestContext.Current.CancellationToken);

        Assert.Equal("echo:hello", Encoding.UTF8.GetString(buffer, 0, result.Count));
    }

    [Fact]
    public async Task Kestrel_does_not_send_server_header()
    {
        await using var kestrelFactory = new ApiFactory();
        kestrelFactory.UseKestrel(0);
        kestrelFactory.StartServer();
        using var client = kestrelFactory.CreateClient();

        using var response = await client.GetAsync("/healthz", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Server"));
    }
}
