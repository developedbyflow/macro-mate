using MacroMate.Api.Data;
using MacroMate.Api.Features.Security;
using MacroMate.Api.Features.Sync;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record MeResponse(Guid Id, string Email, string DisplayName);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");
        group.MapPost("/login", Login).RequireRateLimiting(RateLimiting.Auth).Produces<MeResponse>();
        group.MapPost("/logout", Logout).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization().Produces<MeResponse>();
    }

    static async Task<IResult> Login(
        LoginRequest request,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        AppDbContext db,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            return Results.Problem(messages["InvalidCredentials"], statusCode: StatusCodes.Status401Unauthorized);

        var result = await signIn.PasswordSignInAsync(user, request.Password, isPersistent: true, lockoutOnFailure: true);
        if (result.IsLockedOut)
            return Results.Problem(messages["TooManyAttempts"], statusCode: StatusCodes.Status429TooManyRequests);
        if (!result.Succeeded)
            return Results.Problem(messages["InvalidCredentials"], statusCode: StatusCodes.Status401Unauthorized);

        await EnsureProfileAsync(db, user.Id, ct);
        return Results.Ok(new MeResponse(user.Id, user.Email!, user.DisplayName));
    }

    static async Task<IResult> Logout(SignInManager<AppUser> signIn)
    {
        await signIn.SignOutAsync();
        return Results.NoContent();
    }

    static async Task<IResult> Me(CurrentUser me, UserManager<AppUser> users, AppDbContext db, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(me.Id.ToString());
        if (user is null)
            return Results.Unauthorized();

        await EnsureProfileAsync(db, user.Id, ct);
        return Results.Ok(new MeResponse(user.Id, user.Email!, user.DisplayName));
    }

    public static async Task EnsureProfileAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        if (await db.UserProfiles.AnyAsync(p => p.UserId == userId, ct))
            return;

        await SyncWriter.WriteAsync(db, async (version, now) =>
        {
            if (await db.UserProfiles.AnyAsync(p => p.UserId == userId, ct))
                return;
            db.UserProfiles.Add(new UserProfile
            {
                Id = userId,
                UserId = userId,
                CreatedAt = now,
                UpdatedAt = now,
                Version = version,
            });
        }, ct);
    }
}
