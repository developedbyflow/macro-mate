using System.Security.Claims;

namespace MacroMate.Api.Features.Auth;

public sealed class CurrentUser(IHttpContextAccessor accessor)
{
    public Guid Id =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new InvalidOperationException("Utilizatorul nu e autentificat.");
}
