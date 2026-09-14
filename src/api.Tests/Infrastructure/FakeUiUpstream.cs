using System.Net.WebSockets;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SevenHabits.Api.Tests.Infrastructure;

/// <summary>
/// A real Kestrel server on a random loopback port standing in for the web (nginx) container.
/// <list type="bullet">
/// <item><c>/ws</c> echoes WebSocket text messages.</item>
/// <item><c>/sse</c> sends one event, then waits for <see cref="ReleaseSse"/> before sending a second.</item>
/// <item>Anything else echoes the request as <c>METHOD path?query|x-test-header</c> and sets a weak CSP to be overwritten.</item>
/// </list>
/// </summary>
public sealed class FakeUiUpstream : IAsyncDisposable
{
    private readonly WebApplication app;
    private readonly TaskCompletionSource sseRelease = new(TaskCreationOptions.RunContinuationsAsynchronously);

    private FakeUiUpstream(WebApplication app) => this.app = app;

    public string Address => app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();

    public static async Task<FakeUiUpstream> StartAsync()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();

        var app = builder.Build();
        var upstream = new FakeUiUpstream(app);

        app.UseWebSockets();
        app.Map("/ws", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            var buffer = new byte[1024];
            var result = await socket.ReceiveAsync(buffer, context.RequestAborted);
            var reply = Encoding.UTF8.GetBytes("echo:" + Encoding.UTF8.GetString(buffer, 0, result.Count));
            await socket.SendAsync(reply, WebSocketMessageType.Text, endOfMessage: true, context.RequestAborted);
            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", context.RequestAborted);
        });
        app.Map("/sse", async context =>
        {
            context.Response.ContentType = "text/event-stream";
            await context.Response.WriteAsync("data: first\n\n", context.RequestAborted);
            await context.Response.Body.FlushAsync(context.RequestAborted);
            await upstream.sseRelease.Task.WaitAsync(context.RequestAborted);
            await context.Response.WriteAsync("data: second\n\n", context.RequestAborted);
        });
        app.Map("/{**path}", async context =>
        {
            context.Response.Headers.ContentSecurityPolicy = "default-src *";
            await context.Response.WriteAsync(
                $"{context.Request.Method} {context.Request.Path}{context.Request.QueryString}|{context.Request.Headers["X-Test-Header"]}");
        });

        await app.StartAsync();
        return upstream;
    }

    public void ReleaseSse() => sseRelease.TrySetResult();

    public async ValueTask DisposeAsync()
    {
        ReleaseSse();
        await app.StopAsync();
        await app.DisposeAsync();
    }
}
