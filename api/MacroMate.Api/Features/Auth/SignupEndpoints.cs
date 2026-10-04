using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Cryptography;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Email;
using MacroMate.Api.Features.Kitchens;
using MacroMate.Api.Features.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Auth;

public sealed record SignupRequest(string Email, string DisplayName, string Password);

public sealed record ConfirmAccountRequest(Guid UserId, string Token);

public sealed record ResendConfirmationRequest(string Email);

public sealed record DeleteAccountRequest(string? Password);

public static class SignupEndpoints
{
    public static readonly TimeSpan DemoLifetime = TimeSpan.FromHours(24);

    public static void MapSignupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");
        group.MapPost("/register", Register).RequireRateLimiting(RateLimiting.Auth);
        group.MapPost("/confirm-account", ConfirmAccount).RequireRateLimiting(RateLimiting.Auth).Produces<MeResponse>();
        group.MapPost("/resend-confirmation", ResendConfirmation).RequireRateLimiting(RateLimiting.Auth);
        group.MapPost("/demo", StartDemo).RequireRateLimiting(RateLimiting.Auth).Produces<MeResponse>();
        group.MapPost("/me/delete", DeleteAccount).RequireAuthorization().RequireRateLimiting(RateLimiting.Auth);
    }

    static async Task<IResult> Register(
        SignupRequest request,
        HttpContext http,
        UserManager<AppUser> users,
        AppDbContext db,
        IEmailSender email,
        IOptions<EmailOptions> options,
        IHostEnvironment env,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var address = request.Email.Trim();
        var name = request.DisplayName.Trim();
        if (name.Length is < 1 or > 60)
            return Results.Problem(messages["DisplayNameInvalid"], statusCode: StatusCodes.Status400BadRequest);
        if (!new EmailAddressAttribute().IsValid(address))
            return Results.Problem(messages["InvalidEmail"], statusCode: StatusCodes.Status400BadRequest);
        if (AccountEndpoints.Link(http, options, env, "confirm-account") is null)
            return Results.Problem(messages["EmailUnavailable"], statusCode: StatusCodes.Status503ServiceUnavailable);
        if (await users.FindByEmailAsync(address) is not null)
            return Results.Problem(messages["DuplicateEmail"], statusCode: StatusCodes.Status409Conflict);

        var (user, errors) = await KitchenService.CreateUserAsync(users, db, address, name, request.Password, null, false, ct);
        if (user is null)
            return Results.Problem(string.Join(" ", errors), statusCode: StatusCodes.Status400BadRequest);

        await SendConfirmationAsync(http, users, user, email, options, env, messages, ct);
        return Results.Accepted();
    }

    static async Task SendConfirmationAsync(
        HttpContext http,
        UserManager<AppUser> users,
        AppUser user,
        IEmailSender email,
        IOptions<EmailOptions> options,
        IHostEnvironment env,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var token = AccountEndpoints.Encode(await users.GenerateEmailConfirmationTokenAsync(user));
        var link = AccountEndpoints.Link(http, options, env, "confirm-account", ("userId", user.Id.ToString()), ("token", token));
        if (link is not null)
            await email.SendAsync(new EmailMessage(user.Email!, messages["ConfirmAccountSubject"], messages["ConfirmAccountText", user.DisplayName, link]), ct);
    }

    static async Task<IResult> ConfirmAccount(
        ConfirmAccountRequest request,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        AppDbContext db,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        var token = AccountEndpoints.Decode(request.Token);
        if (user is null || token is null)
            return Results.Problem(messages["InvalidLink"], statusCode: StatusCodes.Status400BadRequest);

        var result = await users.ConfirmEmailAsync(user, token);
        if (!result.Succeeded)
            return AccountEndpoints.Problem(result);

        await signIn.SignInAsync(user, isPersistent: true);
        await AuthEndpoints.EnsureProfileAsync(db, user.Id, ct);
        return Results.Ok(await AuthEndpoints.MeAsync(users, user));
    }

    static async Task<IResult> ResendConfirmation(
        ResendConfirmationRequest request,
        HttpContext http,
        UserManager<AppUser> users,
        IEmailSender email,
        IOptions<EmailOptions> options,
        IHostEnvironment env,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is { EmailConfirmed: false })
            await SendConfirmationAsync(http, users, user, email, options, env, messages, ct);
        return Results.NoContent();
    }

    static async Task<IResult> StartDemo(
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        AppDbContext db,
        IOptions<RateLimitOptions> limits,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        if (await db.Users.CountAsync(u => u.IsDemo, ct) >= limits.Value.DemoMaxActive)
            return Results.Problem(messages["DemoUnavailable"], statusCode: StatusCodes.Status503ServiceUnavailable);

        var expiresAt = DateTimeOffset.UtcNow + DemoLifetime;
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        var address = $"demo-{Guid.NewGuid():N}@demo.invalid";
        var (user, errors) = await KitchenService.CreateUserAsync(users, db, address, messages["DemoName"], password, null, true, ct, u =>
        {
            u.IsDemo = true;
            u.DemoExpiresAt = expiresAt;
        });
        if (user is null)
            return Results.Problem(string.Join(" ", errors), statusCode: StatusCodes.Status500InternalServerError);

        await DemoData.SeedAsync(db, user, CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en", ct);
        await signIn.SignInAsync(user, isPersistent: false);
        return Results.Ok(await AuthEndpoints.MeAsync(users, user));
    }

    static async Task<IResult> DeleteAccount(
        DeleteAccountRequest request,
        CurrentUser me,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        AppDbContext db,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var user = await users.FindByIdAsync(me.Id.ToString());
        if (user is null)
            return Results.Unauthorized();
        if (!user.IsDemo && !await users.CheckPasswordAsync(user, request.Password ?? ""))
            return Results.Problem(messages["WrongCurrentPassword"], statusCode: StatusCodes.Status400BadRequest);
        if (await AccountService.IsLastAdminAsync(db, user.Id, ct))
            return Results.Problem(messages["LastAdmin"], statusCode: StatusCodes.Status409Conflict);

        await AccountService.DeleteAsync(db, users, user, ct);
        await signIn.SignOutAsync();
        return Results.NoContent();
    }
}
