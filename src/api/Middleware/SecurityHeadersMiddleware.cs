namespace SevenHabits.Api.Middleware;

/// <summary>
/// Adds the security headers to every response, including responses proxied from the UI.
/// Headers are written in <see cref="HttpResponse.OnStarting(Func{Task})"/> so they overwrite
/// anything copied from the upstream response.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    public static readonly IReadOnlyDictionary<string, string> Headers = new Dictionary<string, string>
    {
        // Browsers ignore HSTS over plain HTTP, so it is safe to send on every response;
        // TLS terminates at the Container Apps ingress and the container only sees HTTP.
        ["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains",
        ["Content-Security-Policy"] =
            "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
        ["X-Content-Type-Options"] = "nosniff",
        ["Referrer-Policy"] = "strict-origin-when-cross-origin",
        ["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()",
        ["X-Frame-Options"] = "DENY",
    };

    // Development only: the "Api (full stack)" launch profile proxies to `ng serve` on 4200 through YARP, and
    // the Angular dev server's live-reload client can open a WebSocket directly to that origin. Never applied
    // outside Development, so production and Testing responses keep the exact policy above.
    private const string DevelopmentConnectSrcAdditions = "http://localhost:4200 ws://localhost:4200";

    public Task InvokeAsync(HttpContext context)
    {
        var isDevelopment = environment.IsDevelopment();

        context.Response.OnStarting(static state =>
        {
            var (response, isDevelopment) = ((HttpResponse Response, bool IsDevelopment))state;
            var headers = response.Headers;
            foreach (var (name, value) in Headers)
            {
                headers[name] = isDevelopment && name == "Content-Security-Policy"
                    ? RelaxForDevelopment(value)
                    : value;
            }

            return Task.CompletedTask;
        }, (context.Response, isDevelopment));

        return next(context);
    }

    private static string RelaxForDevelopment(string contentSecurityPolicy) =>
        contentSecurityPolicy.Replace("connect-src 'self'", $"connect-src 'self' {DevelopmentConnectSrcAdditions}");
}
