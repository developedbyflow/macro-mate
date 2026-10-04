using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Security;

public sealed class RateLimitOptions
{
    public int AuthPerMinute { get; set; } = 10;
    public int AiPerTenMinutes { get; set; } = 30;
}

public static class RateLimiting
{
    public const string Auth = "auth";
    public const string Ai = "ai";

    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitOptions>(configuration.GetSection("RateLimits"));
        return services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.OnRejected = async (context, ct) =>
            {
                var minutes = 1;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                    minutes = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes));
                }
                var messages = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<Messages>>();
                await Results.Problem(messages["TooManyRequests", minutes], statusCode: StatusCodes.Status429TooManyRequests).ExecuteAsync(context.HttpContext);
            };

            o.AddPolicy(Auth, http => RateLimitPartition.GetFixedWindowLimiter(
                $"ip:{http.Connection.RemoteIpAddress}",
                _ => Window(Limits(http).AuthPerMinute, TimeSpan.FromMinutes(1))));

            o.AddPolicy(Ai, http => RateLimitPartition.GetFixedWindowLimiter(
                http.User.FindFirstValue(ClaimTypes.NameIdentifier) is { } userId ? $"user:{userId}" : $"ip:{http.Connection.RemoteIpAddress}",
                _ => Window(Limits(http).AiPerTenMinutes, TimeSpan.FromMinutes(10))));
        });
    }

    static RateLimitOptions Limits(HttpContext http) => http.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value;

    static FixedWindowRateLimiterOptions Window(int permits, TimeSpan window) =>
        new() { PermitLimit = permits, Window = window, QueueLimit = 0, AutoReplenishment = true };
}
