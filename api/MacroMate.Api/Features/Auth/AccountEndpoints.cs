using System.ComponentModel.DataAnnotations;
using System.Text;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Email;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Auth;

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Email, string Token, string Password);

public sealed record ConfirmEmailRequest(Guid UserId, string Email, string Token);

public sealed record ChangeNameRequest(string DisplayName);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record ChangeEmailRequest(string NewEmail, string CurrentPassword);

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");
        group.MapPost("/forgot-password", ForgotPassword);
        group.MapPost("/reset-password", ResetPassword);
        group.MapPost("/confirm-email", ConfirmEmail).Produces<MeResponse>();
        group.MapPut("/me/name", ChangeName).RequireAuthorization().Produces<MeResponse>();
        group.MapPost("/me/password", ChangePassword).RequireAuthorization();
        group.MapPost("/me/email", ChangeEmail).RequireAuthorization();
    }

    static async Task<IResult> ForgotPassword(
        ForgotPasswordRequest request,
        HttpContext http,
        UserManager<AppUser> users,
        IEmailSender email,
        IOptions<EmailOptions> options,
        IHostEnvironment env,
        IStringLocalizer<Messages> messages,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            return Results.NoContent();

        var token = Encode(await users.GeneratePasswordResetTokenAsync(user));
        var link = Link(http, options, env, "reset-password", ("email", user.Email!), ("token", token));
        if (link is null)
        {
            loggers.CreateLogger("Account").LogError("Email:PublicUrl is not set, so the password reset link was not sent.");
            return Results.NoContent();
        }

        await email.SendAsync(new EmailMessage(user.Email!, messages["ResetPasswordSubject"], messages["ResetPasswordText", user.DisplayName, link]), ct);
        return Results.NoContent();
    }

    static async Task<IResult> ResetPassword(ResetPasswordRequest request, UserManager<AppUser> users, IStringLocalizer<Messages> messages)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        var token = Decode(request.Token);
        if (user is null || token is null)
            return Results.Problem(messages["InvalidLink"], statusCode: StatusCodes.Status400BadRequest);

        var result = await users.ResetPasswordAsync(user, token, request.Password);
        if (!result.Succeeded)
            return Problem(result);

        await users.ResetAccessFailedCountAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
        return Results.NoContent();
    }

    static async Task<IResult> ConfirmEmail(
        ConfirmEmailRequest request,
        HttpContext http,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        IStringLocalizer<Messages> messages)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        var token = Decode(request.Token);
        if (user is null || token is null)
            return Results.Problem(messages["InvalidLink"], statusCode: StatusCodes.Status400BadRequest);

        var email = request.Email.Trim();
        var result = await users.ChangeEmailAsync(user, email, token);
        if (!result.Succeeded)
            return Problem(result);
        await users.SetUserNameAsync(user, email);

        if (users.GetUserId(http.User) == user.Id.ToString())
            await signIn.RefreshSignInAsync(user);
        return Results.Ok(new MeResponse(user.Id, user.Email!, user.DisplayName));
    }

    static async Task<IResult> ChangeName(ChangeNameRequest request, CurrentUser me, UserManager<AppUser> users, IStringLocalizer<Messages> messages)
    {
        var name = request.DisplayName.Trim();
        if (name.Length is 0 or > 60)
            return Results.Problem(messages["DisplayNameInvalid"], statusCode: StatusCodes.Status400BadRequest);

        var user = await users.FindByIdAsync(me.Id.ToString());
        if (user is null)
            return Results.Unauthorized();

        user.DisplayName = name;
        var result = await users.UpdateAsync(user);
        return result.Succeeded ? Results.Ok(new MeResponse(user.Id, user.Email!, user.DisplayName)) : Problem(result);
    }

    static async Task<IResult> ChangePassword(ChangePasswordRequest request, CurrentUser me, UserManager<AppUser> users, SignInManager<AppUser> signIn)
    {
        var user = await users.FindByIdAsync(me.Id.ToString());
        if (user is null)
            return Results.Unauthorized();

        var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return Problem(result);

        await signIn.RefreshSignInAsync(user);
        return Results.NoContent();
    }

    static async Task<IResult> ChangeEmail(
        ChangeEmailRequest request,
        HttpContext http,
        CurrentUser me,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        IEmailSender email,
        IOptions<EmailOptions> options,
        IHostEnvironment env,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var user = await users.FindByIdAsync(me.Id.ToString());
        if (user is null)
            return Results.Unauthorized();

        var check = await signIn.CheckPasswordSignInAsync(user, request.CurrentPassword, lockoutOnFailure: true);
        if (check.IsLockedOut)
            return Results.Problem(messages["TooManyAttempts"], statusCode: StatusCodes.Status429TooManyRequests);
        if (!check.Succeeded)
            return Results.Problem(messages["WrongCurrentPassword"], statusCode: StatusCodes.Status400BadRequest);

        var newEmail = request.NewEmail.Trim();
        if (!new EmailAddressAttribute().IsValid(newEmail))
            return Results.Problem(messages["InvalidEmail"], statusCode: StatusCodes.Status400BadRequest);
        if (string.Equals(newEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            return Results.Problem(messages["SameEmail"], statusCode: StatusCodes.Status400BadRequest);
        if (await users.FindByEmailAsync(newEmail) is not null)
            return Results.Problem(messages["DuplicateEmail"], statusCode: StatusCodes.Status409Conflict);

        var token = Encode(await users.GenerateChangeEmailTokenAsync(user, newEmail));
        var link = Link(http, options, env, "confirm-email", ("userId", user.Id.ToString()), ("email", newEmail), ("token", token));
        if (link is null)
            return Results.Problem(messages["EmailUnavailable"], statusCode: StatusCodes.Status503ServiceUnavailable);

        await email.SendAsync(new EmailMessage(newEmail, messages["ChangeEmailSubject"], messages["ChangeEmailText", user.DisplayName, link]), ct);
        return Results.Accepted();
    }

    static IResult Problem(IdentityResult result) =>
        Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description).Distinct()), statusCode: StatusCodes.Status400BadRequest);

    static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    static string? Decode(string token)
    {
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    static string? Link(HttpContext http, IOptions<EmailOptions> options, IHostEnvironment env, string path, params (string Key, string Value)[] query)
    {
        var origin = !string.IsNullOrWhiteSpace(options.Value.PublicUrl)
            ? options.Value.PublicUrl.TrimEnd('/')
            : env.IsDevelopment() ? $"{http.Request.Scheme}://{http.Request.Host}" : null;
        return origin is null ? null : QueryHelpers.AddQueryString($"{origin}/{path}", query.ToDictionary(q => q.Key, q => (string?)q.Value));
    }
}
