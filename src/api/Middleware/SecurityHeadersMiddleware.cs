namespace SevenHabits.Api.Middleware;

/// <summary>
/// Adds the security headers to every response, including responses proxied from the UI.
/// Headers are written in <see cref="HttpResponse.OnStarting(Func{Task})"/> so they overwrite
/// anything copied from the upstream response.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
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

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var headers = ((HttpResponse)state).Headers;
            foreach (var (name, value) in Headers)
            {
                headers[name] = value;
            }

            return Task.CompletedTask;
        }, context.Response);

        return next(context);
    }
}
