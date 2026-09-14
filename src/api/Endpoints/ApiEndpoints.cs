using Microsoft.Extensions.Options;
using SevenHabits.Api.Options;

namespace SevenHabits.Api.Endpoints;

public static class ApiEndpoints
{
    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/version", (IOptions<AppOptions> options) => Results.Ok(new VersionResponse(options.Value.Version)))
            .WithName("Version");

        // Unknown /api paths are a 404 from the API, never forwarded to the UI.
        api.Map("/{**path}", () => Results.NotFound());

        return app;
    }
}

public sealed record VersionResponse(string Version);
