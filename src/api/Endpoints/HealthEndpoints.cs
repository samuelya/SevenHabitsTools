using Microsoft.AspNetCore.HttpLogging;

namespace SevenHabits.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        // Liveness only: the app has no dependencies to check. Not request-logged to keep probe noise out of the logs.
        app.MapGet("/healthz", () => Results.Ok(new HealthResponse("ok")))
            .WithName("Health")
            .WithHttpLogging(HttpLoggingFields.None);

        return app;
    }
}

public sealed record HealthResponse(string Status);
