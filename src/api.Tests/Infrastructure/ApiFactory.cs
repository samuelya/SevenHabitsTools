using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SevenHabits.Api.Tests.Infrastructure;

/// <summary>Hosts the API in-memory with configuration overrides, as if they came from environment variables.</summary>
public sealed class ApiFactory(IReadOnlyDictionary<string, string?>? settings = null, string environment = "Testing") : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);

        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
        {
            builder.UseSetting(key, value);
        }
    }
}
