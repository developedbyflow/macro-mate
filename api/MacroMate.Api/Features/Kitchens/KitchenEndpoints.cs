using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Kitchens;

public sealed record KitchenMember(Guid Id, string DisplayName);

public sealed record KitchenInfo(Guid Id, Guid? OwnerId, List<KitchenMember> Members, ArchiveSummary? Archive);

public sealed record InviteCreated(string Token, DateTimeOffset ExpiresAt);

public sealed record InviteInfo(List<string> Members, DateTimeOffset ExpiresAt);

public sealed record AcceptInviteRequest(bool BringMine);

public sealed record RegisterRequest(string Token, string Email, string DisplayName, string Password);

public sealed record LeaveResult(bool HasArchive);

public static class KitchenEndpoints
{
    public static void MapKitchenEndpoints(this IEndpointRouteBuilder app)
    {
        var kitchen = app.MapGroup("/api/kitchen").RequireAuthorization();
        kitchen.MapGet("", Get).Produces<KitchenInfo>();
        kitchen.MapPost("/invites", Invite).Produces<InviteCreated>();
        kitchen.MapPost("/leave", Leave).Produces<LeaveResult>();
        kitchen.MapPost("/archive/restore", RestoreArchive).Produces<KitchenInfo>();
        kitchen.MapPost("/members/{memberId:guid}/remove", RemoveMember).Produces<KitchenInfo>();

        var invites = app.MapGroup("/api/invites");
        invites.MapGet("/{token}", Describe).Produces<InviteInfo>();
        invites.MapPost("/{token}/accept", Accept).RequireAuthorization().Produces<KitchenInfo>();
        invites.MapPost("/{token}/register", Register).Produces<MeResponse>();
    }

    static async Task<KitchenInfo> InfoAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleAsync(u => u.Id == userId, ct);
        var members = await db.Users.AsNoTracking()
            .Where(u => u.KitchenId == user.KitchenId)
            .OrderBy(u => u.DisplayName)
            .Select(u => new KitchenMember(u.Id, u.DisplayName))
            .ToListAsync(ct);
        var ownerId = await db.Kitchens.AsNoTracking().Where(k => k.Id == user.KitchenId).Select(k => k.OwnerId).SingleAsync(ct);
        return new KitchenInfo(user.KitchenId, ownerId, members, await KitchenService.ArchiveSummaryAsync(db, user.ArchiveKitchenId, ct));
    }

    static IResult Problem(KitchenError error) => Results.Problem(error.Message, statusCode: error.Status);

    static async Task<KitchenInfo> Get(AppDbContext db, CurrentUser me, CancellationToken ct) => await InfoAsync(db, me.Id, ct);

    static async Task<InviteCreated> Invite(AppDbContext db, CurrentUser me, CancellationToken ct)
    {
        var invite = await KitchenService.CreateInviteAsync(db, me.Id, ct);
        return new InviteCreated(invite.Token, invite.ExpiresAt);
    }

    static async Task<IResult> Leave(AppDbContext db, CurrentUser me, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var error = await KitchenService.LeaveAsync(db, me.Id, messages, ct);
        if (error is not null)
            return Problem(error);
        var archive = await db.Users.Where(u => u.Id == me.Id).Select(u => u.ArchiveKitchenId).SingleAsync(ct);
        return Results.Ok(new LeaveResult((await KitchenService.ArchiveSummaryAsync(db, archive, ct)) is not null));
    }

    static async Task<KitchenInfo> RestoreArchive(AppDbContext db, CurrentUser me, CancellationToken ct)
    {
        await KitchenService.RestoreArchiveAsync(db, me.Id, ct);
        return await InfoAsync(db, me.Id, ct);
    }

    static async Task<IResult> RemoveMember(Guid memberId, AppDbContext db, CurrentUser me, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var error = await KitchenService.RemoveMemberAsync(db, me.Id, memberId, messages, ct);
        return error is null ? Results.Ok(await InfoAsync(db, me.Id, ct)) : Problem(error);
    }

    static async Task<IResult> Describe(string token, AppDbContext db, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var invite = await KitchenService.FindValidInviteAsync(db, token, ct);
        if (invite is null)
            return Results.Problem(messages["InviteExpired"], statusCode: StatusCodes.Status410Gone);
        var members = await db.Users.Where(u => u.KitchenId == invite.KitchenId).OrderBy(u => u.DisplayName).Select(u => u.DisplayName).ToListAsync(ct);
        return Results.Ok(new InviteInfo(members, invite.ExpiresAt));
    }

    static async Task<IResult> Accept(string token, AcceptInviteRequest request, AppDbContext db, CurrentUser me, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var error = await KitchenService.JoinAsync(db, me.Id, token, request.BringMine, messages, ct);
        return error is null ? Results.Ok(await InfoAsync(db, me.Id, ct)) : Problem(error);
    }

    static async Task<IResult> Register(
        string token,
        RegisterRequest request,
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        AppDbContext db,
        IStringLocalizer<Messages> messages,
        CancellationToken ct)
    {
        var invite = await KitchenService.FindValidInviteAsync(db, token, ct);
        if (invite is null)
            return Results.Problem(messages["InviteExpired"], statusCode: StatusCodes.Status410Gone);

        var email = request.Email.Trim();
        var name = request.DisplayName.Trim();
        if (name.Length is < 1 or > 60)
            return Results.Problem(messages["DisplayNameInvalid"], statusCode: StatusCodes.Status400BadRequest);
        if (await users.FindByEmailAsync(email) is not null)
            return Results.Problem(messages["EmailAlreadyRegistered"], statusCode: StatusCodes.Status409Conflict);

        var (user, errors) = await KitchenService.CreateUserAsync(users, db, email, name, request.Password, invite.KitchenId, ct);
        if (user is null)
            return Results.Problem(string.Join(" ", errors), statusCode: StatusCodes.Status400BadRequest);

        invite.UsedAt = DateTimeOffset.UtcNow;
        invite.UsedBy = user.Id;
        await db.SaveChangesAsync(ct);

        await signIn.SignInAsync(user, isPersistent: true);
        await AuthEndpoints.EnsureProfileAsync(db, user.Id, ct);
        return Results.Ok(new MeResponse(user.Id, user.Email!, user.DisplayName));
    }
}
