using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.HttpLogging;
using SevenHabits.Api.Endpoints;
using SevenHabits.Api.Middleware;
using SevenHabits.Api.Options;
using SevenHabits.Api.ReverseProxy;
using Yarp.ReverseProxy.Configuration;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(kestrel => kestrel.AddServerHeader = false);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(json =>
{
    json.UseUtcTimestamp = true;
    json.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});

// Request logging: method, path, status, headers (redacted unless allow-listed) and duration. Never bodies or query strings.
builder.Services.AddHttpLogging(logging =>
{
    logging.LoggingFields = HttpLoggingFields.RequestPropertiesAndHeaders
        | HttpLoggingFields.ResponsePropertiesAndHeaders
        | HttpLoggingFields.Duration;
    logging.CombineLogs = true;
});

if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    // Reads APPLICATIONINSIGHTS_CONNECTION_STRING itself; exports requests, dependencies, logs and metrics.
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
}

builder.Services.AddOptions<AppOptions>()
    .Bind(builder.Configuration.GetSection(AppOptions.SectionName))
    .Validate(o => string.IsNullOrEmpty(o.PublicBaseUrl) || IsHttpUri(o.PublicBaseUrl), "App:PublicBaseUrl must be an absolute http(s) URL.")
    .Validate(o => !string.IsNullOrWhiteSpace(o.Version), "App:Version must not be empty.")
    .ValidateOnStart();

builder.Services.AddOptions<OAuthOptions>()
    .Bind(builder.Configuration.GetSection(OAuthOptions.SectionName));

builder.Services.AddOptions<ReverseProxyOptions>()
    .Bind(builder.Configuration.GetSection(ReverseProxyOptions.SectionName))
    .Validate(o => IsHttpUri(o.UiUpstream), "ReverseProxy:UiUpstream must be an absolute http(s) URL.")
    .ValidateOnStart();

builder.Services.AddSingleton<IProxyConfigProvider, UiProxyConfigProvider>();
builder.Services.AddReverseProxy();

var app = builder.Build();

app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseHttpLogging();

app.MapHealthEndpoints();
app.MapApiEndpoints();
app.MapReverseProxy();

app.Run();

static bool IsHttpUri(string? value) =>
    Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
